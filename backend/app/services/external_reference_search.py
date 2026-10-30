"""Low-cost, read-only external anatomy literature discovery.

Install: professor backend/app/services/external_reference_search.py

Results are untrusted candidate references, NOT verified factual evidence.
No third-party text is sent to BullsAI by this module. No database changes.
Uses Python standard library; optional NCBI_API_KEY for higher NCBI limits.

Set EXTERNAL_RESEARCH_USER_AGENT to a descriptive app name and contact email
before production use (e.g. "AskInglisResearch/0.1 (contact: team@example.edu)").
Never include student identifiers, donor data, or confidential lecture content
in searches. Search concise, de-identified anatomical terminology only.
"""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any

EUROPE_PMC_URL = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"
PUBMED_SEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
PUBMED_SUMMARY_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
WIKIPEDIA_SEARCH_URL = "https://en.wikipedia.org/w/rest.php/v1/search/page"
MAX_QUERY_LENGTH = 180
MAX_RETURNED_EXCERPT = 280
MAX_RESPONSE_BYTES = 2_000_000
USER_AGENT = "AskInglisResearch/0.1 (educational source discovery; contact: configure-EXTERNAL_RESEARCH_USER_AGENT)"


class ExternalReferenceSearchError(RuntimeError):
    pass


def _get_json(url: str, params: dict[str, Any], *, timeout: float = 9.0) -> dict:
    full_url = url + "?" + urllib.parse.urlencode(params)
    agent = os.getenv("EXTERNAL_RESEARCH_USER_AGENT", USER_AGENT)
    request = urllib.request.Request(
        full_url,
        headers={"User-Agent": agent, "Accept": "application/json"},
        method="GET",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read(MAX_RESPONSE_BYTES + 1)
        if len(raw) > MAX_RESPONSE_BYTES:
            raise ExternalReferenceSearchError("Upstream response exceeded safe size limit")
    result = json.loads(raw)
    if not isinstance(result, dict):
        raise ExternalReferenceSearchError("Unexpected external API response format")
    return result


def _clean(text: Any, limit: int = 600) -> str:
    if not isinstance(text, str):
        return ""
    text = re.sub(r"<[^>]*>", " ", text)
    text = re.sub(r"\\s+", " ", text).strip()
    return text[:limit]


def _candidate(
    *, provider: str, title: Any, url: str, identifier: str,
    authors: str = "", year: str = "", excerpt: str = "",
    doi: str = "", license_note: str = "",
) -> dict[str, Any]:
    return {
        "provider": provider,
        "title": _clean(title, 300) or "Untitled reference",
        "url": url,
        "identifier": identifier,
        "doi": doi,
        "authors": _clean(authors, 250),
        "publication_year": str(year or "")[:8],
        "excerpt": _clean(excerpt, MAX_RETURNED_EXCERPT),
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        "license_note": license_note,
        "evidence_status": "candidate_not_verified",
    }


def search_europe_pmc(query: str, limit: int = 3) -> list[dict[str, Any]]:
    payload = _get_json(EUROPE_PMC_URL, {
        "query": query, "format": "json", "resultType": "core",
        "pageSize": min(limit * 6, 30),
    })
    rows = payload.get("resultList", {}).get("result", [])
    if not isinstance(rows, list):
        return []
    found = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        pmid = str(row.get("pmid") or "")
        pmcid = str(row.get("pmcid") or "")
        doi = str(row.get("doi") or "")
        if pmcid:
            link = "https://europepmc.org/articles/" + urllib.parse.quote(pmcid)
        elif pmid:
            link = "https://pubmed.ncbi.nlm.nih.gov/" + urllib.parse.quote(pmid) + "/"
        elif doi:
            link = "https://doi.org/" + urllib.parse.quote(doi, safe="/")
        else:
            continue
        found.append(_candidate(
            provider="Europe PMC", title=row.get("title"), url=link,
            identifier=pmcid or pmid or doi, doi=doi,
            authors=row.get("authorString", ""), year=row.get("pubYear", ""),
            excerpt=row.get("abstractText", ""),
            license_note="Abstract may be copyrighted; verify article license before reuse.",
        ))
        if len(found) >= min(limit * 6, 30):
            break
    return found


def search_pubmed(query: str, limit: int = 3) -> list[dict[str, Any]]:
    key = os.getenv("NCBI_API_KEY", "").strip()
    options = {"db": "pubmed", "term": query, "retmax": min(limit * 6, 30), "retmode": "json", "sort": "relevance"}
    if key:
        options["api_key"] = key
    found = _get_json(PUBMED_SEARCH_URL, options)
    ids = found.get("esearchresult", {}).get("idlist", [])
    if not isinstance(ids, list) or not ids:
        return []
    ids = [str(i) for i in ids[:min(limit * 6, 30)] if str(i).isdigit()]
    if not ids:
        return []
    options = {"db": "pubmed", "id": ",".join(ids), "retmode": "json"}
    if key:
        options["api_key"] = key
    summary = _get_json(PUBMED_SUMMARY_URL, options).get("result", {})
    results = []
    for pmid in ids:
        row = summary.get(pmid, {})
        if not isinstance(row, dict):
            continue
        articleids = row.get("articleids", [])
        doi = next((str(x.get("value", "")) for x in articleids
                    if isinstance(x, dict) and x.get("idtype") == "doi"), "")
        pubdate = str(row.get("pubdate") or "")
        author_rows = row.get("authors", [])
        authors = ", ".join(x.get("name", "") for x in author_rows[:4]
                            if isinstance(x, dict)) if isinstance(author_rows, list) else ""
        results.append(_candidate(
            provider="PubMed", title=row.get("title"),
            url=f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/", identifier=pmid,
            doi=doi, year=pubdate[:4], authors=authors,
            excerpt="",  # PubMed summary supplies metadata, NOT a verified passage
            license_note="Metadata only. Check publication reuse terms before retrieving text.",
        ))
    return results


def search_wikipedia(query: str, limit: int = 2) -> list[dict[str, Any]]:
    payload = _get_json(WIKIPEDIA_SEARCH_URL, {"q": query, "limit": limit})
    pages = payload.get("pages", [])
    if not isinstance(pages, list):
        return []
    results = []
    for page in pages[:limit]:
        if not isinstance(page, dict) or not isinstance(page.get("title"), str):
            continue
        title = page["title"]
        results.append(_candidate(
            provider="Wikipedia (supplementary)",
            title=title,
            url="https://en.wikipedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_")),
            identifier=title,
            excerpt=page.get("excerpt") or page.get("description") or "",
            license_note="Wikipedia text generally CC BY-SA; attribution and license compliance required.",
        ))
    return results



