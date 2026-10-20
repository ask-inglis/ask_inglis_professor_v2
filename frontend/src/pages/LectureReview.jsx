import ClaimReviewCards from "../components/ClaimReviewCards.jsx";
import BulkReviewButton from "../components/BulkReviewButton.jsx";
import {
  useEffect,
  useState,
} from "react";

import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";


const BACKEND_URL =
  "http://127.0.0.1:8000";


function LectureReview({ mode = "documents" }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAIReview = mode === "ai";
  const requestedDocumentId = searchParams.get("document");


  // -------------------------------------------------------
  // FILE / DOCUMENT STATE
  // -------------------------------------------------------

  const [
    selectedFile,
    setSelectedFile,
  ] = useState(null);

  const [
    extractedText,
    setExtractedText,
  ] = useState("");

  const [
    claims,
    setClaims,
  ] = useState([]);

  const [
    documentId,
    setDocumentId,
  ] = useState(null);

  const [
    currentDocument,
    setCurrentDocument,
  ] = useState(null);


  // -------------------------------------------------------
  // SAVED DOCUMENTS STATE
  // -------------------------------------------------------

  const [
    savedDocuments,
    setSavedDocuments,
  ] = useState([]);

  const [
    loadingDocuments,
    setLoadingDocuments,
  ] = useState(false);

  const [
    loadingDocumentId,
    setLoadingDocumentId,
  ] = useState(null);

  const [
    deletingDocumentId,
    setDeletingDocumentId,
  ] = useState(null);


  // -------------------------------------------------------
  // GENERAL PAGE STATE
  // -------------------------------------------------------

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    reviewingClaimId,
    setReviewingClaimId,
  ] = useState(null);

  const [
    savingDecisionClaimId,
    setSavingDecisionClaimId,
  ] = useState(null);

  const [
    editingClaimId,
    setEditingClaimId,
  ] = useState(null);

  const [
    editCorrectionText,
    setEditCorrectionText,
  ] = useState("");


  // -------------------------------------------------------
  // AUTH HELPERS
  // -------------------------------------------------------

  const getProfessorToken = () => {
    return localStorage.getItem(
      "professor_token"
    );
  };


  const clearProfessorSession = () => {
    localStorage.removeItem(
      "professor_token"
    );

    localStorage.removeItem(
      "professor_email"
    );
  };


  const handleUnauthorized = () => {
    clearProfessorSession();

    navigate(
      "/",
      {
        replace: true,
      }
    );
  };


  const parseResponse = async (
    response
  ) => {
    let result = {};

    try {
      result =
        await response.json();
    } catch {
      result = {};
    }

    if (
      response.status === 401
    ) {
      handleUnauthorized();

      throw new Error(
        "Your professor session has expired. Please sign in again."
      );
    }

    return result;
  };


  // -------------------------------------------------------
  // NORMALIZE CLAIM
  // -------------------------------------------------------

  const normalizeClaim = (
    claim
  ) => {
    return {
      ...claim,

      ai_status:
        claim.ai_status ||
        "not_reviewed",

      reason:
        claim.ai_reason ||
        claim.reason ||
        "—",

      suggested_correction:
        claim.suggested_correction ||
        null,

      sources:
        claim.sources || [],

      instructor_decision:
        claim.instructor_decision ||
        "pending",

      professor_correction:
        claim.professor_correction ||
        null,

      reviewed_at:
        claim.reviewed_at ||
        null,
    };
  };


  // -------------------------------------------------------
  // LOAD SAVED DOCUMENT LIST
  // -------------------------------------------------------

  const loadSavedDocuments =
    async () => {

      const token =
        getProfessorToken();

      if (!token) {
        handleUnauthorized();
        return;
      }

      try {
        setLoadingDocuments(
          true
        );

        const response =
          await fetch(
            `${BACKEND_URL}/documents`,
            {
              method: "GET",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const result =
          await parseResponse(
            response
          );

        if (!response.ok) {
          throw new Error(
            result.detail ||
              "Could not load saved documents."
          );
        }

        setSavedDocuments(
          result.documents || []
        );

      } catch (error) {
        setMessage(
          error.message
        );

      } finally {
        setLoadingDocuments(
          false
        );
      }
    };


  // -------------------------------------------------------
  // LOAD ONE SAVED DOCUMENT
  // -------------------------------------------------------

  const loadSavedDocument =
    async (savedDocumentId) => {

      const token =
        getProfessorToken();

      if (!token) {
        handleUnauthorized();
        return;
      }

      try {
        setLoadingDocumentId(
          savedDocumentId
        );

        setMessage("");

        setEditingClaimId(
          null
        );

        setEditCorrectionText(
          ""
        );

        const response =
          await fetch(
            `${BACKEND_URL}/documents/${savedDocumentId}/claims`,
            {
              method: "GET",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const result =
          await parseResponse(
            response
          );

        if (!response.ok) {
          throw new Error(
            result.detail ||
              "Could not load saved lecture."
          );
        }

        const preparedClaims =
          (result.claims || []).map(
            normalizeClaim
          );

        setClaims(
          preparedClaims
        );

        setDocumentId(
          result.document.id
        );

        setCurrentDocument(
          result.document
        );

        setExtractedText("");

        setMessage(
          `${result.total_claims} saved claims loaded from ${result.document.filename}.`
        );

      } catch (error) {
        setMessage(
          error.message
        );

      } finally {
        setLoadingDocumentId(
          null
        );
      }
    };


  // -------------------------------------------------------
  // DELETE SAVED DOCUMENT
  // -------------------------------------------------------

  const deleteSavedDocument =
    async (document) => {

      const confirmed =
        window.confirm(
          `Delete "${document.filename}"?\n\nThis will also delete its saved claims, AI reviews, sources, and instructor decisions.`
        );

      if (!confirmed) {
        return;
      }

      const token =
        getProfessorToken();

      if (!token) {
        handleUnauthorized();
        return;
      }

      try {
        setDeletingDocumentId(
          document.id
        );

        setMessage("");

        const response =
          await fetch(
            `${BACKEND_URL}/documents/${document.id}`,
            {
              method: "DELETE",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const result =
          await parseResponse(
            response
          );

        if (!response.ok) {
          throw new Error(
            result.detail ||
              "Could not delete document."
          );
        }

        // If the document currently open on screen
        // was deleted, clear the review screen.
        if (
          documentId ===
          document.id
        ) {
          setClaims([]);

          setDocumentId(null);

          setCurrentDocument(null);

          setExtractedText("");

          setEditingClaimId(
            null
          );

          setEditCorrectionText(
            ""
          );
        }

        // Immediately remove it from the visible list.
        setSavedDocuments(
          (currentDocuments) =>
            currentDocuments.filter(
              (item) =>
                item.id !==
                document.id
            )
        );

        setMessage(
          `Document ${document.id} deleted successfully.`
        );

      } catch (error) {
        setMessage(
          error.message
        );

      } finally {
        setDeletingDocumentId(
          null
        );
      }
    };


  // -------------------------------------------------------
  // LOAD DOCUMENT LIST WHEN PAGE OPENS
  // -------------------------------------------------------

  useEffect(() => {
    loadSavedDocuments();
  }, []);

  // "Continue to AI Verification" deep-links to this saved document.
  useEffect(() => {
    if (
      isAIReview &&
      requestedDocumentId &&
      /^\d+$/.test(requestedDocumentId)
    ) {
      loadSavedDocument(Number(requestedDocumentId));
    }
  }, [isAIReview, requestedDocumentId]);


  // -------------------------------------------------------
  // FILE SELECTION
  // -------------------------------------------------------

  const handleFileChange = (
    event
  ) => {
    const file =
      event.target.files[0];

    setSelectedFile(
      file || null
    );

    setExtractedText("");

    setClaims([]);

    setDocumentId(null);

    setCurrentDocument(null);

    setMessage("");

    setEditingClaimId(null);

    setEditCorrectionText("");
  };


  // -------------------------------------------------------
  // EXTRACT RAW DOCUMENT TEXT
  // -------------------------------------------------------

  const extractText =
    async () => {

      if (!selectedFile) {
        setMessage(
          "Please choose a DOCX or PDF file first."
        );

        return;
      }

      const token =
        getProfessorToken();

      if (!token) {
        handleUnauthorized();
        return;
      }

      const formData =
        new FormData();

      formData.append(
        "file",
        selectedFile
      );

      try {
        setLoading(true);

        setMessage("");

        const response =
          await fetch(
            `${BACKEND_URL}/upload`,
            {
              method: "POST",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },

              body: formData,
            }
          );

        const result =
          await parseResponse(
            response
          );

        if (!response.ok) {
          throw new Error(
            result.detail ||
              "Document processing failed."
          );
        }

        setExtractedText(
          result.text
        );

        setMessage(
          `Document processed successfully. ${result.characters_extracted} characters extracted.`
        );

      } catch (error) {
        setMessage(
          error.message
        );

      } finally {
        setLoading(false);
      }
    };


  // -------------------------------------------------------
  // EXTRACT CLAIMS + SAVE DOCUMENT
  // -------------------------------------------------------

  const extractClaimsFromDocument =
    async () => {

      if (!selectedFile) {
        setMessage(
          "Please choose a DOCX or PDF file first."
        );

        return;
      }

      const token =
        getProfessorToken();

      if (!token) {
        handleUnauthorized();
        return;
      }

      const formData =
        new FormData();

      formData.append(
        "file",
        selectedFile
      );

      try {
        setLoading(true);

        setMessage("");

        const response =
          await fetch(
            `${BACKEND_URL}/analyze-claims`,
            {
              method: "POST",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },

              body: formData,
            }
          );

        const result =
          await parseResponse(
            response
          );

        if (!response.ok) {
          throw new Error(
            result.detail ||
              "Claim extraction failed."
          );
        }

        const preparedClaims =
          (result.claims || []).map(
            normalizeClaim
          );

        setDocumentId(
          result.document_id
        );

        setCurrentDocument({
          id:
            result.document_id,

          filename:
            result.filename,

          file_type:
            result.file_type,

          course_id:
            result.course?.id ??
            null,
        });

        setClaims(
          preparedClaims
        );

        setMessage(
          `${result.total_claims} claims extracted and saved successfully.`
        );

        await loadSavedDocuments();

      } catch (error) {
        setMessage(
          error.message
        );

      } finally {
        setLoading(false);
      }
    };


  // -------------------------------------------------------
  // REVIEW CLAIM WITH AI
  // -------------------------------------------------------

  const reviewClaimWithAI =
    async (claimId, throwOnError = false) => {

      const token =
        getProfessorToken();

      if (!token) {
        handleUnauthorized();
        if (throwOnError) {
          throw new Error("Professor session expired.");
        }
        return false;
      }

      try {
        setReviewingClaimId(
          claimId
        );

        setMessage("");

        const response =
          await fetch(
            `${BACKEND_URL}/claims/${claimId}/review`,
            {
              method: "POST",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const result =
          await parseResponse(
            response
          );

        if (!response.ok) {
          throw new Error(
            result.detail ||
              "AI review failed."
          );
        }

        setClaims(
          (currentClaims) =>
            currentClaims.map(
              (claim) =>
                claim.id === claimId
                  ? {
                      ...claim,

                      ai_status:
                        result.status,

                      reason:
                        result.reason,

                      suggested_correction:
                        result.suggested_correction,

                      sources:
                        result.sources || [],
                    }
                  : claim
            )
        );

        setMessage(
          `Claim ${claimId} reviewed and saved successfully.`
        );

        return true;

      } catch (error) {
        setMessage(
          error.message
        );
        if (throwOnError) {
          throw error;
        }
        return false;

      } finally {
        setReviewingClaimId(
          null
        );
      }
    };


  // -------------------------------------------------------
  // SAVE PROFESSOR DECISION
  // -------------------------------------------------------

  const saveProfessorDecision =
    async (
      claimId,
      decision,
      professorCorrection = null
    ) => {

      const token =
        getProfessorToken();

      if (!token) {
        handleUnauthorized();
        return;
      }

      try {
        setSavingDecisionClaimId(
          claimId
        );

        setMessage("");

        const response =
          await fetch(
            `${BACKEND_URL}/claims/${claimId}/decision`,
            {
              method: "PATCH",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${token}`,
              },

              body: JSON.stringify({
                decision:
                  decision,

                professor_correction:
                  professorCorrection,
              }),
            }
          );

        const result =
          await parseResponse(
            response
          );

        if (!response.ok) {
          throw new Error(
            result.detail ||
              "Could not save professor decision."
          );
        }

        setClaims(
          (currentClaims) =>
            currentClaims.map(
              (claim) =>
                claim.id === claimId
                  ? {
                      ...claim,

                      instructor_decision:
                        result.decision,

                      professor_correction:
                        result.professor_correction,

                      reviewed_at:
                        result.reviewed_at,
                    }
                  : claim
            )
        );

        setEditingClaimId(
          null
        );

        setEditCorrectionText(
          ""
        );

        setMessage(
          `Professor decision saved for claim ${claimId}.`
        );

      } catch (error) {
        setMessage(
          error.message
        );

      } finally {
        setSavingDecisionClaimId(
          null
        );
      }
    };


  // -------------------------------------------------------
  // EDIT PROFESSOR CORRECTION
  // -------------------------------------------------------

  const startEditingCorrection =
    (claim) => {

      setEditingClaimId(
        claim.id
      );

      setEditCorrectionText(
        claim.professor_correction ||
          claim.suggested_correction ||
          ""
      );
    };


  const saveEditedCorrection =
    async (claimId) => {

      const cleanedText =
        editCorrectionText.trim();

      if (!cleanedText) {
        setMessage(
          "Please enter the professor-approved correction before saving."
        );

        return;
      }

      await saveProfessorDecision(
        claimId,
        "edited",
        cleanedText
      );
    };


  // -------------------------------------------------------
  // FORMAT AI STATUS
  // -------------------------------------------------------

  const formatAIStatus = (
    status
  ) => {

    if (
      status ===
      "likely_correct"
    ) {
      return "Likely Correct";
    }

    if (
      status ===
      "possible_error"
    ) {
      return "Possible Error";
    }

    if (
      status ===
      "needs_review"
    ) {
      return "Needs Review";
    }

    return "Not Reviewed";
  };


  const getAIStatusClass =
    (status) => {

      if (
        status ===
        "likely_correct"
      ) {
        return "status-likely-correct";
      }

      if (
        status ===
        "possible_error"
      ) {
        return "status-possible-error";
      }

      if (
        status ===
        "needs_review"
      ) {
        return "status-needs-review";
      }

      return "status-not-reviewed";
    };


  // -------------------------------------------------------
  // FORMAT PROFESSOR DECISION
  // -------------------------------------------------------

  const formatDecision = (
    decision
  ) => {

    if (
      decision === "accepted"
    ) {
      return "Accepted";
    }

    if (
      decision === "rejected"
    ) {
      return "Rejected";
    }

    if (
      decision === "edited"
    ) {
      return "Edited";
    }

    if (
      decision ===
      "needs_review"
    ) {
      return "Needs Review";
    }

    return "Pending";
  };


  // -------------------------------------------------------
  // FORMAT DATE
  // -------------------------------------------------------

  const formatDate = (
    value
  ) => {

    if (!value) {
      return "—";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return value;
    }

    return date.toLocaleString();
  };


  // -------------------------------------------------------
  // SUMMARY COUNTS
  // -------------------------------------------------------

  const totalClaims =
    claims.length;


  const aiReviewedCount =
    claims.filter(
      (claim) =>
        claim.ai_status &&
        claim.ai_status !==
          "not_reviewed"
    ).length;


  const likelyCorrectCount =
    claims.filter(
      (claim) =>
        claim.ai_status ===
        "likely_correct"
    ).length;


  const possibleErrorCount =
    claims.filter(
      (claim) =>
        claim.ai_status ===
        "possible_error"
    ).length;


  const aiNeedsReviewCount =
    claims.filter(
      (claim) =>
        claim.ai_status ===
        "needs_review"
    ).length;


  const notReviewedCount =
    totalClaims -
    aiReviewedCount;


  const pendingCount =
    claims.filter(
      (claim) =>
        !claim.instructor_decision ||
        claim.instructor_decision ===
          "pending"
    ).length;


  const acceptedCount =
    claims.filter(
      (claim) =>
        claim.instructor_decision ===
        "accepted"
    ).length;


  const rejectedCount =
    claims.filter(
      (claim) =>
        claim.instructor_decision ===
        "rejected"
    ).length;


  const editedCount =
    claims.filter(
      (claim) =>
        claim.instructor_decision ===
        "edited"
    ).length;


  const professorNeedsReviewCount =
    claims.filter(
      (claim) =>
        claim.instructor_decision ===
        "needs_review"
    ).length;


  // -------------------------------------------------------
  // PAGE
  // -------------------------------------------------------

  return (
    <div className="professor-page">

      <header className="professor-header">

        <div>

          <Link
            to="/professor"
            className="review-back-link"
          >
            ← Professor Dashboard
          </Link>

          <h1>
            {isAIReview ? "AI Verification & Professor Decisions" : "Documents & Claim Extraction"}
          </h1>

          <p>
            Human Anatomy
          </p>

        </div>

      </header>


      <main className="professor-content">

        <section className="card workflow-intro">
          <p className="dashboard-eyebrow">
            {isAIReview ? "STAGE 2 OF 2" : "STAGE 1 OF 2"}
          </p>
          <h2>
            {isAIReview ? "Verify saved claims" : "Prepare lecture material"}
          </h2>
          <p className="description">
            {isAIReview
              ? "Choose a lecture that has already been processed. Run BullsAI assessments and record professor decisions. No need to upload the file again."
              : "Upload a PDF or DOCX, extract text, and save claims. When your claims are ready, continue to AI verification."}
          </p>
          <div className="workflow-tabs">
            <Link
              className={`workflow-tab ${!isAIReview ? "workflow-tab-active" : ""}`}
              to="/professor/documents"
            >
              1. Documents & Extraction
            </Link>
            <Link
              className={`workflow-tab ${isAIReview ? "workflow-tab-active" : ""}`}
              to="/professor/ai-review"
            >
              2. AI Verification & Decisions
            </Link>
          </div>
        </section>

        {message && (
          <div className="message workflow-message" role="status">
            {message}
          </div>
        )}

        {/* ============================================= */}
        {/* SAVED DOCUMENTS */}
        {/* ============================================= */}

        <section className="card">

          <h2>
            Saved Lecture Documents
          </h2>

          <p className="description">
            {isAIReview
              ? "Select a processed lecture to review its saved claims."
              : "Reopen a previously processed lecture, preview its claims, or delete an outdated document."}
          </p>


          <div className="actions">

            <button
              onClick={
                loadSavedDocuments
              }

              disabled={
                loadingDocuments
              }
            >
              {loadingDocuments
                ? "Loading..."
                : "Refresh Documents"}
            </button>

          </div>


          {savedDocuments.length ===
          0 ? (

            <p className="description">
              {isAIReview
                ? "No processed lectures found. Upload and extract claims from a lecture first."
                : "No saved lecture documents were found."}
            </p>

          ) : (

            <div className="table-wrapper">

              <table>

                <thead>

                  <tr>

                    <th>
                      Document ID
                    </th>

                    <th>
                      File
                    </th>

                    <th>
                      Type
                    </th>

                    <th>
                      Uploaded
                    </th>

                    <th>
                      Action
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {savedDocuments.map(
                    (document) => (

                      <tr
                        key={
                          document.id
                        }
                      >

                        <td>
                          {document.id}
                        </td>


                        <td className="claim-text">
                          {
                            document.filename
                          }
                        </td>


                        <td>
                          {
                            document.file_type
                          }
                        </td>


                        <td>
                          {
                            formatDate(
                              document.uploaded_at
                            )
                          }
                        </td>


                        <td>

                          <div
                            style={{
                              display:
                                "flex",

                              gap:
                                "8px",

                              flexWrap:
                                "wrap",
                            }}
                          >

                            <button
                              className="review-button"

                              onClick={() =>
                                loadSavedDocument(
                                  document.id
                                )
                              }

                              disabled={
                                loadingDocumentId !==
                                  null ||
                                deletingDocumentId !==
                                  null ||
                                loading
                              }
                            >
                              {loadingDocumentId ===
                              document.id
                                ? "Loading..."
                                : documentId ===
                                    document.id
                                  ? "Reload"
                                  : isAIReview
                                  ? "Open Claims"
                                  : "Open"}
                            </button>


                            {!isAIReview && (
                              <button
                                onClick={() => deleteSavedDocument(document)}
                                disabled={deletingDocumentId !== null || loadingDocumentId !== null}
                              >
                                {deletingDocumentId === document.id ? "Deleting..." : "Delete"}
                              </button>
                            )}

                          </div>

                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>

          )}

        </section>


        {/* ============================================= */}
        {/* UPLOAD NEW LECTURE */}
        {/* ============================================= */}

        {!isAIReview && (
        <section className="card">

          <h2>
            Upload New Lecture Notes
          </h2>

          <p className="description">
            Upload a DOCX or PDF file to extract lecture
            content and save its anatomy claims for
            factual review.
          </p>


          <input
            type="file"
            accept=".docx,.pdf"
            onChange={
              handleFileChange
            }
          />


          {selectedFile && (

            <div className="file-info">

              <strong>
                Selected:
              </strong>{" "}

              {
                selectedFile.name
              }

            </div>

          )}


          <div className="actions">

            <button
              onClick={
                extractText
              }

              disabled={
                loading ||
                reviewingClaimId !==
                  null
              }
            >
              Extract Document Text
            </button>


            <button
              onClick={
                extractClaimsFromDocument
              }

              disabled={
                loading ||
                reviewingClaimId !==
                  null
              }
            >
              Extract Anatomy Claims
            </button>

          </div>


          {loading && (

            <p className="loading">
              Processing...
            </p>

          )}



        </section>
        )}


        {/* ============================================= */}
        {/* EXTRACTED TEXT */}
        {/* ============================================= */}

        {!isAIReview && extractedText && (

          <section className="card">

            <h2>
              Extracted Text
            </h2>

            <textarea
              value={
                extractedText
              }

              readOnly

              rows="15"
            />

          </section>

        )}


        {/* ============================================= */}
        {/* CURRENT LECTURE */}
        {/* ============================================= */}

        {currentDocument && (

          <section className="card">

            <h2>
              {isAIReview ? "Selected Lecture for Verification" : "Current Lecture"}
            </h2>

            <p className="description">

              <strong>
                Document ID:
              </strong>{" "}

              {
                currentDocument.id
              }

            </p>

            <p className="description">

              <strong>
                File:
              </strong>{" "}

              {
                currentDocument.filename
              }

            </p>

          </section>

        )}


        {/* ============================================= */}
        {/* DOCUMENT MODE: CLAIMS READY TO VERIFY */}
        {/* ============================================= */}

        {!isAIReview && claims.length > 0 && (
          <section className="card">
            <h2>Extracted Anatomy Claims</h2>
            <p className="description">
              {claims.length} claims have been saved. Review the extraction below,
              then open the AI Verification page for BullsAI assessment and
              professor decisions.
            </p>
            <Link
              className="workflow-continue-link"
              to={`/professor/ai-review?document=${documentId}`}
            >
              Continue to AI Verification →
            </Link>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Claim #</th>
                    <th>Page</th>
                    <th>Extracted Claim</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((claim) => (
                    <tr key={claim.id}>
                      <td>{claim.claim_number}</td>
                      <td>{claim.page ?? "—"}</td>
                      <td className="claim-text">{claim.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {isAIReview && !currentDocument && (
          <section className="card">
            <h2>Choose a saved lecture above</h2>
            <p className="description">
              This page uses claims already extracted from your saved documents.
              To add a new lecture, go to document extraction first.
            </p>
            <Link className="workflow-continue-link" to="/professor/documents">
              Go to Document Extraction →
            </Link>
          </section>
        )}

        {/* ============================================= */}
        {/* AI SUMMARY */}
        {/* ============================================= */}

        {isAIReview && claims.length > 0 && (

          <section className="card">

            <h2>
              AI Review Summary
            </h2>

            <p className="description">
              BullsAI generates an initial assessment when configured.
              External citation retrieval is not yet integrated, so model
              assessments are not independently source-verified. The
              professor makes the final decision.
            </p>


            <div className="review-summary">

              <div className="summary-card">

                <span>
                  Total Claims
                </span>

                <strong>
                  {totalClaims}
                </strong>

              </div>


              <div className="summary-card">

                <span>
                  AI Reviewed
                </span>

                <strong>
                  {aiReviewedCount}
                </strong>

              </div>


              <div className="summary-card">

                <span>
                  Likely Correct
                </span>

                <strong>
                  {likelyCorrectCount}
                </strong>

              </div>


              <div className="summary-card">

                <span>
                  Possible Error
                </span>

                <strong>
                  {possibleErrorCount}
                </strong>

              </div>


              <div className="summary-card">

                <span>
                  Needs Review
                </span>

                <strong>
                  {aiNeedsReviewCount}
                </strong>

              </div>


              <div className="summary-card">

                <span>
                  Not Reviewed
                </span>

                <strong>
                  {notReviewedCount}
                </strong>

              </div>

            </div>


            <p className="description">
              Review each claim individually using the BullsAI configuration.
              Bulk persisted reviews are not available in this interface yet.
            </p>

          </section>

        )}


        {/* ============================================= */}
        {/* INSTRUCTOR REVIEW */}
        {/* ============================================= */}

        {isAIReview && claims.length > 0 && (

          <section className="card">

            <h2>
              Instructor Review
            </h2>

            <p className="description">
              Review the AI finding, examine its sources,
              and record the final instructor decision.
            </p>


            <div className="review-summary">

              <div className="summary-card">
                <span>
                  Total
                </span>
                <strong>
                  {totalClaims}
                </strong>
              </div>


              <div className="summary-card">
                <span>
                  Pending
                </span>
                <strong>
                  {pendingCount}
                </strong>
              </div>


              <div className="summary-card">
                <span>
                  Accepted
                </span>
                <strong>
                  {acceptedCount}
                </strong>
              </div>


              <div className="summary-card">
                <span>
                  Rejected
                </span>
                <strong>
                  {rejectedCount}
                </strong>
              </div>


              <div className="summary-card">
                <span>
                  Edited
                </span>
                <strong>
                  {editedCount}
                </strong>
              </div>


              <div className="summary-card">
                <span>
                  Needs Review
                </span>
                <strong>
                  {professorNeedsReviewCount}
                </strong>
              </div>

            </div>


            <BulkReviewButton
              claims={claims}
              reviewClaimWithAI={(claimId) =>
                reviewClaimWithAI(claimId, true)
              }
              disabled={reviewingClaimId !== null || loading}
            />

            <ClaimReviewCards
              claims={claims}
              reviewClaimWithAI={reviewClaimWithAI}
              saveProfessorDecision={saveProfessorDecision}
              startEditingCorrection={startEditingCorrection}
              saveEditedCorrection={saveEditedCorrection}
              editingClaimId={editingClaimId}
              editCorrectionText={editCorrectionText}
              setEditCorrectionText={setEditCorrectionText}
              cancelEditing={() => {
                setEditingClaimId(null);
                setEditCorrectionText("");
              }}
              reviewingClaimId={reviewingClaimId}
              savingDecisionClaimId={savingDecisionClaimId}
              formatAIStatus={formatAIStatus}
              getAIStatusClass={getAIStatusClass}
              formatDecision={formatDecision}
            />

          </section>

        )}

      </main>

    </div>
  );
}


export default LectureReview;