from datetime import datetime

from uuid import UUID, uuid4

import json

from pathlib import Path

import shutil
import tempfile

from fastapi import (

    Depends,

    FastAPI,

    File,

    HTTPException,

    Query,

    UploadFile,

)

from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from fastapi.middleware.cors import CORSMiddleware

from fastapi.security import (

    HTTPAuthorizationCredentials,

    HTTPBearer,

)

from pydantic import BaseModel, Field

from sqlalchemy import delete, select

from sqlalchemy.orm import Session

from app.services.reviewed_pdf_generator import (
    ApprovedCorrection,
    ReviewedPDFError,
    generate_reviewed_pdf,
)

from app.services.reference_indexer import (

    index_reference_pdf,

    search_reference_passages,

    delete_reference_index,

)

from app.database import get_db

from app.models import (

    Claim,

    ClaimSource,

    Course,

    Document,

    Professor,

)

from app.security import (

    create_access_token,

    decode_access_token,

    verify_password,

)

from app.services.claim_extractor import (

    extract_claims,

)

from app.services.document_parser import (

    extract_document_text,

)

from app.services.providers.bullsai_provider import (

    review_anatomy_claim,

    review_anatomy_claims,

)

#*** ---------------------------------------------------------***

#*** APPLICATION***

#*** ---------------------------------------------------------***

app = FastAPI(

    title="Anatomy AI Backend"

)

#*** ---------------------------------------------------------***

#*** CORS***

#*** ---------------------------------------------------------***

app.add_middleware(

    CORSMiddleware,

    allow_origins=[

        "http://localhost:5173",

        "http://localhost:5174",

        "http://127.0.0.1:5173",

        "http://127.0.0.1:5174",

    ],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],

)

#*** ---------------------------------------------------------***

#*** FILE STORAGE***

#*** ---------------------------------------------------------***

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

#*** ---------------------------------------------------------***

#*** SECURITY***

#*** ---------------------------------------------------------***

security = HTTPBearer()

#*** ---------------------------------------------------------***

#*** REQUEST MODELS***

#*** ---------------------------------------------------------***

class ProfessorLoginRequest(BaseModel):

    email: str

    password: str

class ClaimReviewRequest(BaseModel):

    claim: str

class BatchClaim(BaseModel):

    claim_id: int

    text: str

class BatchClaimReviewRequest(BaseModel):

    claims: list[BatchClaim] = Field(

        min_length=1,

        max_length=10,

    )

class ClaimDecisionRequest(BaseModel):

    decision: str

    professor_correction: str | None = None

#*** ---------------------------------------------------------***

#*** AUTHENTICATION DEPENDENCY***

#*** ---------------------------------------------------------***

def get_current_professor(

    credentials: HTTPAuthorizationCredentials = Depends(

        security

    ),

    db: Session = Depends(get_db),

):

    token = credentials.credentials

    try:

        payload = decode_access_token(

            token

        )

    except ValueError:

        raise HTTPException(

            status_code=401,

            detail=(

                "Invalid or expired access token"

            ),

        )

    professor_id = payload.get(

        "sub"

    )

    if not professor_id:

        raise HTTPException(

            status_code=401,

            detail="Invalid access token",

        )

    try:

        professor_id = int(

            professor_id

        )

    except (ValueError, TypeError):

        raise HTTPException(

            status_code=401,

            detail="Invalid access token",

        )

    professor = db.get(

        Professor,

        professor_id,

    )

    if professor is None:

        raise HTTPException(

            status_code=401,

            detail=(

                "Professor account not found"

            ),

        )

    return professor

#*** ---------------------------------------------------------***

#*** HELPER:***

#*** CONVERT AI SOURCES TO JSON***

#*** ---------------------------------------------------------***

def serialize_sources(

    sources,

) -> list[dict]:

    serialized = []

    for source in sources or []:

        serialized.append(

            {

                "title": source.title,

                "url": source.url,

                "evidence_text": getattr(source, "evidence_text", None),

                "passage_id": getattr(source, "passage_id", None),

                "pdf_page": getattr(source, "pdf_page", None),

                "reference_id": getattr(source, "reference_id", None),

                "evidence_quality": getattr(source, "evidence_quality", "insufficient_evidence"),

            }

        )

    return serialized

#* Existing ClaimSource records have only title, URL, and evidence_text.*

#* Keep the current database schema by persisting evidence-quality metadata*

#* in a readable prefix and recovering it for API responses.*

EVIDENCE_QUALITIES = {

    "direct_support",

    "contradiction",

    "background_context",

    "insufficient_evidence",

}





def serialize_saved_source(source: ClaimSource) -> dict:

    text = source.evidence_text or ""

    quality = None

    prefix = "Evidence quality: "

    if text.startswith(prefix):

        first_line, separator, remainder = text.partition("\n")

        candidate = first_line[len(prefix):].strip().rstrip(".")

        if candidate in EVIDENCE_QUALITIES:

            quality = candidate

            text = remainder if separator else ""

    return {

        "id": source.id,

        "title": source.source_title,

        "url": source.source_url,

        "evidence_text": text,

        "evidence_quality": quality,

    }





