"""Question-focused, evidence-grounded verification of student chatbot feedback.

Call only after authenticating the professor. Searches professor-owned PDF passages,
then verifies the first substantive answer assertion in the context of the student
question. Does not change student feedback, lecture notes, or professor decisions.

Limitations: an extractive first-assertion heuristic cannot identify the central
answer in every multi-part or nonstandard response. The evidence-grounded BullsAI
provider remains responsible for its source checks, and professor review is required.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any

from app.services.reference_indexer import search_reference_passages
from app.services.providers.bullsai_provider import review_anatomy_claim

MAX_QUESTION_LENGTH = 300
MAX_ANSWER_LENGTH = 5000
DEFAULT_EVIDENCE_LIMIT = 6
MAX_SEARCHES = 3
MAX_EXTERNAL_PASSAGES = 3

# Off by default so existing professor workflows stay unchanged until tested.
# To enable in backend/.env: EXTERNAL_EVIDENCE_ENABLED=true


class StudentFeedbackVerificationError(RuntimeError):
    """Raised when reference retrieval or BullsAI verification fails."""


def _serialize_review(review: Any) -> dict[str, Any]:
    if hasattr(review, "model_dump"):
        data = review.model_dump(mode="json")
    elif hasattr(review, "dict"):
        data = review.dict()
    elif isinstance(review, dict):
        data = dict(review)
    else:
        raise StudentFeedbackVerificationError("BullsAI returned an unexpected review type")
    if not isinstance(data, dict):
        raise StudentFeedbackVerificationError("BullsAI review could not be serialized")
    return data


def _first_answer_assertion(answer: str) -> str | None:
    """Extract a short first declarative statement; never generate new anatomy facts.

    Refuse fragments and disclaimers rather than treating them as verified claims.
    Only the first paragraph/bullet is considered: later detail may be unrelated.
    """
    for raw_line in answer.splitlines():
        line = re.sub(r"^\s*(?:[-*•]|\d+[.)])\s+", "", raw_line).strip()
        line = re.sub(r"[*_`#]", "", line).strip()
        if not line:
            continue
        # Do not use generic disclaimers or headings as the primary assertion.
        if re.match(r"^(?:general knowledge|sources?|references?|note|disclaimer)\s*:", line, re.I):
            continue
        statement = re.split(r"(?<=[.!?])\s+", line, maxsplit=1)[0].strip()
        statement = statement[:600].strip()
        words = re.findall(r"[A-Za-z][A-Za-z'-]*", statement)
        if len(words) < 5 or statement.endswith("?"):
            return None
        return statement
    return None


def _search_queries(question: str, focused_assertion: str) -> list[str]:
    """Use question and focused answer; never use secondary answer bullets as evidence."""
    candidates = [
        f"{question} {focused_assertion}",
        focused_assertion,
        question,
    ]
    queries: list[str] = []
    seen: set[str] = set()
    for value in candidates:
        normalized = " ".join(value.split())[:MAX_QUESTION_LENGTH].strip()
        key = normalized.casefold()
        if len(normalized) >= 3 and key not in seen:
            queries.append(normalized)
            seen.add(key)
    return queries[:MAX_SEARCHES]


def _external_search_query(focused_assertion: str) -> str:
    """Make a concise de-identified keyword query for academic/encyclopedia search.

    Keep medically meaningful terms (including nerve and brachii); discard
    grammatical connecting words that distort search-result ranking.
    Never treat these search keywords as independent evidence.
    """
    stop = {
        "a", "an", "the", "is", "are", "was", "were", "be", "by",
        "of", "to", "from", "with", "and", "or", "which", "what",
        "does", "do", "that", "this", "supplied", "supplies", "supply",
        "innervated", "innervates", "innervation",
    }
    terms = re.findall(r"[A-Za-z][A-Za-z'-]*", focused_assertion)
    keywords = [term for term in terms if term.casefold() not in stop]
    return " ".join(keywords[:15])[:180].strip()


def _passage_key(passage: dict[str, Any]) -> str:
    """Prefer stable passage IDs when merging results from different queries."""
    if passage.get("passage_id"):
        return str(passage["passage_id"])
    return json.dumps(passage, sort_keys=True, ensure_ascii=False, default=str)


def _needs_review(reason: str, passage_count: int = 0) -> dict[str, Any]:
    return {
        "status": "needs_review",
        "verdict": None,
        "reason": reason,
        "suggested_correction": None,
        "sources": [],
        "evidence_passage_count": passage_count,
        "review_required": True,
    }


def verify_reported_answer(
    *,
    professor_id: int,
    question: str,
    chatbot_answer: str,
    evidence_limit: int = DEFAULT_EVIDENCE_LIMIT,
) -> dict[str, Any]:
    """Verify the first substantive response statement, given the student's question.

    This is a conservative heuristic for typical short-answer chatbot responses,
    not full multi-claim checking. All outcomes are advisory and professor-reviewed.
    """
    if type(professor_id) is not int or professor_id <= 0:
        raise ValueError("A valid authenticated professor ID is required")
    if not isinstance(question, str) or not question.strip():
        raise ValueError("Student question is required")
    if not isinstance(chatbot_answer, str) or not chatbot_answer.strip():
        raise ValueError("Chatbot answer is required")
    if type(evidence_limit) is not int or not 1 <= evidence_limit <= 20:
        raise ValueError("evidence_limit must be between 1 and 20")
    if len(question) > 5000 or len(chatbot_answer) > MAX_ANSWER_LENGTH:
        raise ValueError("Question or chatbot answer is too long")

    clean_question = question.strip()
    clean_answer = chatbot_answer.strip()
    focused = _first_answer_assertion(clean_answer)
    if focused is None:
        return _needs_review(
            "Could not isolate a substantive first answer statement. "
            "The professor must review this response manually."
        )

    queries = _search_queries(clean_question, focused)
    results_by_query: list[list[dict[str, Any]]] = []
    try:
        for query in queries:
            results = search_reference_passages(
                professor_id=professor_id, query=query, limit=evidence_limit
            )
            if not isinstance(results, list) or any(not isinstance(row, dict) for row in results):
                raise StudentFeedbackVerificationError("Reference search returned an unexpected result")
            results_by_query.append(results)
    except StudentFeedbackVerificationError:
        raise
    except Exception as exc:
        raise StudentFeedbackVerificationError("Indexed reference search failed") from exc

    passages: list[dict[str, Any]] = []
    seen: set[str] = set()
    for position in range(evidence_limit):
        for result in results_by_query:
            if position >= len(result):
                continue
            passage = result[position]
            key = _passage_key(passage)
            if key not in seen:
                seen.add(key)
                passages.append(passage)
                if len(passages) >= evidence_limit:
                    break
        if len(passages) >= evidence_limit:
            break

    external_error = None
    external_count = 0
    external_details = {"academic_passages": 0, "wikipedia_passages": 0}
    if os.getenv("EXTERNAL_EVIDENCE_ENABLED", "false").strip().lower() in {"1", "true", "yes"}:
        try:
            from app.services.external_evidence_pipeline import retrieve_external_evidence
            discovery = retrieve_external_evidence(focused, limit=MAX_EXTERNAL_PASSAGES)
            external_details = {
                "academic_passages": discovery.get("academic_passages", 0),
                "wikipedia_passages": discovery.get("wikipedia_passages", 0),
            }
            for passage in discovery.get("passages", []):
                key = _passage_key(passage)
                if key not in seen:
                    passages.append(passage)
                    seen.add(key)
                    external_count += 1
            if discovery.get("errors"):
                external_error = ", ".join(sorted(discovery["errors"].keys()))[:250]
        except Exception as exc:
            # Keep local PDF-based verification available during external outages.
            external_error = type(exc).__name__

    if not passages:
        response = _needs_review(
            "No retrievable independent anatomy evidence was found for the central answer. "
            "Professor review is required."
        )
        response["external_evidence_passage_count"] = 0
        response["external_search_error"] = external_error
        return response

    # The provider's evidence-validation prompt judges only this focused claim;
    # secondary details in the full answer cannot independently earn support.
    claim = f"Student question: {clean_question[:MAX_QUESTION_LENGTH]}\nPrimary answer assertion: {focused}"
    try:
        review = review_anatomy_claim(claim, evidence=passages)
    except Exception as exc:
        raise StudentFeedbackVerificationError("BullsAI verification failed") from exc

    data = _serialize_review(review)
    return {
        "status": data.get("status", "needs_review"),
        "verdict": data.get("verdict"),
        "reason": data.get("reason", "AI returned no explanation."),
        "suggested_correction": data.get("suggested_correction"),
        "sources": data.get("sources") or [],
        "evidence_passage_count": len(passages),
        "external_evidence_passage_count": external_count,
        "external_academic_passages": external_details["academic_passages"],
        "external_wikipedia_passages": external_details["wikipedia_passages"],
        "external_search_error": external_error,
        "review_required": True,
    }
