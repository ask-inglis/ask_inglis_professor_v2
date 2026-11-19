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





const BACKEND_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");




const lectureStyles = `

.lecture-workspace { color: #eaf3ff; min-height: 100vh; background: #06152a; }

.lecture-workspace * { box-sizing: border-box; }

.lecture-topbar { padding: 16px clamp(18px,5vw,70px); background: rgba(5,20,42,.92); border-bottom: 1px solid #234366; }

.lecture-topbar-inner { width: min(1180px,100%); margin: auto; display: flex; align-items: center; justify-content: space-between; gap: 20px; }

.lecture-logo { display: flex; align-items: center; gap: 11px; color: #eef7ff; text-decoration: none; }

.lecture-logo-icon { width: 42px; height: 42px; display: grid; place-items: center; color: #8bddff; background: #103356; border: 1px solid #3b709c; border-radius: 12px; font-size: 25px; }

.lecture-logo strong,.lecture-logo small { display:block; } .lecture-logo strong { font-size: 17px; } .lecture-logo em { font-style: normal; color: #77d5ff; } .lecture-logo small { color: #9dbbd7; font-size: 12px; margin-top: 3px; }

.lecture-back { color: #a8d9ff; text-decoration:none; border:1px solid #2b537b; padding:11px 15px; border-radius:10px; font-weight:700; }

.lecture-back:hover { color:#fff; background:#163957; }

.lecture-content { width: min(1180px,calc(100% - 36px)); margin: 28px auto 80px; }

.lecture-hero { position: relative; isolation: isolate; min-height: 282px; display: flex; align-items:center; padding: clamp(26px,4vw,48px); border-radius:24px; border:1px solid #254e78; overflow:hidden; background: linear-gradient(110deg,#102e50 0%,#0c2444 64%,#0a1c38 100%); }

.lecture-hero-copy { width: min(720px,75%); position:relative; z-index: 1; }

.lecture-kicker { font-size: 11px; letter-spacing: .16em; font-weight: 800; color:#81daff; margin:0 0 12px; }

.lecture-hero h1 { color:#f2f8ff; font-size:clamp(30px,3.7vw,48px); letter-spacing:-.04em; line-height:1.13; margin:0 0 14px; }

.lecture-hero-copy > p:not(.lecture-kicker) { color:#c4d8ef; max-width:570px; line-height:1.65; margin:0 0 20px; }

.lecture-hero-tags { display:flex; gap:9px; flex-wrap:wrap; }

.lecture-hero-tags span { border:1px solid #315c82; background:rgba(10,29,54,.75); padding:6px 10px; border-radius:30px; font-size:12px; color:#c7e4f8; }

.lecture-hero-art { position:absolute; width:300px; height:100%; right:0; top:0; object-fit:cover; object-position:center 26%; opacity:.73; -webkit-mask-image:linear-gradient(90deg,transparent,#000 44%); mask-image:linear-gradient(90deg,transparent,#000 44%); }

.lecture-steps { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:13px; margin:20px 0 28px; }

.lecture-step { display:flex; align-items:center; gap:12px; text-decoration:none; padding:17px; border-radius:14px; background:#102844; border:1px solid #24496e; color:#ddeafb; min-width:0; }

.lecture-step-current { border-color:#64c6ff; background:#143a5c; box-shadow:inset 0 0 0 1px rgba(90,196,255,.12); }

.lecture-step-number { flex:0 0 auto; display:grid; place-items:center; width:38px; height:38px; border-radius:11px; background:#164874; color:#86dbff; font-weight:800; }

.lecture-step strong,.lecture-step small { display:block; } .lecture-step strong { font-size:14px; } .lecture-step small { margin-top:4px; font-size:11px; color:#a7bdd5; }

.lecture-step-planned { opacity:.69; }

.lecture-panel { margin:22px 0; padding:clamp(20px,3vw,30px); border-radius:19px; border:1px solid #25496e; background:linear-gradient(135deg,#102843,#0b213c); box-shadow:0 14px 35px rgba(0,0,0,.13); color:#e9f3ff; }

.lecture-section-heading { display:flex; justify-content:space-between; align-items:center; gap:20px; margin-bottom:20px; }

.lecture-section-heading h2,.lecture-selected h2,.lecture-empty-selection h2 { color:#f0f7ff; margin:0 0 8px; font-size:clamp(20px,2.4vw,26px); letter-spacing:-.025em; }

.lecture-section-heading p:not(.lecture-kicker),.lecture-selected p:not(.lecture-kicker),.lecture-empty-selection p { margin:0; color:#abc3dd; line-height:1.65; font-size:14px; }

.lecture-section-icon { display:grid; place-items:center; border:1px solid #3c77a7; border-radius:15px; height:53px; width:53px; font-size:30px; color:#8ee3ff; flex:0 0 auto; }

.lecture-dropzone { display:flex; flex-direction:column; gap:9px; align-items:center; justify-content:center; min-height:212px; border:2px dashed #386a99; border-radius:15px; background:#0a1f39; padding:25px; cursor:pointer; text-align:center; }

.lecture-dropzone:hover { border-color:#73d4ff; background:#0c2949; }

.lecture-dropzone strong { font-size:17px; color:#f0f7ff; overflow-wrap:anywhere; }.lecture-dropzone span:not(.lecture-drop-icon) { color:#a8c1db; font-size:13px; }

.lecture-drop-icon { display:grid; place-items:center; width:55px; height:55px; border-radius:50%; background:#164f81; color:#92ddff; font-size:32px; }

.lecture-dropzone input { display:block; max-width:100%; margin-top:11px; color:#bbd4ec; font-size:13px; }

.lecture-action-bar { display:flex; gap:12px; flex-wrap:wrap; margin-top:19px; }.lecture-action-bar button { background:#183d63; border:1px solid #3b6995; color:#f2f8ff; padding:12px 18px; border-radius:10px; cursor:pointer; font-weight:750; }.lecture-action-bar .lecture-primary-action { border-color:#3678ed; background:linear-gradient(105deg,#176cc7,#5c5de8); }.lecture-action-bar button:disabled { opacity:.46; cursor:not-allowed; }

.lecture-export-actions { display:flex; flex-direction:column; align-items:flex-end; gap:9px; max-width:360px; }
.lecture-export-button { display:inline-flex; align-items:center; justify-content:center; gap:9px; border:1px solid #54baff; border-radius:10px; padding:12px 17px; color:#fff; font-weight:750; cursor:pointer; background:linear-gradient(105deg,#176cc7,#5756d8); }
.lecture-export-button:hover:not(:disabled) { filter:brightness(1.12); }
.lecture-export-button:disabled { opacity:.55; cursor:wait; }
.lecture-export-note { font-size:12px; line-height:1.45; text-align:right; color:#a8c2df; }
@media(max-width:600px) { .lecture-export-actions { align-items:stretch; width:100%; max-width:none; }.lecture-export-note { text-align:left; } }
.lecture-fineprint { font-size:12px; color:#91abc6; margin:14px 0 0; }

.lecture-processing { display:flex; align-items:center; gap:12px; margin-top:15px; padding:15px; border-radius:11px; border:1px solid #39789c; background:#103c58; color:#c8edff; }

.lecture-progress-spinner { display:inline-block; width:19px; height:19px; border-radius:50%; border:3px solid #37688a; border-top-color:#83dfff; animation:lecture-spin .9s linear infinite; }

@keyframes lecture-spin { to { transform:rotate(360deg); } }

.lecture-outline-button { background:#153a5e; border:1px solid #3e719a; color:#dcefff; padding:10px 15px; border-radius:9px; white-space:nowrap; font-weight:700; cursor:pointer; }

.lecture-empty { padding:22px; border-radius:12px; border:1px dashed #355779; background:#0a1e35; color:#b4cbe2; }

.lecture-table-wrap { width:100%; overflow-x:auto; border-radius:12px; border:1px solid #2b4c6d; }

.lecture-table { width:100%; border-collapse:collapse; background:#0d233d; color:#d9eaff; min-width:680px; }

.lecture-table th { text-align:left; background:#163454; color:#a9d9f5; font-size:12px; letter-spacing:.025em; padding:15px; }

.lecture-table td { padding:15px; border-top:1px solid #244563; font-size:13px; vertical-align:middle; }

.lecture-table tbody tr:hover { background:#123051; }.lecture-id { color:#91d9ff; font-weight:800; }.lecture-filename { overflow-wrap:anywhere; max-width:500px; }

.lecture-table-actions { display:flex; gap:8px; flex-wrap:wrap; }.lecture-table-actions button { padding:8px 12px; background:#1c4c78; border:1px solid #376e9c; color:#fff; border-radius:8px; font-weight:700; cursor:pointer; }.lecture-table-actions button.lecture-delete { background:#402235; border-color:#804157; color:#ffced7; }.lecture-table-actions button:disabled { opacity:.45; cursor:wait; }

.lecture-extracted-text { width:100%; background:#071a31; color:#e2efff; border:1px solid #2e5479; border-radius:12px; padding:17px; line-height:1.65; }

.lecture-selected { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:22px; border-color:#3279a2; }

.lecture-continue { display:inline-flex; align-items:center; text-decoration:none; color:white; background:linear-gradient(110deg,#116dbd,#5756d8); padding:13px 17px; border-radius:9px; font-weight:750; font-size:13px; }.lecture-continue-bottom { margin-top:18px; }

.lecture-stat-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin:0 0 20px; }

.lecture-stat-grid .summary-card { background:#0b233e; border:1px solid #305678; border-radius:12px; padding:15px; }

.lecture-stat-grid .summary-card span { display:block; color:#a9c5df; font-size:12px; }

.lecture-stat-grid .summary-card strong { display:block; margin-top:7px; font-size:28px; color:#e6f7ff; }

.lecture-alert { margin:18px 0; padding:15px 18px; border:1px solid #43809e; background:#103c57; color:#ddf4ff; border-radius:12px; }

.lecture-workspace button:focus-visible,.lecture-workspace a:focus-visible,.lecture-workspace input:focus-visible { outline:3px solid #8edfff; outline-offset:3px; }

@media(max-width:850px) { .lecture-steps { grid-template-columns:1fr; }.lecture-hero-art { opacity:.28; width:60%; }.lecture-hero-copy { width:100%; }.lecture-content { width:calc(100% - 28px); } }

@media(max-width:600px) { .lecture-topbar-inner { align-items:flex-start; }.lecture-back { font-size:12px; }.lecture-hero { padding:24px; }.lecture-panel { padding:18px; }.lecture-stat-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }.lecture-section-heading { align-items:flex-start; flex-direction:column; }.lecture-action-bar button { width:100%; }.lecture-step { padding:13px; } }

@media(prefers-reduced-motion:reduce) { .lecture-progress-spinner { animation:none; } }

`;