#*** ---------------------------------------------------------***

#*** HELPER:***

#*** VERIFY CLAIM OWNERSHIP***

#*** ---------------------------------------------------------***

def verify_claim_ownership(

    claim: Claim,

    professor: Professor,

):

    if (

        claim.document is None

        or

        claim.document.course is None

        or

        claim.document.course.professor_id

        != professor.id

    ):

        raise HTTPException(

            status_code=403,

            detail=(

                "You do not have permission "

                "to access this claim"

            ),

        )

#*** ---------------------------------------------------------***

#*** HELPER:***

#*** VERIFY DOCUMENT OWNERSHIP***

#*** ---------------------------------------------------------***

def verify_document_ownership(

    document: Document,

    professor: Professor,

):

    if (

        document.course is None

        or

        document.course.professor_id

        != professor.id

    ):

        raise HTTPException(

            status_code=403,

            detail=(

                "You do not have permission "

                "to access this document"

            ),

        )

#*** ---------------------------------------------------------***

#*** ROOT***

#*** ---------------------------------------------------------***

@app.get("/")

def root():

    return {

        "message":

            "Anatomy AI backend is running"

    }

#*** ---------------------------------------------------------***

#*** PROFESSOR LOGIN***

#*** ---------------------------------------------------------***

@app.post("/professor/login")

def professor_login(

    request: ProfessorLoginRequest,

    db: Session = Depends(get_db),

):

    email = (

        request.email

        .strip()

        .lower()

    )

    password = request.password

    if not email or not password:

        raise HTTPException(

            status_code=400,

            detail=(

                "Email and password are required"

            ),

        )

    professor = db.scalar(

        select(

            Professor

        ).where(

            Professor.email == email

        )

    )

    if professor is None:

        raise HTTPException(

            status_code=401,

            detail=(

                "Invalid email or password"

            ),

        )

    if not verify_password(

        password,

        professor.password_hash,

    ):

        raise HTTPException(

            status_code=401,

            detail=(

                "Invalid email or password"

            ),

        )

    access_token = create_access_token(

        professor_id=professor.id,

        email=professor.email,

    )

    return {

        "message":

            "Login successful",

        "access_token":

            access_token,

        "token_type":

            "bearer",

        "professor": {

            "id":

                professor.id,

            "email":

                professor.email,

        },

    }

#*** ---------------------------------------------------------***

#*** CURRENT PROFESSOR***

#*** ---------------------------------------------------------***

@app.get("/professor/me")

def professor_me(

    professor: Professor = Depends(

        get_current_professor

    ),

):

    return {

        "id":

            professor.id,

        "email":

            professor.email,

    }

#*** ---------------------------------------------------------***

#*** DOCUMENT UPLOAD***

#*** PROFESSOR ONLY***

#*** ---------------------------------------------------------***

@app.post("/upload")

async def upload_document(

    file: UploadFile = File(...),

    professor: Professor = Depends(

        get_current_professor

    ),

):

    if not file.filename:

        raise HTTPException(

            status_code=400,

            detail=(

                "No file name provided"

            ),

        )

    extension = Path(

        file.filename

    ).suffix.lower()

    if extension not in {

        ".docx",

        ".pdf",

    }:

        raise HTTPException(

            status_code=400,

            detail=(

                "Only DOCX and PDF files "

                "are supported"

            ),

        )

    file_path = UPLOAD_DIR / f"{uuid4().hex}{extension}"

    try:

        with file_path.open(

            "wb"

        ) as buffer:

            shutil.copyfileobj(

                file.file,

                buffer,

            )

        extracted_text = (

            extract_document_text(

                str(file_path)

            )

        )

        return {

            "filename":

                file.filename,

            "file_type":

                extension,

            "characters_extracted":

                len(

                    extracted_text

                ),

            "text":

                extracted_text,

        }

    except ValueError as error:

        raise HTTPException(

            status_code=400,

            detail=str(error),

        )

    except Exception as error:

        raise HTTPException(

            status_code=500,

            detail=(

                "Failed to process document: "

                f"{str(error)}"

            ),

        )

    finally:

        await file.close()

        file_path.unlink(missing_ok=True)

#*** ---------------------------------------------------------***

#*** CLAIM EXTRACTION + DATABASE PERSISTENCE***

#*** PROFESSOR ONLY***

#*** ---------------------------------------------------------***

@app.post("/analyze-claims")

