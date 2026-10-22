"""Lightweight, page-aware PDF evidence indexing for Ask Inglis.

Indexes embedded PDF text into a separate SQLite FTS5 database.
No OCR, LLM calls, or network access are performed here.

Reference IDs and professor IDs must originate from authenticated backend
records; callers must verify ownership before invoking index_reference_pdf.
"""

from __future__ import annotations

import re
import sqlite3
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import pymupdf

BACKEND_DIR = Path(__file__).resolve().parents[2]
INDEX_DB_PATH = BACKEND_DIR / "reference_index.sqlite3"
CHUNK_TARGET_CHARS = 1000
CHUNK_OVERLAP_CHARS = 150
MAX_CHUNKS_PER_PAGE = 100


def _connect(db_path: Path = INDEX_DB_PATH) -> sqlite3.Connection:
    connection = sqlite3.connect(str(db_path), timeout=30)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA busy_timeout = 30000")
    return connection


def initialize_reference_index(db_path: Path = INDEX_DB_PATH) -> None:
    """Create the index schema (requires SQLite built with FTS5)."""
    with _connect(db_path) as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS indexed_references (
                reference_id TEXT PRIMARY KEY,
                professor_id INTEGER NOT NULL,
                source_title TEXT NOT NULL,
                source_filename TEXT NOT NULL,
                total_pages INTEGER NOT NULL,
                pages_with_text INTEGER NOT NULL,
                pages_without_text INTEGER NOT NULL,
                chunk_count INTEGER NOT NULL,
                indexed_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS reference_chunks (
                id INTEGER PRIMARY KEY,
                reference_id TEXT NOT NULL,
                professor_id INTEGER NOT NULL,
                page_number INTEGER NOT NULL,
                chunk_number INTEGER NOT NULL,
                passage TEXT NOT NULL,
                FOREIGN KEY(reference_id) REFERENCES indexed_references(reference_id)
                    ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS ix_reference_chunks_owner
                ON reference_chunks(professor_id, reference_id, page_number);
            CREATE VIRTUAL TABLE IF NOT EXISTS reference_chunks_fts USING fts5(
                passage, content='reference_chunks', content_rowid='id',
                tokenize='unicode61'
            );
            CREATE TRIGGER IF NOT EXISTS reference_chunks_ai AFTER INSERT ON reference_chunks BEGIN
                INSERT INTO reference_chunks_fts(rowid, passage) VALUES (new.id, new.passage);
            END;
            CREATE TRIGGER IF NOT EXISTS reference_chunks_ad AFTER DELETE ON reference_chunks BEGIN
                INSERT INTO reference_chunks_fts(reference_chunks_fts, rowid, passage)
                VALUES('delete', old.id, old.passage);
            END;
            CREATE TRIGGER IF NOT EXISTS reference_chunks_au AFTER UPDATE ON reference_chunks BEGIN
                INSERT INTO reference_chunks_fts(reference_chunks_fts, rowid, passage)
                VALUES('delete', old.id, old.passage);
                INSERT INTO reference_chunks_fts(rowid, passage) VALUES(new.id, new.passage);
            END;
            """
        )


def _chunks(text: str) -> list[str]:
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    result = []
    position = 0
    while position < len(text) and len(result) < MAX_CHUNKS_PER_PAGE:
        end = min(position + CHUNK_TARGET_CHARS, len(text))
        if end < len(text):
            last_break = text.rfind(" ", position + CHUNK_TARGET_CHARS // 2, end)
            if last_break > position:
                end = last_break
        passage = text[position:end].strip()
        if passage:
            result.append(passage)
        if end >= len(text):
            break
        position = max(position + 1, end - CHUNK_OVERLAP_CHARS)
    return result


def index_reference_pdf(
    *,
    reference_id: str,
    professor_id: int,
    pdf_path: str | Path,
    source_title: str | None = None,
    db_path: Path = INDEX_DB_PATH,
) -> dict:
    """Index an authorized reference PDF and return indexing statistics.

    The original index stays intact if parsing fails. A successful run atomically
    replaces the existing rows for this reference. No extracted PDF text is logged.
    """
    if not reference_id or not str(reference_id).strip():
        raise ValueError("reference_id is required")
    if not isinstance(professor_id, int) or professor_id <= 0:
        raise ValueError("professor_id must be a positive integer")
    path = Path(pdf_path).resolve(strict=True)
    if not path.is_file() or path.suffix.lower() != ".pdf":
        raise ValueError("Expected an existing PDF file")
    title = (source_title or path.name).strip()
    if not title:
        raise ValueError("source_title must not be empty")

    initialize_reference_index(db_path)
    total_pages = 0
    pages_with_text = 0
    pages_without_text = 0
    # Use a disk-based staging database to avoid accumulating the entire book in RAM.
    with tempfile.TemporaryDirectory(prefix="anatomy_ref_index_") as temp_dir:
        staging_path = Path(temp_dir) / "chunks.sqlite3"
        with sqlite3.connect(staging_path) as staging:
            staging.execute(
                "CREATE TABLE staged_chunks (page_number INTEGER, chunk_number INTEGER, passage TEXT)"
            )
            with pymupdf.open(str(path)) as document:
                if not document.is_pdf:
                    raise ValueError("File is not a valid PDF")
                total_pages = len(document)
                for page_index in range(total_pages):
                    text = document.load_page(page_index).get_text("text", sort=True)
                    passages = _chunks(text)
                    if not passages:
                        pages_without_text += 1
                        continue
                    pages_with_text += 1
                    staging.executemany(
                        "INSERT INTO staged_chunks VALUES (?, ?, ?)",
                        ((page_index + 1, i + 1, passage) for i, passage in enumerate(passages)),
                    )
            chunk_count = staging.execute("SELECT COUNT(*) FROM staged_chunks").fetchone()[0]
            with _connect(db_path) as db:
                db.execute("BEGIN IMMEDIATE")
                db.execute("DELETE FROM indexed_references WHERE reference_id = ?", (reference_id,))
                db.execute(
                    """INSERT INTO indexed_references
                    (reference_id, professor_id, source_title, source_filename,
                     total_pages, pages_with_text, pages_without_text, chunk_count, indexed_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        reference_id, professor_id, title, path.name,
                        total_pages, pages_with_text, pages_without_text,
                        chunk_count, datetime.now(timezone.utc).isoformat(),
                    ),
                )
                cursor = staging.execute(
                    "SELECT page_number, chunk_number, passage FROM staged_chunks ORDER BY page_number, chunk_number"
                )
                while batch := cursor.fetchmany(200):
                    db.executemany(
                        """INSERT INTO reference_chunks
                        (reference_id, professor_id, page_number, chunk_number, passage)
                        VALUES (?, ?, ?, ?, ?)""",
                        ((reference_id, professor_id, *item) for item in batch),
                    )
    return {
        "reference_id": reference_id,
        "source_title": title,
        "total_pages": total_pages,
        "pages_with_text": pages_with_text,
        "pages_without_text": pages_without_text,
        "chunks_indexed": chunk_count,
        "processing_status": "indexed" if chunk_count else "no_extractable_text",
        "note": "Page numbers represent PDF physical pages, not necessarily printed page labels.",
    }


# Anatomical term equivalences are used ONLY for finding candidate passages.
# They never establish that a claim is true or false.
_SEARCH_ALIASES = {
    "atlas": ("c1", "first cervical", "first cervical vertebra"),
    "axis": ("c2", "second cervical", "second cervical vertebra"),
    "c1": ("atlas", "first cervical"),
    "c2": ("axis", "second cervical"),
    "vertebra": ("vertebrae", "vertebral"),
    "vertebrae": ("vertebra", "vertebral"),
    "intervertebral": ("disc", "disk"),
    "disc": ("disk", "intervertebral"),
    "disk": ("disc", "intervertebral"),
}
_SEARCH_STOPWORDS = {
    "the", "and", "are", "was", "were", "with", "from", "that", "this",
    "into", "such", "they", "their", "there", "which", "through", "between",
    "have", "has", "had", "can", "not", "does", "about", "involved",
    "participate", "participates", "is", "as", "of", "to", "in", "on", "a",
    "an", "or", "at", "by", "for", "it", "its", "be", "part", "parts",
    "first", "second",  # handled by multiword phrases and alias expansion
}


def _search_tokens(query: str) -> list[str]:
    """Select informative tokens, including C1/C2 (which are only 2 chars)."""
    tokens = re.findall(r"[\w]+", query.lower(), flags=re.UNICODE)
    return list(dict.fromkeys(
        token for token in tokens
        if (len(token) >= 3 or re.fullmatch(r"c[1-7]", token))
        and token not in _SEARCH_STOPWORDS
    ))[:12]


def _search_phrases(query: str, tokens: list[str]) -> list[str]:
    phrases = list(tokens)
    for token in tokens:
        phrases.extend(_SEARCH_ALIASES.get(token, ()))
    lower = query.lower()
    if "first cervical" in lower:
        phrases.extend(("atlas", "c1", "first cervical"))
    if "second cervical" in lower:
        phrases.extend(("axis", "c2", "second cervical"))
    return list(dict.fromkeys(phrases))[:32]


def _fts_phrase(term: str) -> str:
    """Quote every term so user input cannot become FTS query syntax."""
    return '"' + term.replace('"', '""') + '"'


def _relevance_score(passage: str, tokens: list[str], phrases: list[str]) -> float:
    """Rank candidate text, but never interpret ranking as factual support."""
    lower = passage.lower()
    words = set(re.findall(r"[\w]+", lower, flags=re.UNICODE))
    matching_tokens = sum(token in words for token in tokens)
    score = 8.0 * matching_tokens / max(len(tokens), 1)
    # A passage matching multiple distinct claim concepts is preferable to a
    # general passage which repeats just one common term many times.
    if len(tokens) > 1:
        score += 4.0 * matching_tokens / len(tokens)
    for phrase in phrases:
        if " " in phrase and phrase in lower:
            score += 1.0
    # Identity passages mentioning BOTH terms may be unusually useful when
    # distinguishing the atlas from the axis. This is retrieval ranking only.
    if {"atlas", "axis"}.issubset(set(tokens)) and {"atlas", "axis"}.issubset(words):
        score += 2.0
    return score


def search_reference_passages(
    *,
    professor_id: int,
    query: str,
    limit: int = 5,
    db_path: Path = INDEX_DB_PATH,
) -> list[dict]:
    """Search only this professor's indexed PDF text, returning real citations.

    Retrieves a wider FTS candidate pool, then reranks by coverage of claim
    concepts and anatomy synonyms. Synonyms improve retrieval but are never
    shown as evidence and never used to assert correctness. All returned text
    is taken verbatim from the indexed PDF. Existing FTS schema is unchanged.
    """
    if not isinstance(professor_id, int) or professor_id <= 0:
        raise ValueError("professor_id must be positive")
    if not isinstance(query, str):
        raise ValueError("query must be a string")
    tokens = _search_tokens(query)
    if not tokens:
        return []
    phrases = _search_phrases(query, tokens)
    match_query = " OR ".join(_fts_phrase(item) for item in phrases)
    result_limit = max(1, min(limit, 20))
    candidate_limit = min(250, max(80, result_limit * 15))
    initialize_reference_index(db_path)
    with _connect(db_path) as db:
        rows = db.execute(
            """SELECT c.id, c.reference_id, c.page_number, c.chunk_number,
                      c.passage, r.source_title, r.source_filename,
                      bm25(reference_chunks_fts) AS rank
               FROM reference_chunks_fts
               JOIN reference_chunks c ON c.id = reference_chunks_fts.rowid
               JOIN indexed_references r ON r.reference_id = c.reference_id
               WHERE reference_chunks_fts MATCH ?
                 AND c.professor_id = ?
                 AND r.professor_id = ?
               ORDER BY rank LIMIT ?""",
            (match_query, professor_id, professor_id, candidate_limit),
        ).fetchall()

    # Primarily rank by coverage of the claim's original concepts; use FTS
    # rank as a tie-breaker. This cannot guarantee a relevant source exists.
    ranked = sorted(
        rows,
        key=lambda row: (
            -_relevance_score(row["passage"], tokens, phrases),
            row["rank"],
            row["id"],
        ),
    )
    return [
        {
            "passage_id": f"PDF-{row['id']}",
            "reference_id": row["reference_id"],
            "title": row["source_title"],
            "filename": row["source_filename"],
            "pdf_page": row["page_number"],
            "chunk_number": row["chunk_number"],
            "evidence_text": row["passage"],
        }
        for row in ranked[:result_limit]
    ]


def delete_reference_index(
    *, reference_id: str, professor_id: int, db_path: Path = INDEX_DB_PATH
) -> bool:
    """Remove indexed passages only for a reference owned by this professor."""
    initialize_reference_index(db_path)
    with _connect(db_path) as db:
        deleted = db.execute(
            "DELETE FROM indexed_references WHERE reference_id = ? AND professor_id = ?",
            (reference_id, professor_id),
        ).rowcount
    return bool(deleted)
