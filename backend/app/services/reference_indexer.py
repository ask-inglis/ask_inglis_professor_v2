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


def search_reference_passages(
    *,
    professor_id: int,
    query: str,
    limit: int = 5,
    db_path: Path = INDEX_DB_PATH,
) -> list[dict]:
    """Return actual indexed passages with page citations (no fabricated sources)."""
    if professor_id <= 0:
        raise ValueError("professor_id must be positive")
    terms = re.findall(r"[\w]+", query, flags=re.UNICODE)
    terms = [term for term in terms if len(term) >= 3][:12]
    if not terms:
        return []
    initialize_reference_index(db_path)
    # Quoted tokens prevent FTS syntax injection. OR is tolerant of anatomy prose.
    match_query = " OR ".join('"' + term.replace('"', '""') + '"' for term in terms)
    with _connect(db_path) as db:
        rows = db.execute(
            """SELECT c.id, c.reference_id, c.page_number, c.chunk_number,
                      c.passage, r.source_title, r.source_filename,
                      bm25(reference_chunks_fts) AS rank
               FROM reference_chunks_fts
               JOIN reference_chunks c ON c.id = reference_chunks_fts.rowid
               JOIN indexed_references r ON r.reference_id = c.reference_id
               WHERE reference_chunks_fts MATCH ? AND c.professor_id = ?
               ORDER BY rank LIMIT ?""",
            (match_query, professor_id, max(1, min(limit, 20))),
        ).fetchall()
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
        for row in rows
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
