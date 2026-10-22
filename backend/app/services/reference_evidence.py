"""Retrieve traceable passages from reference PDFs and approved web pages.

This module does not assess whether evidence supports a claim. That decision is
made later by the verification workflow, with the professor retaining approval.
"""

from __future__ import annotations

import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

import fitz
import httpx

# Add domains only after evaluating their reliability and access policies.
TRUSTED_DOMAINS = frozenset({
    "ncbi.nlm.nih.gov",
    "openstax.org",
})

MAX_PDF_BYTES = 30 * 1024 * 1024
MAX_HTML_BYTES = 2 * 1024 * 1024
MAX_PASSAGE_CHARS = 1100
MAX_RESULTS = 6
USER_AGENT = "AskInglisEvidenceResearch/1.0 (academic reference retrieval)"

STOP_WORDS = frozenset({
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
    "has", "in", "is", "it", "of", "on", "or", "that", "the", "their",
    "this", "to", "was", "were", "with",
})


def _keywords(text: str) -> set[str]:
    return {
        term for term in re.findall(r"[a-z0-9]+", text.lower())
        if len(term) >= 3 and term not in STOP_WORDS
    }


def _passages(text: str) -> list[str]:
    """Split normalized text into bounded, overlapping word windows."""
    words = re.sub(r"\s+", " ", text).strip().split()
    if not words:
        return []
    result = []
    size, stride = 150, 110
    for start in range(0, len(words), stride):
        passage = " ".join(words[start:start + size])[:MAX_PASSAGE_CHARS]
        if len(passage) >= 60:
            result.append(passage)
        if start + size >= len(words):
            break
    return result


def _rank(claim: str, entries: list[dict], limit: int) -> list[dict]:
    query = _keywords(claim)
    if not query:
        return []
    scored = []
    for entry in entries:
        overlap = query.intersection(_keywords(entry["passage"]))
        if not overlap:
            continue
        scored.append((len(overlap), entry))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [entry for _, entry in scored[:max(0, min(limit, MAX_RESULTS))]]


def search_reference_pdf(
    claim: str,
    pdf_path: str | Path,
    *,
    reference_id: str,
    limit: int = 3,
) -> list[dict]:
    """Return matching PDF passages with true 1-based physical page numbers.

    The calling API must authorize ownership/access to pdf_path and reference_id.
    Do not accept arbitrary filesystem paths from browser requests.
    """
    path = Path(pdf_path)
    if path.suffix.lower() != ".pdf":
        raise ValueError("The reference must be a PDF")
    if not path.is_file() or path.stat().st_size > MAX_PDF_BYTES:
        raise ValueError("Reference PDF missing or exceeds 30 MB")

    entries = []
    with fitz.open(path) as document:
        if document.needs_pass:
            raise ValueError("Encrypted reference PDFs are not supported")
        for page_number, page in enumerate(document, start=1):
            for passage in _passages(page.get_text("text")):
                entries.append({
                    "source_type": "pdf",
                    "source_title": path.name,
                    "reference_id": reference_id,
                    "page_number": page_number,
                    "url": None,
                    "passage": passage,
                })
    return _rank(claim, entries, limit)


class _ReadableHTML(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.parts: list[str] = []
        self.title_parts: list[str] = []
        self.in_title = False

    def handle_starttag(self, tag: str, attrs: list) -> None:
        if tag in {"script", "style", "noscript", "nav", "footer"}:
            self.depth += 1
        elif tag == "title":
            self.in_title = True

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript", "nav", "footer"}:
            self.depth = max(0, self.depth - 1)
        elif tag == "title":
            self.in_title = False

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_parts.append(data)
        elif not self.depth and data.strip():
            self.parts.append(data.strip())


def _validated_url(url: str) -> str:
    parsed = urlsplit(url)
    host = (parsed.hostname or "").lower().rstrip(".")
    if (
        parsed.scheme != "https"
        or host not in TRUSTED_DOMAINS
        or parsed.username is not None
        or parsed.password is not None
        or parsed.port not in (None, 443)
    ):
        raise ValueError("Only approved HTTPS anatomy reference domains are allowed")
    return url


def search_trusted_web_page(
    claim: str,
    url: str,
    *,
    limit: int = 3,
) -> list[dict]:
    """Fetch one explicitly supplied approved URL, not an unrestricted web search.

    No redirects, proxies, or caller-controlled hosts are followed. Websites may
    block automated access. A failure must not be converted into fabricated text.
    """
    url = _validated_url(url)
    with httpx.Client(
        follow_redirects=False,
        trust_env=False,
        timeout=12.0,
        headers={"User-Agent": USER_AGENT},
    ) as client:
        with client.stream("GET", url) as response:
            response.raise_for_status()
            if response.status_code != 200:
                raise ValueError("Reference website redirected or did not return a page")
            content_type = response.headers.get("content-type", "").lower()
            if "text/html" not in content_type:
                raise ValueError("Reference URL did not return an HTML page")
            data = bytearray()
            for chunk in response.iter_bytes():
                data.extend(chunk)
                if len(data) > MAX_HTML_BYTES:
                    raise ValueError("Reference web page exceeds 2 MB")

    parser = _ReadableHTML()
    parser.feed(data.decode("utf-8", errors="replace"))
    title = " ".join(parser.title_parts).strip() or urlsplit(url).hostname
    entries = [{
        "source_type": "website",
        "source_title": title,
        "reference_id": None,
        "page_number": None,
        "url": url,
        "passage": passage,
    } for passage in _passages(" ".join(parser.parts))]
    return _rank(claim, entries, limit)