async def analyze_claims(

    file: UploadFile = File(...),

    professor: Professor = Depends(

        get_current_professor

    ),

    db: Session = Depends(get_db),

):

    if not file.filename:

        raise HTTPException(

            status_code=400,

            detail=(

                "No file name provided"

            ),

        )

    extension = Path(

        file.filename

    ).suffix.lower()

    if extension not in {

        ".docx",

        ".pdf",

    }:

        raise HTTPException(

            status_code=400,

            detail=(

                "Only DOCX and PDF files "

                "are supported"

            ),

        )

    course = db.scalar(

        select(

            Course

        )

        .where(

            Course.professor_id

            == professor.id

        )

        .order_by(

            Course.id

        )

    )

    if course is None:

        raise HTTPException(

            status_code=404,

            detail=(

                "No course found for this professor"

            ),

        )

    file_path = UPLOAD_DIR / f"{uuid4().hex}{extension}"

    try:

        with file_path.open(

            "wb"

        ) as buffer:

            shutil.copyfileobj(

                file.file,

                buffer,

            )

        extracted_text = (

            extract_document_text(

                str(file_path)

            )

        )

        extracted_claims = (

            extract_claims(

                extracted_text

            )

        )

        document = Document(

            filename=file.filename,

            stored_path=str(

                file_path

            ),

            file_type=extension,

            course_id=course.id,

        )

        db.add(

            document

        )

        db.flush()

        saved_claims = []

        for extracted_claim in extracted_claims:

            claim = Claim(

                claim_number=(

                    extracted_claim[

                        "claim_id"

                    ]

                ),

                text=(

                    extracted_claim[

                        "text"

                    ]

                ),

                page=(

                    extracted_claim.get(

                        "page"

                    )

                ),

                document_id=(

                    document.id

                ),

            )

            db.add(

                claim

            )

            saved_claims.append(

                claim

            )

        db.flush()

        response_claims = []

        for claim in saved_claims:

            response_claims.append(

                {

                    "id":

                        claim.id,

                    "claim_number":

                        claim.claim_number,

                    "page":

                        claim.page,

                    "text":

                        claim.text,

                    "ai_status":

                        claim.ai_status,

                    "ai_reason":

                        claim.ai_reason,

                    "suggested_correction":

                        claim.suggested_correction,

                    "sources":

                        [],

                    "instructor_decision":

                        claim.instructor_decision,

                    "professor_correction":

                        claim.professor_correction,

                    "reviewed_at":

                        claim.reviewed_at,

                }

            )

        db.commit()

        return {

            "message":

                "Document analyzed and claims saved",

            "course": {

                "id":

                    course.id,

                "name":

                    course.name,

                "code":

                    course.code,

            },

            "document_id":

                document.id,

            "filename":

                file.filename,

            "file_type":

                extension,

            "total_claims":

                len(

                    response_claims

                ),

            "claims":

                response_claims,

        }

    except HTTPException:

        db.rollback()

        raise

    except ValueError as error:

        db.rollback()

        raise HTTPException(

            status_code=400,

            detail=str(error),

        )

    except Exception as error:

        db.rollback()

        raise HTTPException(

            status_code=500,

            detail=(

                "Failed to analyze document: "

                f"{str(error)}"

            ),

        )

    finally:

        await file.close()

#*** ---------------------------------------------------------***

#*** LIST PROFESSOR DOCUMENTS***

#*** PROFESSOR ONLY***

#*** ---------------------------------------------------------***

@app.get("/documents")

def list_documents(

    professor: Professor = Depends(

        get_current_professor

    ),

    db: Session = Depends(get_db),

):

    documents = db.scalars(

        select(

            Document

        )

        .join(

            Course

        )

        .where(

            Course.professor_id

            == professor.id

        )

        .order_by(

            Document.uploaded_at.desc()

        )

    ).all()

    return {

        "total_documents":

            len(

                documents

            ),

        "documents": [

            {

                "id":

                    document.id,

                "filename":

                    document.filename,

                "file_type":

                    document.file_type,

                "course_id":

                    document.course_id,

                "uploaded_at":

                    document.uploaded_at,

            }

            for document

            in documents

        ],

    }

#*** ---------------------------------------------------------***

#*** LOAD DOCUMENT CLAIMS***

#*** PROFESSOR ONLY***

#*** ---------------------------------------------------------***

@app.get(

    "/documents/{document_id}/claims"

)

