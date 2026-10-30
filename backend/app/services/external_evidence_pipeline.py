"""Read-only external evidence retrieval for professor-authorized anatomy reviews.

External results are untrusted candidates, never proof. Only short passages with
explicitly recognized reuse licenses are returned. Academic excerpts have
priority; Wikipedia contributes at most one supplementary passage.
"""
from __future__ import annotations

import re
from typing import Any

from app.services.external_reference_search import search_external_references
from app.services.external_evidence_extraction import extract_external_evidence

APPROVED_LICENSES = {"CC0", "CC BY 3.0", "CC BY 4.0", "CC BY-SA 4.0"}
STOP_WORDS = {
    "the", "a", "an", "is", "are", "was", "were", "by", "of", "to", "in",
    "from", "which", "what", "with", "and", "for", "that", "this", "supplied",
    "supplies", "supply", "innervated", "innervates", "innervation",
}
RELATION_WORDS = {
    "innervate", "innervated", "innervates", "innervation", "nerve", "nerves",
    "supply", "supplied", "supplies", "motor", "sensory", "origin", "insertion",
    "artery", "arterial", "drainage", "action", "flexion", "extension",
}


def anatomy_search_query(claim: str) -> str:
    words = re.findall(r"[A-Za-z][A-Za-z'-]*", claim)
    return " ".join(w for w in words if w.lower() not in STOP_WORDS)[:180].strip()


def _words(text: str) -> set[str]:
    return set(re.findall(r"[a-z][a-z'-]*", text.casefold()))


def _passage_score(text: str, title: str, claim: str) -> int:
    """Rank discovery excerpts for review, NOT determine factual truth.

    Prefer texts mentioning *all* core anatomy terms, and for nerve-supply
    claims prioritize passages explicitly discussing motor innervation.
    A citation still requires independent evaluation by BullsAI.
    """
    claim_terms = _words(anatomy_search_query(claim))
    passage_terms = _words(text)
    title_terms = _words(title)
    overlap = claim_terms & passage_terms
    score = 12 * len(overlap) + 3 * len(claim_terms & title_terms)
    if claim_terms and claim_terms.issubset(passage_terms):
        score += 22
    claim_lower = claim.casefold()
    if any(w in claim_lower for w in ("nerve", "innervat", "suppli")):
        if {"innervation", "innervates", "innervated", "innervate", "supply", "supplies", "supplied"} & passage_terms:
            score += 12
        if "motor" in passage_terms and "nerve" in passage_terms:
            score += 8
    # Minor relevance nudge for paragraphs that actually discuss anatomy.
    score += min(3, len(RELATION_WORDS & passage_terms))
    return score


def retrieve_external_evidence(claim: str, *, limit: int = 3) -> dict[str, Any]:
    """Return auditable candidate passages, not verdicts, from public APIs.

    Searches only concise anatomical terms. Do not send confidential student,
    donor, or unpublished lecture contents to this function.
    """
    if not isinstance(claim, str) or not 3 <= len(claim.strip()) <= 5000:
        raise ValueError("A nonempty anatomy claim of <=5000 chars is required")
    if type(limit) is not int or not 1 <= limit <= 6:
        raise ValueError("limit must be 1..6")
    query = anatomy_search_query(claim)
    empty = {"query": query, "passages": [], "errors": {},
             "academic_passages": 0, "wikipedia_passages": 0}
    if len(query) < 3:
        empty["errors"] = {"query": "Too few anatomy terms"}
        return empty

    discovery = search_external_references(query, per_provider=4, include_wikipedia=True)
    candidates = discovery.get("results", [])
    if not isinstance(candidates, list):
        candidates = []
    academic: list[dict[str, Any]] = []
    wiki: list[dict[str, Any]] = []
    for candidate in candidates:
        if not isinstance(candidate, dict):
            continue
        provider = str(candidate.get("provider", ""))
        if provider == "Europe PMC" and re.fullmatch(r"PMC\d+", str(candidate.get("identifier", ""))):
            academic.append(candidate)
        elif provider.startswith("Wikipedia"):
            wiki.append(candidate)
    academic.sort(key=lambda x: -int(x.get("relevance_score") or 0))
    wiki.sort(key=lambda x: -int(x.get("relevance_score") or 0))
    errors = dict(discovery.get("provider_errors") or {})

    def collect(group: list[dict[str, Any]]) -> list[tuple[int, dict[str, Any]]]:
        found: list[tuple[int, dict[str, Any]]] = []
        for candidate in group[:16]:
            try:
                response = extract_external_evidence(candidate, query=query, limit=3)
            except Exception as exc:
                errors[str(candidate.get("identifier") or "source")] = type(exc).__name__
                continue
            for item in response.get("passages", []):
                if not isinstance(item, dict) or item.get("license") not in APPROVED_LICENSES:
                    continue
                passage_id = str(item.get("passage_id") or "")
                excerpt = str(item.get("evidence_text") or "").strip()
                url = str(item.get("url") or "")
                if not passage_id or not excerpt or not url.startswith("https://"):
                    continue
                normalized = {
                    "passage_id": passage_id,
                    "title": str(item.get("title") or "External anatomy reference"),
                    "url": url,
                    "pdf_page": None,
                    "reference_id": None,
                    "evidence_text": excerpt[:420],
                    "provider": str(item.get("provider") or candidate.get("provider") or ""),
                    "doi": str(item.get("doi") or ""),
                    "license": str(item["license"]),
                    "source_location": str(item.get("source_location") or ""),
                }
                found.append((_passage_score(normalized["evidence_text"], normalized["title"], claim), normalized))
        found.sort(key=lambda pair: (-pair[0], pair[1]["passage_id"]))
        return found

    academic_passages = collect(academic)
    wikipedia_passages = collect(wiki)
    selected: list[dict[str, Any]] = []
    seen: set[str] = set()

    def choose(items: list[tuple[int, dict[str, Any]]], maximum: int) -> None:
        added = 0
        for _, passage in items:
            if len(selected) >= limit or added >= maximum:
                break
            passage_id = passage["passage_id"]
            if passage_id in seen:
                continue
            selected.append(passage)
            seen.add(passage_id)
            added += 1

    # Reserve one slot for relevant supplementary evidence when available,
    # rather than filling the limit with unrelated academic search matches.
    wiki_slot = 1 if wikipedia_passages else 0
    choose(academic_passages, limit - wiki_slot)
    choose(wikipedia_passages, 1)
    choose(academic_passages, limit)
    return {
        "query": query,
        "passages": selected,
        "errors": errors,
        "academic_passages": sum(p["provider"] == "Europe PMC" for p in selected),
        "wikipedia_passages": sum(p["provider"].startswith("Wikipedia") for p in selected),
    }
