"""Non-destructive, conservative reviewed-lecture PDF generation.

This service does NOT decide which corrections are academically approved.
The authenticated API must verify document ownership and supply ONLY corrections
explicitly approved by the professor. Each correction replaces the exact original
claim once. Ambiguous, missing, or unplaceable corrections fail closed.

DOCX inputs require LibreOffice for conversion. PDF inputs use PyMuPDF to redact
and replace matched text in its original rectangle. That can only accommodate
short corrections; a longer replacement fails rather than overflow nearby text.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os
import shutil
import subprocess
import tempfile
from typing import Iterable


class ReviewedPDFError(ValueError):
    """The source or approved changes cannot be exported safely."""


@dataclass(frozen=True)
class ApprovedCorrection:
    claim_id: int
    original_text: str
    corrected_text: str
    page: int | None = None  # 1-based PDF physical page; optional for DOCX


def _validate(items: Iterable[ApprovedCorrection]) -> list[ApprovedCorrection]:
    corrections = list(items)
    if len(corrections) > 500:
        raise ReviewedPDFError("Too many approved corrections in one export")
    seen = set()
    for c in corrections:
        if not isinstance(c, ApprovedCorrection):
            raise ReviewedPDFError("Corrections must be ApprovedCorrection objects")
        if not c.original_text or not c.original_text.strip():
            raise ReviewedPDFError(f"Claim {c.claim_id}: original text is empty")
        if not c.corrected_text or not c.corrected_text.strip():
            raise ReviewedPDFError(f"Claim {c.claim_id}: approved correction is empty")
        if c.original_text == c.corrected_text:
            raise ReviewedPDFError(f"Claim {c.claim_id}: correction is unchanged")
        if c.claim_id in seen:
            raise ReviewedPDFError(f"Duplicate correction for claim {c.claim_id}")
        if c.page is not None and c.page < 1:
            raise ReviewedPDFError(f"Claim {c.claim_id}: page must be 1-based")
        seen.add(c.claim_id)
    return corrections


def _docx_paragraphs(document):
    """Traverse top-level paragraphs, table cells and nested table content."""
    from docx.table import Table
    from docx.text.paragraph import Paragraph

    def walk(container):
        for item in container.iter_inner_content():
            if isinstance(item, Paragraph):
                yield item
            elif isinstance(item, Table):
                for row in item.rows:
                    for cell in row.cells:
                        yield from walk(cell)

    yield from walk(document)
    for section in document.sections:
        yield from walk(section.header)
        yield from walk(section.footer)


def _replace_docx(source: Path, target: Path, corrections: list[ApprovedCorrection]):
    from docx import Document

    doc = Document(str(source))
    paragraphs = list(_docx_paragraphs(doc))
    for correction in corrections:
        matches = [p for p in paragraphs if correction.original_text in p.text]
        occurrence_count = sum(p.text.count(correction.original_text) for p in matches)
        if occurrence_count != 1:
            raise ReviewedPDFError(
                f"Claim {correction.claim_id}: found {occurrence_count} exact matches in DOCX; "
                "expected exactly one. No file was exported."
            )
        paragraph = matches[0]
        runs = list(paragraph.runs)
        if not runs:
            raise ReviewedPDFError(f"Claim {correction.claim_id}: text is not in editable runs")
        combined = "".join(run.text for run in runs)
        start = combined.find(correction.original_text)
        if start < 0:
            raise ReviewedPDFError(
                f"Claim {correction.claim_id}: text spans unsupported document constructs"
            )
        end = start + len(correction.original_text)
        position = 0
        inserted = False
        for run in runs:
            text = run.text
            next_pos = position + len(text)
            if next_pos <= start or position >= end:
                position = next_pos
                continue
            prefix = text[: max(0, start - position)]
            suffix = text[max(0, end - position):]
            if not inserted:
                run.text = prefix + correction.corrected_text + suffix
                inserted = True
            else:
                run.text = prefix + suffix
            position = next_pos
    doc.save(str(target))


def _find_soffice() -> str | None:
    env = os.environ.get("LIBREOFFICE_BIN", "").strip()
    candidates = [env] if env else []
    candidates.extend([
        shutil.which("libreoffice"),
        shutil.which("soffice"),
        "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    ])
    return next((str(x) for x in candidates if x and Path(x).is_file()), None)


def _convert_docx_to_pdf(source_docx: Path, output_dir: Path) -> Path:
    soffice = _find_soffice()
    if soffice is None:
        raise ReviewedPDFError(
            "DOCX-to-PDF conversion requires LibreOffice. Install it or set LIBREOFFICE_BIN."
        )
    profile = output_dir / "lo_profile"
    command = [
        soffice,
        f"-env:UserInstallation={profile.as_uri()}",
        "--headless", "--convert-to", "pdf:writer_pdf_Export",
        "--outdir", str(output_dir), str(source_docx),
    ]
    try:
        result = subprocess.run(command, text=True, capture_output=True, timeout=120, check=False)
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise ReviewedPDFError("DOCX-to-PDF conversion could not complete") from exc
    pdf_path = output_dir / (source_docx.stem + ".pdf")
    if result.returncode or not pdf_path.is_file() or not pdf_path.stat().st_size:
        raise ReviewedPDFError("LibreOffice PDF conversion failed: " + result.stderr[-400:])
    return pdf_path


def _replace_pdf(source: Path, target: Path, corrections: list[ApprovedCorrection]):
    import fitz

    with fitz.open(str(source)) as doc:
        if doc.needs_pass:
            raise ReviewedPDFError("Encrypted PDF cannot be edited")
        for correction in corrections:
            matches = []
            indices = (
                [correction.page - 1]
                if correction.page is not None
                else range(len(doc))
            )
            for page_idx in indices:
                if page_idx >= len(doc):
                    raise ReviewedPDFError(f"Claim {correction.claim_id}: page out of range")
                for rect in doc[page_idx].search_for(correction.original_text):
                    matches.append((page_idx, rect))
            if len(matches) != 1:
                raise ReviewedPDFError(
                    f"Claim {correction.claim_id}: PDF has {len(matches)} text matches; "
                    "expected exactly one. Scanned PDFs and multi-line matches may not be editable."
                )
            page_idx, rect = matches[0]
            page = doc[page_idx]
            # A redaction replaces only the matched text area. Formatting can change;
            # the small inset prevents overlap with nearby text but limits capacity.
            rect = fitz.Rect(rect)
            fontsize = min(10.0, max(6.0, rect.height * 0.65))
            # Reject replacements that cannot fit without spilling over adjacent text.
            text_width = fitz.get_text_length(
                correction.corrected_text, fontname="helv", fontsize=fontsize
            )
            if text_width > rect.width:
                raise ReviewedPDFError(
                    f"Claim {correction.claim_id}: approved correction is too long "
                    "for the original PDF text area. Use a DOCX source or manual re-layout."
                )
            page.add_redact_annot(rect, fill=(1, 1, 1))
            page.apply_redactions(images=0, graphics=0)
            result = page.insert_textbox(
                rect, correction.corrected_text, fontsize=fontsize,
                fontname="helv", color=(0, 0, 0), align=0,
            )
            if result < 0:
                raise ReviewedPDFError(
                    f"Claim {correction.claim_id}: correction does not fit PDF text area"
                )
        doc.save(str(target), garbage=4, deflate=True)


def generate_reviewed_pdf(
    original_path: str | Path,
    output_path: str | Path,
    corrections: Iterable[ApprovedCorrection],
) -> Path:
    """Create a separate reviewed PDF; never modify the original.

    IMPORTANT: Caller MUST authenticate, verify document ownership, and select
    only professor-approved, independently supported factual corrections.
    The service checks for one exact placement; it does not infer approval.
    """
    source = Path(original_path).resolve(strict=True)
    destination = Path(output_path).resolve()
    if source == destination:
        raise ReviewedPDFError("Output path must differ from original document")
    if not source.is_file() or source.suffix.lower() not in {".docx", ".pdf"}:
        raise ReviewedPDFError("Original document must be a PDF or DOCX file")
    if destination.suffix.lower() != ".pdf":
        raise ReviewedPDFError("Output must have a .pdf extension")
    approved = _validate(corrections)
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        raise ReviewedPDFError("Reviewed PDF already exists; choose a new output filename")
    with tempfile.TemporaryDirectory(prefix="reviewed_lecture_") as temp_name:
        temp_dir = Path(temp_name)
        temporary_output = temp_dir / "reviewed_result.pdf"
        if source.suffix.lower() == ".pdf":
            _replace_pdf(source, temporary_output, approved)
        else:
            edited_docx = temp_dir / "reviewed_source.docx"
            _replace_docx(source, edited_docx, approved)
            converted_pdf = _convert_docx_to_pdf(edited_docx, temp_dir)
            shutil.copyfile(converted_pdf, temporary_output)
        if not temporary_output.is_file() or temporary_output.stat().st_size == 0:
            raise ReviewedPDFError("Reviewed PDF generation produced no output")
        # Exclusive create avoids overwriting an existing reviewed export.
        with destination.open("xb") as handle, temporary_output.open("rb") as pdf:
            shutil.copyfileobj(pdf, handle)
    return destination
