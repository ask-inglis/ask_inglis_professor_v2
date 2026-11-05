"""Combine professor-owned PDF passages with licensed external anatomy excerpts.

Use only in authenticated professor review paths. External searches receive the
claim text's extracted anatomy search terms (via external_evidence_pipeline).
Never send confidential, identifying, unpublished or donor information here.
This helper provides evidence, NOT a verdict and never updates database rows.
"""
from __future__ import annotations

import os
from typing import Any

from app.services.reference_indexer import search_reference_passages
from app.services.external_evidence_pipeline import retrieve_external_evidence

LOCAL_EVIDENCE_LIMIT = 6
EXTERNAL_EVIDENCE_LIMIT = 3


def retrieve_lecture_claim_evidence(professor_id: int, claim_text: str) -> list[dict[str, Any]]:
    """Return independently retrieved passages, preserving professor PDF scope.

    External lookup is controlled by EXTERNAL_EVIDENCE_ENABLED and is fail-open
    to the existing local review when a public API is unavailable. A successful
    retrieval is NOT proof: BullsAI must assess passages against the claim.
    """
    if type(professor_id) is not int or professor_id <= 0:
        raise ValueError("Authenticated professor ID required")
    if not isinstance(claim_text, str) or not 3 <= len(claim_text.strip()) <= 5000:
        raise ValueError("An anatomy claim between 3 and 5000 characters is required")

    local = search_reference_passages(
        professor_id=professor_id, query=claim_text.strip(), limit=LOCAL_EVIDENCE_LIMIT
    )
    if not isinstance(local, list):
        raise RuntimeError("Local reference search returned an invalid result")
    evidence: list[dict[str, Any]] = [dict(p) for p in local if isinstance(p, dict)]

    if os.getenv("EXTERNAL_EVIDENCE_ENABLED", "false").strip().casefold() not in {"true", "yes", "1"}:
        return evidence

    try:
        discovery = retrieve_external_evidence(claim_text.strip(), limit=EXTERNAL_EVIDENCE_LIMIT)
        candidates = discovery.get("passages", [])
        if not isinstance(candidates, list):
            return evidence
    except Exception:
        # Keep PDF-only verification working if public sources are unavailable.
        # Never include exception strings, which may contain sensitive URLs.
        return evidence

    seen = {str(p.get("passage_id")) for p in evidence if p.get("passage_id")}
    for item in candidates:
        if not isinstance(item, dict):
            continue
        pid = str(item.get("passage_id") or "")
        url = str(item.get("url") or "")
        excerpt = str(item.get("evidence_text") or "").strip()
        if not pid.startswith("EXT-") or pid in seen or not excerpt or not url.startswith("https://"):
            continue
        # External pipeline already enforces approved licenses and short excerpts.
        # Recheck here to prevent accidental unsupported passage inclusion.
        if item.get("license") not in {"CC0", "CC BY 3.0", "CC BY 4.0", "CC BY-SA 4.0"}:
            continue
        seen.add(pid)
        evidence.append(dict(item))
        if len(evidence) >= len(local) + EXTERNAL_EVIDENCE_LIMIT:
            break
    return evidence