def get_document_claims(

    document_id: int,

    professor: Professor = Depends(

        get_current_professor

    ),

    db: Session = Depends(get_db),

):

    document = db.get(

        Document,

        document_id,

    )

    if document is None:

        raise HTTPException(

            status_code=404,

            detail=(

                "Document not found"

            ),

        )

    verify_document_ownership(

        document,

        professor,

    )

    claims = db.scalars(

        select(

            Claim

        )

        .where(

            Claim.document_id

            == document.id

        )

        .order_by(

            Claim.claim_number

        )

    ).all()

    response_claims = []

    for claim in claims:

        sources = db.scalars(

            select(

                ClaimSource

            )

            .where(

                ClaimSource.claim_id

                == claim.id

            )

            .order_by(

                ClaimSource.id

            )

        ).all()

        response_claims.append(

            {

                "id":

                    claim.id,

                "claim_number":

                    claim.claim_number,

                "page":

                    claim.page,

                "text":

                    claim.text,

                "ai_status":

                    claim.ai_status,

                "ai_reason":

                    claim.ai_reason,

                "suggested_correction":

                    claim.suggested_correction,

                "sources": [serialize_saved_source(source) for source in sources],

                "instructor_decision":

                    claim.instructor_decision,

                "professor_correction":

                    claim.professor_correction,

                "reviewed_at":

                    claim.reviewed_at,

                "created_at":

                    claim.created_at,

                "updated_at":

                    claim.updated_at,

            }

        )

    return {

        "document": {

            "id":

                document.id,

            "filename":

                document.filename,

            "file_type":

                document.file_type,

            "course_id":

                document.course_id,

            "uploaded_at":

                document.uploaded_at,

        },

        "total_claims":

            len(

                response_claims

            ),

        "claims":

            response_claims,

    }

#*** ---------------------------------------------------------***

#*** DELETE DOCUMENT***

#*** PROFESSOR ONLY***

#*** ---------------------------------------------------------***

@app.delete(

    "/documents/{document_id}"

)

def delete_document(

    document_id: int,

    professor: Professor = Depends(

        get_current_professor

    ),

    db: Session = Depends(get_db),

):

    document = db.get(

        Document,

        document_id,

    )

    if document is None:

        raise HTTPException(

            status_code=404,

            detail=(

                "Document not found"

            ),

        )

    verify_document_ownership(

        document,

        professor,

    )

    filename = (

        document.filename

    )

    stored_path = Path(

        document.stored_path

    )

    try:

        #*** SQLAlchemy relationships are configured with***

        #*** delete-orphan cascade:***

        #

        #*** Document -> Claims***

        #*** Claim -> ClaimSource***

        #

        #*** Deleting the Document therefore removes the***

        #*** associated database review data as well.***

        db.delete(

            document

        )

        db.commit()

    except Exception as error:

        db.rollback()

        raise HTTPException(

            status_code=500,

            detail=(

                "Failed to delete document: "

                f"{str(error)}"

            ),

        )

    #*** Delete the stored file only after the database***

    #*** transaction succeeds.***

    #

    #*** Important:***

    #*** During current development several Document rows can***

    #*** reference the same physical filename. Therefore we***

    #*** only remove the file if no remaining Document row***

    #*** references the same stored path.***

    remaining_document = db.scalar(

        select(

            Document

        ).where(

            Document.stored_path

            == str(stored_path)

        )

    )

    file_deleted = False

    if (

        remaining_document is None

        and

        stored_path.exists()

        and

        stored_path.is_file()

    ):

        try:

            stored_path.unlink()

            file_deleted = True

        except OSError:

            #*** Database deletion succeeded.***

            #*** A physical-file cleanup failure should not***

            #*** recreate or corrupt the database records.***

            file_deleted = False

    return {

        "message":

            "Document deleted successfully",

        "document_id":

            document_id,

        "filename":

            filename,

        "stored_file_deleted":

            file_deleted,

    }

#*** ---------------------------------------------------------***

#*** AD-HOC SINGLE AI REVIEW***

#*** PROFESSOR ONLY***

#*** DOES NOT SAVE TO DATABASE***

#*** ---------------------------------------------------------***

def _retrieve_claim_evidence(professor_id: int, claim_text: str) -> list[dict]:

    """Search only this professor's indexed reference material.

    Search hits may be merely topically related, not supporting evidence.

    BullsAI must assess relevance and the professor makes the final decision.

    """

    return search_reference_passages(

        professor_id=professor_id,

        query=claim_text,

        limit=6,

    )

@app.post("/review-claim")

def review_claim(

    request: ClaimReviewRequest,

    professor: Professor = Depends(

        get_current_professor

    ),

):

    claim_text = (

        request.claim.strip()

    )

    if not claim_text:

        raise HTTPException(

            status_code=400,

            detail=(

                "Claim cannot be empty"

            ),

        )

    try:

        review = (

            review_anatomy_claim(

                claim_text,

                evidence=_retrieve_claim_evidence(professor.id, claim_text),

            )

        )

        return {

            "claim":

                claim_text,

            "status":

                review.status,

            "reason":

                review.reason,

            "suggested_correction":

                review.suggested_correction,

            "sources":

                serialize_sources(

                    review.sources

                ),

        }

    except Exception as error:

        error_message = str(

            error

        )

        if (

            "429" in error_message

            or

            "rate limit"

            in error_message

        ):

            raise HTTPException(

                status_code=429,

                detail=(

                    "BullsAI rate limit reached. "

                    "Please wait and try again."

                ),

            )

        raise HTTPException(

            status_code=500,

            detail=(

                "BullsAI review failed: "

                f"{error_message}"

            ),

        )

