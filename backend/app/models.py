from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)

from app.database import Base


# ---------------------------------------------------------
# PROFESSOR
# ---------------------------------------------------------

class Professor(Base):
    __tablename__ = "professors"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    courses = relationship(
        "Course",
        back_populates="professor",
        cascade="all, delete-orphan",
    )


# ---------------------------------------------------------
# COURSE
# ---------------------------------------------------------

class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    code: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )

    professor_id: Mapped[int] = mapped_column(
        ForeignKey("professors.id"),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    professor = relationship(
        "Professor",
        back_populates="courses",
    )

    documents = relationship(
        "Document",
        back_populates="course",
        cascade="all, delete-orphan",
    )


# ---------------------------------------------------------
# DOCUMENT
# ---------------------------------------------------------

class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    stored_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    file_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id"),
        nullable=False,
    )

    # -----------------------------------------------------
    # VERSIONING
    # -----------------------------------------------------

    # First upload = version 1.
    # Every replacement increments this value.
    version_number: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False,
    )

    # Only the newest version in a document chain should
    # be marked current.
    is_current: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    # If this document is a replacement, this points to
    # the document version that came immediately before it.
    replaces_document_id: Mapped[int | None] = mapped_column(
        ForeignKey("documents.id"),
        nullable=True,
        index=True,
    )

    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    course = relationship(
        "Course",
        back_populates="documents",
    )

    claims = relationship(
        "Claim",
        back_populates="document",
        cascade="all, delete-orphan",
    )

    # Previous version.
    replaces = relationship(
        "Document",
        remote_side=[id],
        foreign_keys=[replaces_document_id],
        back_populates="replaced_by",
        uselist=False,
    )

    # Newer version that replaced this document.
    replaced_by = relationship(
        "Document",
        foreign_keys="Document.replaces_document_id",
        back_populates="replaces",
        uselist=False,
    )


# ---------------------------------------------------------
# CLAIM
# ---------------------------------------------------------

class Claim(Base):
    __tablename__ = "claims"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    claim_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    page: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    # -----------------------------------------------------
    # AI REVIEW
    # -----------------------------------------------------

    ai_status: Mapped[str] = mapped_column(
        String(50),
        default="not_reviewed",
        nullable=False,
    )

    ai_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    suggested_correction: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # -----------------------------------------------------
    # PROFESSOR REVIEW
    # -----------------------------------------------------

    instructor_decision: Mapped[str] = mapped_column(
        String(100),
        default="pending",
        nullable=False,
    )

    professor_correction: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )

    # -----------------------------------------------------
    # DOCUMENT RELATIONSHIP
    # -----------------------------------------------------

    document_id: Mapped[int] = mapped_column(
        ForeignKey("documents.id"),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    document = relationship(
        "Document",
        back_populates="claims",
    )

    sources = relationship(
        "ClaimSource",
        back_populates="claim",
        cascade="all, delete-orphan",
    )


# ---------------------------------------------------------
# CLAIM SOURCE / EXTERNAL EVIDENCE
# ---------------------------------------------------------

class ClaimSource(Base):
    __tablename__ = "claim_sources"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    claim_id: Mapped[int] = mapped_column(
        ForeignKey("claims.id"),
        nullable=False,
        index=True,
    )

    source_title: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    source_url: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    evidence_text: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    claim = relationship(
        "Claim",
        back_populates="sources",
    )