function LectureReview({ mode = "documents" }) {

  const navigate = useNavigate();

  const [downloadingReviewedPdf, setDownloadingReviewedPdf] = useState(false);

  const [searchParams] = useSearchParams();

  const isAIReview = mode === "ai";

  const requestedDocumentId = searchParams.get("document");





  //* -------------------------------------------------------*

  //* FILE / DOCUMENT STATE*

  //* -------------------------------------------------------*



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





  //* -------------------------------------------------------*

  //* SAVED DOCUMENTS STATE*

  //* -------------------------------------------------------*



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





  //* -------------------------------------------------------*

  //* GENERAL PAGE STATE*

  //* -------------------------------------------------------*



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





  //* -------------------------------------------------------*

  //* AUTH HELPERS*

  //* -------------------------------------------------------*



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





  //* -------------------------------------------------------*

  //* NORMALIZE CLAIM*

  //* -------------------------------------------------------*



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





  //* -------------------------------------------------------*

  //* LOAD SAVED DOCUMENT LIST*

  //* -------------------------------------------------------*



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





  //* -------------------------------------------------------*

  //* LOAD ONE SAVED DOCUMENT*

  //* -------------------------------------------------------*



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





  //* -------------------------------------------------------*

  //* DELETE SAVED DOCUMENT*

  //* -------------------------------------------------------*



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



        //* If the document currently open on screen*

        //* was deleted, clear the review screen.*

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



        //* Immediately remove it from the visible list.*

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





  //* -------------------------------------------------------*

  //* LOAD DOCUMENT LIST WHEN PAGE OPENS*

  //* -------------------------------------------------------*



  useEffect(() => {

    loadSavedDocuments();

  }, []);



  //* "Continue to AI Verification" deep-links to this saved document.*

  useEffect(() => {

    if (

      isAIReview &&

      requestedDocumentId &&

      /^\d+$/.test(requestedDocumentId)

    ) {

      loadSavedDocument(Number(requestedDocumentId));

    }

  }, [isAIReview, requestedDocumentId]);





  //* -------------------------------------------------------*

  //* FILE SELECTION*

  //* -------------------------------------------------------*



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





  //* -------------------------------------------------------*

  //* EXTRACT RAW DOCUMENT TEXT*

  //* -------------------------------------------------------*



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





  //* -------------------------------------------------------*

  //* EXTRACT CLAIMS + SAVE DOCUMENT*

  //* -------------------------------------------------------*



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





  //* -------------------------------------------------------*

  //* REVIEW CLAIM WITH AI*

  //* -------------------------------------------------------*



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





  //* -------------------------------------------------------*

  //* SAVE PROFESSOR DECISION*

  //* -------------------------------------------------------*



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





  //* -------------------------------------------------------*

  //* EDIT PROFESSOR CORRECTION*

  //* -------------------------------------------------------*



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





  // Download a PDF using the authenticated professor session.
  // The server, not the browser, determines which corrections are eligible.
  const downloadReviewedPdf = async () => {
    if (!currentDocument?.id || downloadingReviewedPdf) return;

    const token = getProfessorToken();
    if (!token) {
      handleUnauthorized();
      return;
    }

    setDownloadingReviewedPdf(true);
    setMessage("");

    try {
      const response = await fetch(
        `${BACKEND_URL}/documents/${currentDocument.id}/reviewed-pdf`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/pdf",
          },
        }
      );

      if (response.status === 401) {
        handleUnauthorized();
        throw new Error("Your professor session has expired. Please sign in again.");
      }

      if (!response.ok) {
        let detail = `Reviewed PDF generation failed (HTTP ${response.status}).`;
        try {
          const errorPayload = await response.json();
          if (typeof errorPayload.detail === "string") {
            detail = errorPayload.detail;
          } else if (Array.isArray(errorPayload.detail)) {
            detail = errorPayload.detail.map((item) => item.msg || String(item)).join("; ");
          }
        } catch {
          // Keep the HTTP error when the response is not JSON.
        }
        throw new Error(detail);
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.toLowerCase().includes("application/pdf")) {
        throw new Error("The server did not return a PDF file.");
      }

      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error("The server returned an empty PDF.");
      }

      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeBaseName = (currentDocument.filename || "lecture")
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-zA-Z0-9._-]+/g, "_")
        .slice(0, 120) || "lecture";
      link.href = downloadUrl;
      link.download = `${safeBaseName}_reviewed.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Delay revocation briefly so browsers can start the download.
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 30000);
      setMessage("Reviewed PDF generated. Check your browser downloads and verify the document before distributing it.");
    } catch (error) {
      setMessage(error.message || "Unable to download the reviewed PDF.");
    } finally {
      setDownloadingReviewedPdf(false);
    }
  };

  //* -------------------------------------------------------*

  //* FORMAT AI STATUS*

  //* -------------------------------------------------------*



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





  //* -------------------------------------------------------*

  //* FORMAT PROFESSOR DECISION*

  //* -------------------------------------------------------*



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





  //* -------------------------------------------------------*

  //* FORMAT DATE*

  //* -------------------------------------------------------*



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





  //* -------------------------------------------------------*

  //* SUMMARY COUNTS*

  //* -------------------------------------------------------*



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





  //* -------------------------------------------------------*

  //* PAGE*

  //* -------------------------------------------------------*



  return (

    <div className="professor-page lecture-workspace">

      <style>{lectureStyles}</style>

      <header className="professor-header lecture-topbar">

        <div className="lecture-topbar-inner">

          <Link to="/professor" className="lecture-logo" aria-label="Back to professor dashboard">

            <span className="lecture-logo-icon" aria-hidden="true">✧</span>

            <span><strong>Ask Inglis <em>Anatomy AI</em></strong><small>Professor workspace</small></span>

          </Link>

          <Link to="/professor" className="lecture-back">← Dashboard</Link>

        </div>

      </header>



      <main className="professor-content lecture-content">

        <section className="lecture-hero" aria-labelledby="lecture-page-title">

          <div className="lecture-hero-copy">

            <p className="lecture-kicker">HUMAN ANATOMY · PROFESSOR PORTAL</p>

            <h1 id="lecture-page-title">{isAIReview ? "Evidence-led claim review" : "Prepare your lecture material"}</h1>

            <p>{isAIReview

              ? "Inspect saved lecture claims, review BullsAI findings against textbook evidence, and record the final academic decision."

              : "Upload lecture notes, extract the original text and meaningful anatomy claims, then continue to source-grounded review."}</p>

            <div className="lecture-hero-tags" aria-label="Supported workflows">

              <span>PDF & DOCX</span><span>Textbook evidence</span><span>Professor-led decisions</span>

            </div>

          </div>

          <img src={`${import.meta.env.BASE_URL}images/anatomy-hero.webp`} alt="Illustration of human anatomy" className="lecture-hero-art" />

        </section>



        <nav className="lecture-steps" aria-label="Review workflow">

          <Link to="/professor/documents" className={`lecture-step ${!isAIReview ? "lecture-step-current" : ""}`} aria-current={!isAIReview ? "step" : undefined}>

            <span className="lecture-step-number">01</span><span><strong>Upload & extract</strong><small>Lecture notes and claims</small></span>

          </Link>

          <Link to="/professor/ai-review" className={`lecture-step ${isAIReview ? "lecture-step-current" : ""}`} aria-current={isAIReview ? "step" : undefined}>

            <span className="lecture-step-number">02</span><span><strong>Verify & decide</strong><small>AI evidence and review</small></span>

          </Link>

          <div className="lecture-step lecture-step-planned" aria-label="Planned feature">

            <span className="lecture-step-number">03</span><span><strong>Reviewed PDF</strong><small>Export approved corrections</small></span>

          </div>

        </nav>



        {message && <div className="lecture-alert" role="status">{message}</div>}



        {!isAIReview && (

          <section className="lecture-panel lecture-upload-panel" aria-labelledby="lecture-upload-heading">

            <div className="lecture-section-heading">

              <div><p className="lecture-kicker">NEW MATERIAL</p><h2 id="lecture-upload-heading">Upload lecture notes</h2>

                <p>Choose an existing PDF or DOCX. Text extraction and claim extraction are separate actions.</p></div>

              <span className="lecture-section-icon" aria-hidden="true">↥</span>

            </div>

            <label className="lecture-dropzone" htmlFor="lecture-upload-input">

              <span className="lecture-drop-icon" aria-hidden="true">⇧</span>

              <strong>{selectedFile ? selectedFile.name : "Choose a lecture file"}</strong>

              <span>{selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Ready to process` : "PDF or DOCX · Browse files on your computer"}</span>

              <input id="lecture-upload-input" type="file" accept=".docx,.pdf" onChange={handleFileChange} />

            </label>

            <div className="lecture-action-bar">

              <button type="button" onClick={extractText} disabled={!selectedFile || loading || reviewingClaimId !== null}>

                {loading ? "Processing…" : "Extract Document Text"}

              </button>

              <button type="button" className="lecture-primary-action" onClick={extractClaimsFromDocument} disabled={!selectedFile || loading || reviewingClaimId !== null}>

                {loading ? "Processing…" : "Extract & Save Anatomy Claims →"}

              </button>

            </div>

            {loading && <div className="lecture-processing" role="status" aria-live="polite"><span className="lecture-progress-spinner" aria-hidden="true" />Processing the selected lecture. The file is being analyzed by the backend.</div>}

            <p className="lecture-fineprint">The original document remains unchanged. Professor decisions are completed in the verification workspace.</p>

          </section>

        )}



        <section className="lecture-panel" aria-labelledby="lecture-saved-heading">

          <div className="lecture-section-heading">

            <div><p className="lecture-kicker">YOUR LIBRARY</p><h2 id="lecture-saved-heading">Saved lecture documents</h2>

              <p>{isAIReview ? "Open a processed lecture to verify its saved claims." : "Reopen a processed lecture or delete an outdated document."}</p></div>

            <button type="button" onClick={loadSavedDocuments} disabled={loadingDocuments} className="lecture-outline-button">{loadingDocuments ? "Refreshing…" : "↻ Refresh"}</button>

          </div>

          {savedDocuments.length === 0 ? (

            <div className="lecture-empty">{loadingDocuments ? "Loading saved documents…" : isAIReview ? "No processed lectures yet. Upload and extract a lecture first." : "No saved lectures found. Start by uploading your notes above."}</div>

          ) : (

            <div className="table-wrapper lecture-table-wrap"><table className="lecture-table"><thead><tr><th>ID</th><th>Lecture file</th><th>Type</th><th>Uploaded</th><th>Actions</th></tr></thead>

              <tbody>{savedDocuments.map((document) => <tr key={document.id}>

                <td><span className="lecture-id">#{document.id}</span></td>

                <td className="lecture-filename">{document.filename}</td>

                <td>{document.file_type}</td>

                <td>{formatDate(document.uploaded_at)}</td>

                <td><div className="lecture-table-actions">

                  <button type="button" onClick={() => loadSavedDocument(document.id)} disabled={loadingDocumentId !== null || deletingDocumentId !== null || loading}>

                    {loadingDocumentId === document.id ? "Loading…" : documentId === document.id ? "Reload" : isAIReview ? "Open Claims" : "Open"}

                  </button>

                  {!isAIReview && <button type="button" className="lecture-delete" onClick={() => deleteSavedDocument(document)} disabled={deletingDocumentId !== null || loadingDocumentId !== null}>

                    {deletingDocumentId === document.id ? "Deleting…" : "Delete"}

                  </button>}

                </div></td>

              </tr>)}</tbody></table></div>

          )}

        </section>



        {!isAIReview && extractedText && (

          <section className="lecture-panel" aria-labelledby="lecture-extracted-heading">

            <div className="lecture-section-heading"><div><p className="lecture-kicker">TEXT EXTRACTION</p><h2 id="lecture-extracted-heading">Extracted lecture text</h2><p>Read-only preview of the text returned by the backend.</p></div></div>

            <textarea className="lecture-extracted-text" value={extractedText} readOnly rows={12} aria-label="Extracted lecture text" />

          </section>

        )}



        {currentDocument && (

          <section className="lecture-panel lecture-selected" aria-label="Selected lecture">

            <div><p className="lecture-kicker">CURRENT LECTURE</p><h2>{currentDocument.filename}</h2><p>Document ID: {currentDocument.id} · {claims.length} saved claims</p></div>

            <div className="lecture-export-actions">
            {isAIReview && (
              <>
                <button
                  type="button"
                  className="lecture-export-button"
                  onClick={downloadReviewedPdf}
                  disabled={downloadingReviewedPdf || loadingDocumentId !== null || savingDecisionClaimId !== null}
                  aria-busy={downloadingReviewedPdf}
                >
                  {downloadingReviewedPdf ? "Generating reviewed PDF…" : "↓ Download Reviewed PDF"}
                </button>
                <span className="lecture-export-note">A separate PDF is generated. Only eligible professor-approved corrections are applied; verify the PDF before sharing.</span>
              </>
            )}
            {!isAIReview && claims.length > 0 && <Link to={`/professor/ai-review?document=${documentId}`} className="lecture-continue">Continue to AI Verification →</Link>}
          </div>

          </section>

        )}



        {!isAIReview && claims.length > 0 && (

          <section className="lecture-panel" aria-labelledby="lecture-claims-heading">

            <div className="lecture-section-heading"><div><p className="lecture-kicker">EXTRACTION RESULTS</p><h2 id="lecture-claims-heading">Extracted anatomy claims</h2>

              <p>{claims.length} claims saved. Review the original wording before moving to AI verification.</p></div></div>

            <div className="table-wrapper lecture-table-wrap"><table className="lecture-table"><thead><tr><th>Claim #</th><th>Page</th><th>Extracted statement</th></tr></thead>

              <tbody>{claims.map((claim) => <tr key={claim.id}><td>{claim.claim_number}</td><td>{claim.page ?? "—"}</td><td className="lecture-filename">{claim.text}</td></tr>)}</tbody></table></div>

            <Link to={`/professor/ai-review?document=${documentId}`} className="lecture-continue lecture-continue-bottom">Continue to AI Verification →</Link>

          </section>

        )}



        {isAIReview && !currentDocument && (

          <section className="lecture-panel lecture-empty-selection"><h2>Select a lecture to review</h2><p>Open a saved lecture above, or upload and extract a new one first.</p>

            <Link to="/professor/documents" className="lecture-continue">Go to Document Extraction →</Link></section>

        )}



        {isAIReview && claims.length > 0 && (

          <>

            <section className="lecture-panel" aria-labelledby="lecture-ai-summary">

              <div className="lecture-section-heading"><div><p className="lecture-kicker">AI ASSESSMENT</p><h2 id="lecture-ai-summary">Verification overview</h2>

                <p>BullsAI reviews retrieved anatomy evidence. All AI findings require independent academic judgment; the professor makes the final decision.</p></div></div>

              <div className="review-summary lecture-stat-grid">

                {[ ["Total claims", totalClaims], ["AI reviewed", aiReviewedCount], ["Likely correct (legacy status)", likelyCorrectCount], ["Possible errors", possibleErrorCount], ["Needs review", aiNeedsReviewCount], ["Not reviewed", notReviewedCount] ].map(([label, value]) => (

                  <div className="summary-card" key={label}><span>{label}</span><strong>{value}</strong></div>

                ))}

              </div>

            </section>

            <section className="lecture-panel" aria-labelledby="lecture-instructor-review">

              <div className="lecture-section-heading"><div><p className="lecture-kicker">PROFESSOR REVIEW</p><h2 id="lecture-instructor-review">Instructor review</h2>

                <p>Inspect source passages, review AI findings, and save your decisions for each claim.</p></div></div>

              <div className="review-summary lecture-stat-grid">

                {[ ["Total", totalClaims], ["Pending", pendingCount], ["Accepted", acceptedCount], ["Rejected", rejectedCount], ["Edited", editedCount], ["Needs review", professorNeedsReviewCount] ].map(([label, value]) => (

                  <div className="summary-card" key={label}><span>{label}</span><strong>{value}</strong></div>

                ))}

              </div>

              <BulkReviewButton claims={claims} reviewClaimWithAI={(claimId) => reviewClaimWithAI(claimId, true)} disabled={reviewingClaimId !== null || loading} />

              <ClaimReviewCards

                claims={claims}

                reviewClaimWithAI={reviewClaimWithAI}

                saveProfessorDecision={saveProfessorDecision}

                startEditingCorrection={startEditingCorrection}

                saveEditedCorrection={saveEditedCorrection}

                editingClaimId={editingClaimId}

                editCorrectionText={editCorrectionText}

                setEditCorrectionText={setEditCorrectionText}

                cancelEditing={() => { setEditingClaimId(null); setEditCorrectionText(""); }}

                reviewingClaimId={reviewingClaimId}

                savingDecisionClaimId={savingDecisionClaimId}

                formatAIStatus={formatAIStatus}

                getAIStatusClass={getAIStatusClass}

                formatDecision={formatDecision}

              />

            </section>

          </>

        )}

      </main>

    </div>

  );

}



export default LectureReview;