#*** ---------------------------------------------------------***

#*** PERSISTED CLAIM AI REVIEW***

#*** PROFESSOR ONLY***

#*** ---------------------------------------------------------***

@app.post(

    "/claims/{claim_id}/review"

)

def review_saved_claim(

    claim_id: int,

    professor: Professor = Depends(

        get_current_professor

    ),

    db: Session = Depends(get_db),

):

    claim = db.get(

        Claim,

        claim_id,

    )

    if claim is None:

        raise HTTPException(

            status_code=404,

            detail=(

                "Claim not found"

            ),

        )

    verify_claim_ownership(

        claim,

        professor,

    )

    try:

        review = (

            review_anatomy_claim(

                claim.text,

                evidence=_retrieve_claim_evidence(professor.id, claim.text),

            )

        )

        claim.ai_status = (

            review.status

        )

        claim.ai_reason = (

            review.reason

        )

        claim.suggested_correction = (

            review.suggested_correction

        )

        claim.updated_at = (

            datetime.utcnow()

        )

        db.execute(

            delete(

                ClaimSource

            ).where(

                ClaimSource.claim_id

                == claim.id

            )

        )

        for source in (

            review.sources or []

        ):

            claim_source = (

                ClaimSource(

                    claim_id=claim.id,

                    source_title=(

                        source.title

                        or

                        "External source"

                    ),

                    source_url=

                        source.url,

                    evidence_text=(

                        f"Evidence quality: {source.evidence_quality}.\n"

                        f"Passage {source.passage_id}, PDF page {source.pdf_page}. "

                        f"Reference ID: {source.reference_id}.\n"

                        f"{source.evidence_text or ''}"

                    ),

                )

            )

            db.add(

                claim_source

            )

        db.commit()

        db.refresh(

            claim

        )

        saved_sources = db.scalars(

            select(

                ClaimSource

            )

            .where(

                ClaimSource.claim_id

                == claim.id

            )

            .order_by(

                ClaimSource.id

            )

        ).all()

        return {

            "message":

                "AI review saved",

            "claim_id":

                claim.id,

            "claim_number":

                claim.claim_number,

            "claim":

                claim.text,

            "status":

                claim.ai_status,

            "reason":

                claim.ai_reason,

            "suggested_correction":

                claim.suggested_correction,

            "sources": [serialize_saved_source(source) for source in saved_sources],

        }

    except HTTPException:

        db.rollback()

        raise

    except Exception as error:

        db.rollback()

        error_message = str(

            error

        )

        if (

            "429" in error_message

            or

            "rate limit"

            in error_message

        ):

            raise HTTPException(

                status_code=429,

                detail=(

                    "BullsAI rate limit reached. "

                    "No AI review was saved. "

                    "Please wait and try again."

                ),

            )

        raise HTTPException(

            status_code=500,

            detail=(

                "Failed to review and save claim: "

                f"{error_message}"

            ),

        )

#*** ---------------------------------------------------------***

#*** AD-HOC BATCH AI REVIEW***

#*** PROFESSOR ONLY***

#*** CURRENTLY DOES NOT SAVE TO DATABASE***

#*** ---------------------------------------------------------***

@app.post("/review-claims")

def review_claims_batch(

    request: BatchClaimReviewRequest,

    professor: Professor = Depends(

        get_current_professor

    ),

):

    claims = []

    for claim in request.claims:

        text = (

            claim.text.strip()

        )

        if not text:

            raise HTTPException(

                status_code=400,

                detail=(

                    f"Claim {claim.claim_id} "

                    "cannot be empty"

                ),

            )

        claims.append(

            {

                "claim_id":

                    claim.claim_id,

                "text":

                    text,

                "evidence": _retrieve_claim_evidence(professor.id, text),

            }

        )

    try:

        result = (

            review_anatomy_claims(

                claims

            )

        )

        return {

            "total_reviews":

                len(

                    result.reviews

                ),

            "reviews": [

                {

                    "claim_id":

                        review.claim_id,

                    "status":

                        review.status,

                    "reason":

                        review.reason,

                    "suggested_correction":

                        review.suggested_correction,

                    "sources":

                        serialize_sources(

                            review.sources

                        ),

                }

                for review

                in result.reviews

            ],

        }

    except Exception as error:

        error_message = str(

            error

        )

        if (

            "429" in error_message

            or

            "rate limit"

            in error_message

        ):

            raise HTTPException(

                status_code=429,

                detail=(

                    "BullsAI rate limit reached. "

                    "Please wait and try again."

                ),

            )

        raise HTTPException(

            status_code=500,

            detail=(

                "BullsAI batch review failed: "

                f"{error_message}"

            ),

        )

#*** ---------------------------------------------------------***

#*** PROFESSOR CLAIM DECISION***

#*** PROFESSOR ONLY***

#*** ---------------------------------------------------------***

