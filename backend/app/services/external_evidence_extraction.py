"""Read-only, license-aware extraction of candidate external anatomy passages.

Install at backend/app/services/external_evidence_extraction.py alongside
external_reference_search.py. Works with its discovery result dictionaries.

This module DOES NOT assert that a passage proves a claim, and DOES NOT send
content to BullsAI. It fetches Wikipedia introductory text (CC BY-SA) and
Europe PMC full text only when explicit CC BY or CC0 licensing is found.
Unsupported article licenses and PubMed metadata-only hits are excluded.

For production: set EXTERNAL_RESEARCH_USER_AGENT to identify the project and
provide a contact email. Do not put student/donor identifying data in queries.
"""
from __future__ import annotations

import json
import os
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from typing import Any

MAX_DOWNLOAD_BYTES = 2_500_000
MAX_PASSAGES = 4
MAX_PASSAGE_CHARS = 420
WIKI_API = "https://en.wikipedia.org/w/api.php"
EUROPE_PMC_FULL_TEXT = "https://www.ebi.ac.uk/europepmc/webservices/rest/{pmcid}/fullTextXML"
USER_AGENT = "AskInglisResearch/0.1 (set EXTERNAL_RESEARCH_USER_AGENT)"


class ExternalEvidenceError(RuntimeError):
    """Remote resource unavailable, oversized, or malformed."""


def _download(url: str, timeout: float = 10.0) -> bytes:
    request = urllib.request.Request(url, headers={
        "User-Agent": os.getenv("EXTERNAL_RESEARCH_USER_AGENT", USER_AGENT),
        "Accept": "application/xml, application/json;q=0.9, */*;q=0.5",
    })
    with urllib.request.urlopen(request, timeout=timeout) as response:
        data = response.read(MAX_DOWNLOAD_BYTES + 1)
    if len(data) > MAX_DOWNLOAD_BYTES:
        raise ExternalEvidenceError("External document exceeds download limit")
    return data


def _normalize(text: Any) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def _passage_matches(text: str, query: str) -> int:
    terms = {word for word in re.findall(r"[a-z]{4,}", query.casefold())
             if word not in {"which", "what", "with", "this", "that", "from", "nerve", "muscle", "human", "anatomy"}}
    content = text.casefold()
    return sum(bool(re.search(r"\b" + re.escape(term) + r"\b", content)) for term in terms)


def _select_passages(paragraphs: list[str], query: str, limit: int) -> list[str]:
    # Scores are for discovery prioritization; they never establish factual truth.
    scored = [( _passage_matches(text, query), i, text) for i, text in enumerate(paragraphs)]
    scored.sort(key=lambda row: (-row[0], row[1]))
    return [text[:MAX_PASSAGE_CHARS] for score, _, text in scored
            if score > 0][:limit]


def _record(candidate: dict[str, Any], passage: str, *, license_id: str,
            source_location: str, index: int) -> dict[str, Any]:
    return {
        "passage_id": f"EXT-{candidate['identifier']}-{index}",
        "title": candidate["title"],
        "url": candidate["url"],
        "provider": candidate["provider"],
        "doi": candidate.get("doi", ""),
        "evidence_text": passage,
        "source_location": source_location,
        "license": license_id,
        "attribution_required": license_id != "CC0",
        "evidence_status": "candidate_not_verified",
    }


def _wikipedia(candidate: dict[str, Any], query: str, limit: int) -> list[dict[str, Any]]:
    title = candidate.get("identifier") or candidate.get("title")
    if not isinstance(title, str) or not title.strip():
        return []
    params = urllib.parse.urlencode({
        "action": "query", "prop": "extracts", "explaintext": 1,
        "exintro": 1, "redirects": 1, "titles": title,
        "format": "json", "formatversion": 2,
    })
    data = json.loads(_download(WIKI_API + "?" + params))
    pages = data.get("query", {}).get("pages", [])
    if not pages or pages[0].get("missing"):
        return []
    # CC BY-SA text must be attributed, linked, and handled with license terms.
    paragraphs = [_normalize(p) for p in pages[0].get("extract", "").split("\n")]
    selected = _select_passages([p for p in paragraphs if len(p) >= 30], query, limit)
    return [_record(candidate, text, license_id="CC BY-SA 4.0",
                    source_location="Wikipedia article introduction", index=i + 1)
            for i, text in enumerate(selected)]