_NONHUMAN_TITLE = re.compile(
    r"\b(raccoon dog|canine|murine|rat model|mouse model|mice|feline|equine|"
    r"porcine|bovine|rabbit model|dogs?\b|cats?\b)\b", re.I
)
_STOPWORDS = {"the", "and", "for", "with", "which", "does", "what", "nerve",
              "muscle", "human", "anatomy", "supply", "supplies", "innervation",
              "of", "in", "to", "a", "an", "is", "are"}


def _relevance(result: dict[str, Any], query: str) -> tuple[int, str]:
    """Rank discovery candidates by literal term coverage; do not claim proof."""
    title = result.get("title", "")
    preview = result.get("excerpt", "")
    haystack = (title + " " + preview).casefold()
    words = {w for w in re.findall(r"[a-z]{3,}", query.casefold()) if w not in _STOPWORDS}
    hits = sum(bool(re.search(r"\b" + re.escape(word) + r"\b", haystack)) for word in words)
    title_hits = sum(bool(re.search(r"\b" + re.escape(word) + r"\b", title.casefold())) for word in words)
    score = 3 * hits + 2 * title_hits
    if _NONHUMAN_TITLE.search(title):
        score -= 20
    # A search result is never independently treated as clinical or anatomical proof.
    category = "on_topic_candidate" if (hits >= 2 or (len(words) == 1 and hits == 1)) and score > 0 else "low_relevance"
    return score, category


def search_external_references(
    query: str, *, per_provider: int = 3, include_wikipedia: bool = True,
) -> dict[str, Any]:
    """Discover sources from public APIs; never claim that a hit proves a claim.

    Partial provider failures are reported in errors rather than silently hidden.
    The returned excerpts are discovery previews, NOT licensed evidence for LLM.
    """
    if not isinstance(query, str) or not 3 <= len(query.strip()) <= MAX_QUERY_LENGTH:
        raise ValueError(f"Query must be 3–{MAX_QUERY_LENGTH} characters")
    if type(per_provider) is not int or not 1 <= per_provider <= 5:
        raise ValueError("per_provider must be between 1 and 5")
    clean_query = " ".join(query.strip().split())
    providers = [search_europe_pmc, search_pubmed]
    if include_wikipedia:
        providers.append(search_wikipedia)
    all_results: list[dict[str, Any]] = []
    errors: dict[str, str] = {}
    for provider in providers:
        try:
            all_results.extend(provider(clean_query, per_provider))
        except (urllib.error.URLError, TimeoutError, ValueError, KeyError,
                json.JSONDecodeError, ExternalReferenceSearchError) as exc:
            errors[provider.__name__] = type(exc).__name__
    unique: list[dict[str, Any]] = []
    seen: set[str] = set()
    for result in all_results:
        dedup_id = (result["doi"] or result["url"]).casefold()
        if dedup_id not in seen:
            unique.append(result)
            seen.add(dedup_id)
    for item in unique:
        item["relevance_score"], item["relevance_label"] = _relevance(item, clean_query)
    unique.sort(key=lambda item: item["relevance_score"], reverse=True)
    relevant = [item for item in unique if item["relevance_label"] == "on_topic_candidate"]
    # Avoid inventing proof from weak hits: zero relevant references is a valid result.
    relevant = relevant[: per_provider * len(providers)]
    return {
        "query": clean_query,
        "results": relevant,
        "total_results": len(relevant),
        "discarded_low_relevance": len(unique) - len(relevant),
        "provider_errors": errors,
        "evidence_note": (
            "Discovery results only. A matching title or abstract does not verify "
            "the anatomical claim. Check source relevance, permission, and exact "
            "source passages before passing evidence to BullsAI."
        ),
    }


if __name__ == "__main__":
    import sys
    q = " ".join(sys.argv[1:]).strip() or "biceps brachii musculocutaneous nerve"
    print(json.dumps(search_external_references(q), indent=2, ensure_ascii=False))