@app.patch(

    "/claims/{claim_id}/decision"

)

def update_claim_decision(

    claim_id: int,

    request: ClaimDecisionRequest,

    professor: Professor = Depends(

        get_current_professor

    ),

    db: Session = Depends(get_db),

):

    allowed_decisions = {

        "accepted",

        "rejected",

        "edited",

        "needs_review",

    }

    decision = (

        request.decision

        .strip()

        .lower()

    )

    if (

        decision

        not in

        allowed_decisions

    ):

        raise HTTPException(

            status_code=400,

            detail=(

                "Decision must be one of: "

                "accepted, rejected, edited, "

                "needs_review"

            ),

        )

    claim = db.get(

        Claim,

        claim_id,

    )

    if claim is None:

        raise HTTPException(

            status_code=404,

            detail=(

                "Claim not found"

            ),

        )

    verify_claim_ownership(

        claim,

        professor,

    )

    professor_correction = (

        request.professor_correction.strip()

        if request.professor_correction

        else None

    )

    if (

        decision == "edited"

        and

        not professor_correction

    ):

        raise HTTPException(

            status_code=400,

            detail=(

                "A professor correction is required "

                "when decision is edited"

            ),

        )

    if decision != "edited":

        professor_correction = None

    claim.instructor_decision = (

        decision

    )

    claim.professor_correction = (

        professor_correction

    )

    claim.reviewed_at = (

        datetime.utcnow()

    )

    claim.updated_at = (

        datetime.utcnow()

    )

    try:

        db.commit()

        db.refresh(

            claim

        )

    except Exception as error:

        db.rollback()

        raise HTTPException(

            status_code=500,

            detail=(

                "Failed to save professor decision: "

                f"{str(error)}"

            ),

        )

    return {

        "message":

            "Professor decision saved",

        "claim_id":

            claim.id,

        "decision":

            claim.instructor_decision,

        "professor_correction":

            claim.professor_correction,

        "reviewed_at":

            claim.reviewed_at,

    }


# ---------------------------------------------------------
# REVIEWED LECTURE PDF EXPORT - PROFESSOR ONLY
# ---------------------------------------------------------

@app.get("/documents/{document_id}/reviewed-pdf")
def download_reviewed_lecture_pdf(
    document_id: int,
    professor: Professor = Depends(get_current_professor),
    db: Session = Depends(get_db),
):
    """Create a separate PDF using only explicit professor-approved, evidenced corrections.

    This endpoint does not modify the original lecture or change claim decisions.
    Claims with no approved factual correction are retained as in the original.
    """
    document = db.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    verify_document_ownership(document, professor)

    # Existing legacy records may share a physical path because older uploads
    # used the client filename. It is unsafe to claim which file belongs to
    # which record once an upload has overwritten that path.
    shared_path_count = db.scalars(
        select(Document.id).where(Document.stored_path == document.stored_path)
    ).all()
    if len(shared_path_count) > 1:
        raise HTTPException(
            status_code=409,
            detail=(
                "This legacy lecture shares its stored file with another record. "
                "Re-upload the original lecture to generate a trustworthy PDF."
            ),
        )

    source = Path(document.stored_path).resolve()
    upload_root = UPLOAD_DIR.resolve()
    if not source.is_relative_to(upload_root) or not source.is_file():
        raise HTTPException(status_code=409, detail="Original lecture file is unavailable")
    if source.suffix.lower() not in {".pdf", ".docx"}:
        raise HTTPException(status_code=422, detail="Lecture must be PDF or DOCX")

    document_claims = db.scalars(
        select(Claim)
        .where(Claim.document_id == document.id)
        .order_by(Claim.claim_number, Claim.id)
    ).all()
    corrections = []
    for claim in document_claims:
        if claim.instructor_decision != "edited":
            continue
        correction = (claim.professor_correction or "").strip()
        if not correction:
            raise HTTPException(
                status_code=409,
                detail=f"Claim {claim.id} has an edit decision but no approved text",
            )
        # An edited decision is not proof of a factual error. Restrict automatic
        # document changes to independently evidenced errors only.
        if claim.ai_status != "possible_error":
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Claim {claim.id} is professor-edited but not classified as an "
                    "evidence-supported factual error. Resolve it before PDF export."
                ),
            )
        sources = db.scalars(
            select(ClaimSource).where(ClaimSource.claim_id == claim.id)
        ).all()
        has_contradictory_evidence = any(
            (source.evidence_text or "").startswith(
                "Evidence quality: contradiction."
            ) and bool((source.source_title or "").strip())
            and bool((source.evidence_text or "").partition("\n")[2].strip())
            for source in sources
        )
        if not has_contradictory_evidence:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Claim {claim.id} lacks a saved contradictory textbook passage. "
                    "Verify the claim and its sources before export."
                ),
            )
        corrections.append(
            ApprovedCorrection(
                claim_id=claim.id,
                original_text=claim.text,
                corrected_text=correction,
                page=claim.page if source.suffix.lower() == ".pdf" else None,
            )
        )

    work_dir = Path(tempfile.mkdtemp(prefix="inglis_reviewed_"))
    output = work_dir / "reviewed.pdf"
    try:
        generate_reviewed_pdf(source, output, corrections)
    except (ReviewedPDFError, ValueError, OSError) as exc:
        shutil.rmtree(work_dir, ignore_errors=True)
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception:
        shutil.rmtree(work_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail="Reviewed PDF export failed")

    original_stem = Path(document.filename).stem
    safe_stem = "".join(
        char if char.isalnum() or char in "-_" else "_"
        for char in original_stem
    ).strip("_")[:90] or "lecture"
    return FileResponse(
        path=output,
        media_type="application/pdf",
        filename=f"{safe_stem}_reviewed.pdf",
        background=BackgroundTask(shutil.rmtree, work_dir, ignore_errors=True),
    )