def _is_permitted_pmc_license(root: ET.Element) -> str | None:
    # XML license can contain links with license reference; require explicit link
    # to CC BY or CC0. Do not accept NC/ND/SA licenses as equivalent to CC BY.
    for element in root.iter():
        if element.tag.rsplit("}", 1)[-1] != "license":
            continue
        blob = " ".join([v for v in element.attrib.values()] + list(element.itertext())).casefold()
        if re.search(r"creativecommons\.org/publicdomain/zero/1\.0", blob):
            return "CC0"
        if re.search(r"creativecommons\.org/licenses/by/4\.0(?:/|\b)", blob):
            return "CC BY 4.0"
        if re.search(r"creativecommons\.org/licenses/by/3\.0(?:/|\b)", blob):
            return "CC BY 3.0"
    return None


def _europe_pmc(candidate: dict[str, Any], query: str, limit: int) -> list[dict[str, Any]]:
    pmcid = str(candidate.get("identifier", ""))
    if not re.fullmatch(r"PMC\d+", pmcid):
        return []
    root = ET.fromstring(_download(EUROPE_PMC_FULL_TEXT.format(pmcid=pmcid)))
    license_id = _is_permitted_pmc_license(root)
    if license_id is None:
        return []
    paragraphs = []
    for node in root.iter():
        # Limit to prose in abstract and body, excluding references and captions.
        if node.tag.rsplit("}", 1)[-1] == "p":
            text = _normalize(" ".join(node.itertext()))
            if 40 <= len(text) <= 6000:
                paragraphs.append(text)
    selected = _select_passages(paragraphs, query, limit)
    return [_record(candidate, text, license_id=license_id,
                    source_location=f"Europe PMC open-access article {pmcid}", index=i + 1)
            for i, text in enumerate(selected)]


def extract_external_evidence(
    candidate: dict[str, Any], *, query: str, limit: int = MAX_PASSAGES,
) -> dict[str, Any]:
    """Return traceable candidate passages; unsupported sources yield zero.

    Metadata-only PubMed results must be resolved to a separately licensed PMC
    full-text source before extraction. No unsupported copyright assumptions.
    """
    if not isinstance(candidate, dict):
        raise ValueError("candidate must be a source discovery dictionary")
    if not isinstance(query, str) or not 3 <= len(query.strip()) <= 180:
        raise ValueError("query must be between 3 and 180 characters")
    if type(limit) is not int or not 1 <= limit <= MAX_PASSAGES:
        raise ValueError("limit must be 1–4")
    provider = str(candidate.get("provider", ""))
    if provider.startswith("Wikipedia"):
        passages = _wikipedia(candidate, query.strip(), limit)
    elif provider == "Europe PMC":
        passages = _europe_pmc(candidate, query.strip(), limit)
    else:
        passages = []
    return {
        "title": candidate.get("title", ""),
        "url": candidate.get("url", ""),
        "passages": passages,
        "passage_count": len(passages),
        "note": "Candidate excerpts only; verify factual relevance before BullsAI assessment.",
    }


if __name__ == "__main__":
    import sys
    from app.services.external_reference_search import search_external_references
    query = " ".join(sys.argv[1:]).strip() or "biceps brachii musculocutaneous nerve"
    discovered = search_external_references(query, per_provider=2)
    output = []
    for candidate in discovered["results"]:
        if candidate["provider"].startswith("Wikipedia") or (
            candidate["provider"] == "Europe PMC" and
            str(candidate["identifier"]).startswith("PMC")
        ):
            try:
                output.append(extract_external_evidence(candidate, query=query, limit=2))
            except Exception as exc:
                output.append({"title": candidate["title"], "error": type(exc).__name__})
    print(json.dumps({"query": query, "results": output}, ensure_ascii=False, indent=2))