#** ---------------------------------------------------------**

#** FEATURE 3: PROFESSOR REFERENCE PDF LIBRARY**

#** These files are kept separate from uploaded lecture notes.**

#** Later stages will index their page text for cited BullsAI reviews.**

#** ---------------------------------------------------------**

REFERENCE_DIR = Path(__file__).resolve().parent.parent / "reference_library"

MAX_REFERENCE_PDF_BYTES = 100 * 1024 * 1024

REFERENCE_CHUNK_BYTES = 1024 * 1024

def _professor_reference_dir(professor_id: int) -> Path:

    """A separate filesystem directory for each authenticated professor."""

    return REFERENCE_DIR / f"professor_{professor_id}"

def _reference_metadata_path(professor_id: int, reference_id: str) -> Path:

    """Build paths only from a server-generated UUID, not client filenames."""

    try:

        normalized_id = str(UUID(reference_id))

    except (ValueError, AttributeError, TypeError):

        raise HTTPException(status_code=404, detail="Reference not found")

    return _professor_reference_dir(professor_id) / f"{normalized_id}.json"

def _read_reference_metadata(professor_id: int, reference_id: str) -> dict:

    path = _reference_metadata_path(professor_id, reference_id)

    if not path.is_file():

        raise HTTPException(status_code=404, detail="Reference not found")

    try:

        data = json.loads(path.read_text(encoding="utf-8"))

    except (OSError, ValueError):

        raise HTTPException(status_code=500, detail="Reference metadata unreadable")

    if data.get("reference_id") != path.stem:

        raise HTTPException(status_code=500, detail="Reference metadata invalid")

    return data

@app.post("/references", status_code=201)

async def upload_reference_pdf(

    file: UploadFile = File(...),

    professor: Professor = Depends(get_current_professor),

):

    """Store a professor-authorized reference PDF (max 100 MiB)."""

    filename = Path(file.filename or "").name

    if not filename or not filename.lower().endswith(".pdf"):

        raise HTTPException(status_code=400, detail="Only PDF references are supported")

    reference_id = str(uuid4())

    owner_dir = _professor_reference_dir(professor.id)

    owner_dir.mkdir(parents=True, exist_ok=True)

    pdf_path = owner_dir / f"{reference_id}.pdf"

    metadata_path = owner_dir / f"{reference_id}.json"

    size = 0

    try:

        with pdf_path.open("xb") as output:

            first_chunk = True

            while True:

                chunk = await file.read(REFERENCE_CHUNK_BYTES)

                if not chunk:

                    break

                if first_chunk:

                    if not chunk.startswith(b"%PDF-"):

                        raise HTTPException(

                            status_code=400,

                            detail="File content is not a valid PDF header",

                        )

                    first_chunk = False

                size += len(chunk)

                if size > MAX_REFERENCE_PDF_BYTES:

                    raise HTTPException(

                        status_code=413,

                        detail="Reference PDF exceeds the 100 MiB limit",

                    )

                output.write(chunk)

        if size == 0:

            raise HTTPException(status_code=400, detail="Empty PDF upload")

        record = {

            "reference_id": reference_id,

            "filename": filename[:255],

            "size_bytes": size,

            "uploaded_at": datetime.utcnow().isoformat() + "Z",

            "processing_status": "stored_not_indexed",

        }

        with metadata_path.open("x", encoding="utf-8") as meta_file:

            json.dump(record, meta_file, ensure_ascii=False)

        return record

    except HTTPException:

        pdf_path.unlink(missing_ok=True)

        metadata_path.unlink(missing_ok=True)

        raise

    except OSError:

        pdf_path.unlink(missing_ok=True)

        metadata_path.unlink(missing_ok=True)

        raise HTTPException(status_code=500, detail="Failed to store reference PDF")

    finally:

        await file.close()

@app.get("/references")

def list_reference_pdfs(

    professor: Professor = Depends(get_current_professor),

):

    """List only the current professor's uploaded reference documents."""

    owner_dir = _professor_reference_dir(professor.id)

    references = []

    if owner_dir.is_dir():

        for path in owner_dir.glob("*.json"):

            try:

                record = _read_reference_metadata(professor.id, path.stem)

                if (owner_dir / f"{record['reference_id']}.pdf").is_file():

                    references.append(record)

            except (HTTPException, KeyError):

                continue

    references.sort(key=lambda row: row["uploaded_at"], reverse=True)

    return {"total_references": len(references), "references": references}

@app.get("/references/search")

def search_indexed_references(

    query: str = Query(..., min_length=3, max_length=300, description="Anatomy term or claim to search"),

    limit: int = Query(5, ge=1, le=20, description="Maximum number of evidence passages"),

    professor: Professor = Depends(get_current_professor),

):

    """Search the authenticated professor's indexed reference PDF passages.

    Returned passages are actual indexed PDF text, not LLM-generated citations.

    PDF page numbers are physical page positions, not printed page labels.

    Search matches alone do not establish that a claim is medically correct.

    """

    clean_query = query.strip()

    if len(clean_query) < 3:

        raise HTTPException(status_code=422, detail="Search query must contain at least 3 characters")

    try:

        passages = search_reference_passages(

            professor_id=professor.id,

            query=clean_query,

            limit=limit,

        )

    except (ValueError, RuntimeError) as error:

        raise HTTPException(status_code=422, detail=f"Invalid reference search: {error}") from error

    except Exception as error:

        raise HTTPException(status_code=500, detail="Reference search failed") from error

    return {

        "query": clean_query,

        "total_results": len(passages),

        "results": passages,

        "page_number_note": "PDF pages are physical page numbers, not necessarily printed labels.",

        "evidence_note": "A retrieved passage is not automatically evidence supporting a claim; professor and source-grounded verification are required.",

    }

@app.post("/references/{reference_id}/index")

def index_uploaded_reference(

    reference_id: str,

    professor: Professor = Depends(get_current_professor),

):

    """Create a page-aware local search index for an authorized PDF.

    This operation can take time for an image-heavy textbook. It uses no

    BullsAI calls and does not OCR pages that lack embedded text.

    """

    record = _read_reference_metadata(professor.id, reference_id)

    owner_dir = _professor_reference_dir(professor.id)

    pdf_path = owner_dir / f"{record['reference_id']}.pdf"

    metadata_path = owner_dir / f"{record['reference_id']}.json"

    if not pdf_path.is_file():

        raise HTTPException(status_code=404, detail="Reference PDF not found")

    try:

        result = index_reference_pdf(

            reference_id=record["reference_id"],

            professor_id=professor.id,

            pdf_path=pdf_path,

            source_title=record["filename"],

        )

    except (ValueError, RuntimeError) as error:

        raise HTTPException(status_code=422, detail=f"Cannot index PDF: {error}")

    except Exception:

        raise HTTPException(status_code=500, detail="Reference indexing failed")

    #** Write metadata only after the index transaction succeeds.**

    record.update({

        "processing_status": result["processing_status"],

        "total_pages": result["total_pages"],

        "pages_with_text": result["pages_with_text"],

        "pages_without_text": result["pages_without_text"],

        "chunks_indexed": result["chunks_indexed"],

    })

    temp_path = metadata_path.with_suffix(".json.tmp")

    try:

        temp_path.write_text(json.dumps(record, ensure_ascii=False), encoding="utf-8")

        temp_path.replace(metadata_path)

    except OSError:

        temp_path.unlink(missing_ok=True)

        raise HTTPException(

            status_code=500,

            detail="Index created, but reference metadata could not be updated",

        )

    return result

@app.delete("/references/{reference_id}")

def delete_reference_pdf(

    reference_id: str,

    professor: Professor = Depends(get_current_professor),

):

    """Remove a reference owned by the currently logged-in professor."""

    record = _read_reference_metadata(professor.id, reference_id)

    owner_dir = _professor_reference_dir(professor.id)

    pdf_path = owner_dir / f"{record['reference_id']}.pdf"

    metadata_path = owner_dir / f"{record['reference_id']}.json"

    try:

        delete_reference_index(reference_id=record["reference_id"], professor_id=professor.id)

    except Exception:

        raise HTTPException(status_code=500, detail="Failed to remove reference index")

    try:

        pdf_path.unlink(missing_ok=True)

        metadata_path.unlink(missing_ok=True)

    except OSError:

        raise HTTPException(status_code=500, detail="Failed to remove reference PDF")

    return {"message": "Reference deleted", "reference_id": record["reference_id"]}


from app.student_feedback_routes import build_student_feedback_router

app.include_router(build_student_feedback_router(get_current_professor))

from app.lecture_external_research_routes import build_lecture_external_research_router

app.include_router(
    build_lecture_external_research_router(get_current_professor)
)