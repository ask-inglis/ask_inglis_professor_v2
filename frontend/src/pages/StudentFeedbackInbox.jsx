import { useCallback, useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router-dom";



//* Professor-side UI. Never place the student chatbot admin key in browser code.*

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");



const css = `

  .sfi-page{min-height:100vh;background:radial-gradient(circle at 85% 8%,#123858 0,transparent 32%),#061326;color:#eef6ff;font-family:inherit}

  .sfi-page *{box-sizing:border-box}.sfi-wrap{max-width:1120px;margin:0 auto;padding:34px 22px 80px}

  .sfi-top{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:28px}

  .sfi-back,.sfi-refresh{background:#153455;border:1px solid #3a6489;color:#e4f4ff;border-radius:10px;padding:10px 15px;cursor:pointer;font-weight:700}

  .sfi-back:hover,.sfi-refresh:hover{background:#205079}.sfi-refresh:disabled{opacity:.5;cursor:not-allowed}

  .sfi-head{margin-bottom:26px}.sfi-kicker{text-transform:uppercase;color:#83d8fa;font-weight:800;letter-spacing:.16em;font-size:12px;margin:0 0 10px}

  .sfi-head h1{font-size:clamp(26px,4vw,42px);margin:0 0 11px}.sfi-sub{color:#aec6df;margin:0;line-height:1.6}

  .sfi-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px;margin:22px 0 26px}

  .sfi-stat{border:1px solid #315779;background:#102b48;border-radius:15px;padding:19px}.sfi-stat strong{font-size:29px;display:block}.sfi-stat span{font-size:12px;color:#aec6df}

  .sfi-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 17px}

  .sfi-tabs{display:flex;gap:8px}.sfi-tab{background:#0f2846;color:#bdd3e8;border:1px solid #315779;border-radius:9px;padding:10px 14px;cursor:pointer}

  .sfi-tab[aria-selected=true]{background:#17588a;color:#fff;border-color:#58b5ed}.sfi-mode{padding:7px 11px;border-radius:30px;border:1px solid #41647e;font-size:12px;color:#b9dcf5}

  .sfi-card{background:linear-gradient(145deg,#102b49,#0b213b);border:1px solid #315779;border-radius:18px;padding:23px;margin:0 0 16px}

  .sfi-cardhead{display:flex;justify-content:space-between;align-items:start;gap:18px;flex-wrap:wrap}.sfi-card h2{font-size:19px;margin:0 0 7px;line-height:1.4}

  .sfi-meta{font-size:12px;color:#a9c2df}.sfi-count{border:1px solid #5a7096;background:#1f3959;border-radius:30px;padding:6px 11px;font-size:12px;white-space:nowrap}

  .sfi-fields{display:grid;grid-template-columns:1fr 1fr;gap:13px;margin-top:18px}.sfi-field{background:#081c33;border:1px solid #294765;border-radius:12px;padding:16px;min-width:0}

  .sfi-field h3{margin:0 0 9px;font-size:12px;color:#89ccf2;text-transform:uppercase;letter-spacing:.07em}.sfi-field p{line-height:1.6;margin:0;white-space:pre-wrap;overflow-wrap:anywhere}

  .sfi-comments{margin-top:17px;color:#d9eaff}.sfi-comments h3{font-size:13px;color:#a3cee8;margin:0 0 8px}.sfi-comments ul{margin:0;padding-left:20px;line-height:1.7}

  .sfi-tags{display:flex;flex-wrap:wrap;gap:7px;margin:13px 0 0}.sfi-tag{border:1px solid #395a7c;color:#b8d9f3;padding:5px 9px;border-radius:7px;font-size:12px}

  .sfi-review{margin-top:20px;padding-top:17px;border-top:1px solid #31516e}.sfi-review h3{font-size:15px;margin:0 0 12px}

  .sfi-review select,.sfi-review textarea{width:100%;font:inherit;color:#eaf7ff;background:#091f39;border:1px solid #477095;border-radius:9px;padding:11px}

  .sfi-review textarea{resize:vertical;min-height:77px;margin-top:10px}.sfi-review label{display:block;color:#c4d9ee;font-size:13px;margin-bottom:8px}

  .sfi-verify{display:flex!important;gap:9px;align-items:flex-start;line-height:1.5;margin-top:12px}.sfi-verify input{margin-top:4px}

  .sfi-submit{margin-top:13px;background:linear-gradient(100deg,#1376c4,#5164e2);border:0;color:white;font:inherit;font-weight:800;padding:11px 18px;border-radius:9px;cursor:pointer}

  .sfi-submit:disabled{cursor:not-allowed;opacity:.45}.sfi-notice{border:1px solid #477095;border-radius:12px;background:#102b48;padding:16px;line-height:1.6;margin-bottom:18px;color:#d6eaff}

  .sfi-error{border-color:#ab6474;color:#ffd2da}.sfi-success{border-color:#447f72;color:#c4f5db}.sfi-empty{padding:36px;text-align:center;border:1px dashed #4c6586;border-radius:14px;color:#bdcee2}


  .sfi-ai{margin-top:18px;border-top:1px solid #31516e;padding-top:17px}
  .sfi-ai-button{background:#0c547b;border:1px solid #55b8de;color:#f1fbff;border-radius:10px;padding:10px 15px;font:inherit;font-weight:750;cursor:pointer}
  .sfi-ai-button:disabled{opacity:.55;cursor:not-allowed}
  .sfi-ai-output{margin-top:13px;padding:16px;border:1px solid #376e8e;border-radius:12px;background:#091d34;overflow-wrap:anywhere}
  .sfi-ai-output h3{margin:0 0 10px;font-size:15px;color:#a9e5ff}
  .sfi-ai-output p{line-height:1.65;white-space:pre-wrap;margin:7px 0 12px}
  .sfi-ai-output ul{margin:8px 0 0;padding-left:20px;line-height:1.6}
  .sfi-ai-output li{margin-bottom:10px;white-space:pre-wrap}
  .sfi-ai-output strong{color:#eaf7ff}
  .sfi-ai-muted{color:#a9c2df;font-size:12px;margin-top:9px}


  .sfi-source-list{display:grid;gap:12px;margin-top:12px}
  .sfi-source-card{border:1px solid #315779;border-radius:10px;padding:13px;background:#0d2944}
  .sfi-source-top{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:start}
  .sfi-source-title{font-size:14px;font-weight:750;color:#eaf7ff;overflow-wrap:anywhere}
  .sfi-source-meta{font-size:12px;color:#b7d5ec;margin-top:5px}
  .sfi-source-quality{border:1px solid #477095;border-radius:20px;padding:4px 9px;color:#c2dbee;font-size:12px}
  .sfi-source-excerpt{border-left:3px solid #4b97c6;padding:10px 12px;margin:12px 0 0;background:#061b31;border-radius:0 8px 8px 0;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.65;font-size:13px}

  @media(max-width:690px){.sfi-stats{grid-template-columns:1fr 1fr}.sfi-fields{grid-template-columns:1fr}.sfi-card{padding:17px}}

`;



async function api(path, { method = "GET", body, signal } = {}) {

  const token = localStorage.getItem("professor_token");

  if (!token) throw new Error("Your professor session is missing. Please log in again.");

  let response;

  try {

    response = await fetch(`${API_BASE}${path}`, {

      method, signal,

      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },

      ...(body ? { body: JSON.stringify(body) } : {}),

    });

  } catch (error) {

    if (error.name === "AbortError") throw error;

    throw new Error("Cannot reach the professor backend. Check that it is running on port 8000.");

  }

  if (response.status === 401 || response.status === 403) throw new Error("Professor authentication failed. Please log in again.");

  if (!response.ok) {

    let detail = `Request failed (HTTP ${response.status}).`;

    try { const json = await response.json(); if (typeof json.detail === "string") detail = json.detail; } catch { /** keep fallback **/ }

    throw new Error(detail);

  }

  return response.json();

}




function EvidenceSource({ source, index }) {
  const title = source.title || source.source_title || source.filename || "Indexed anatomy reference";
  const page = source.pdf_page ?? source.page_number;
  const excerpt = source.evidence_text || source.excerpt || source.quote || source.text || "";
  const quality = source.evidence_quality || "insufficient_evidence";
  const qualityLabel = {
    direct_support: "Direct support",
    contradiction: "Contradiction",
    background_context: "Background context",
    insufficient_evidence: "Insufficient evidence",
  }[quality] || String(quality).replaceAll("_", " ");
  const sourceUrl = typeof source.url === "string" && /^https:\/\//i.test(source.url) ? source.url : "";
  const isExternal = Boolean(sourceUrl) || String(source.passage_id || "").startsWith("EXT-");
  const isWikipedia = /(?:^|\.)wikipedia\.org\//i.test(sourceUrl);
  const doi = typeof source.doi === "string" ? source.doi : "";
  const license = source.license || (isWikipedia ? "CC BY-SA 4.0" : "");
  return (
    <div className="sfi-source-card">
      <div className="sfi-source-top">
        <div>
          <div className="sfi-source-title">{index + 1}. {title}</div>
          <div className="sfi-source-meta">
            {isExternal ? (isWikipedia ? "Wikipedia · supplementary source" : "External academic source") : (page != null ? `PDF page ${page}` : "Indexed PDF reference")}
            {source.passage_id ? ` · Passage ${source.passage_id}` : ""}
          </div>
          {sourceUrl && <div className="sfi-source-meta"><a href={sourceUrl} target="_blank" rel="noopener noreferrer" style={{color:"#80d6ff"}}>Open original source ↗</a></div>}
          {doi && <div className="sfi-source-meta">DOI: {doi}</div>}
          {license && <div className="sfi-source-meta">License: {license} · Attribution required unless CC0</div>}
        </div>
        <span className="sfi-source-quality">{qualityLabel}</span>
      </div>
      {excerpt ? (
        <blockquote className="sfi-source-excerpt">{excerpt}</blockquote>
      ) : (
        <p className="sfi-ai-muted">The verification response did not include a passage excerpt.</p>
      )}
    </div>
  );
}


function FeedbackAIReview({ group }) {
  const [checking, setChecking] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [checkError, setCheckError] = useState("");

  const verify = async () => {
    if (checking) return;
    setChecking(true);
    setCheckError("");
    setAssessment(null);
    try {
      const result = await api("/professor/feedback/verify", {
        method: "POST",
        body: {
          question: group.question,
          chatbot_answer: group.answer,
          evidence_limit: 6,
        },
      });
      setAssessment(result);
    } catch (error) {
      setCheckError(error.message || "AI verification could not be completed.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <section className="sfi-ai" aria-label="BullsAI feedback verification">
      <button
        type="button"
        className="sfi-ai-button"
        onClick={verify}
        disabled={checking || !group.question?.trim() || !group.answer?.trim()}
      >
        {checking ? "Verifying with BullsAI…" : assessment ? "Run BullsAI verification again" : "Verify with BullsAI"}
      </button>
      <div className="sfi-ai-muted">Uses indexed PDFs and eligible external references when enabled. AI advice never resolves the report.</div>
      {checkError && <div className="sfi-notice sfi-error" role="alert" style={{ marginTop: 12 }}>{checkError}</div>}
      {assessment && (
        <div className="sfi-ai-output" role="status">
          <h3>BullsAI assessment</h3>
          <p><strong>Verdict:</strong> {assessment.verdict || "Not verified"}</p>
          <p><strong>Status:</strong> {String(assessment.status || "needs_review").replaceAll("_", " ")}</p>
          <p><strong>Reason:</strong> {assessment.reason || "No explanation returned."}</p>
          {assessment.suggested_correction && (
            <p><strong>Suggested correction:</strong> {assessment.suggested_correction}</p>
          )}
          <p><strong>Reference passages checked:</strong> {assessment.evidence_passage_count ?? 0}</p>
          {assessment.external_evidence_passage_count != null && (
            <p><strong>External passages:</strong> {assessment.external_evidence_passage_count} · Academic: {assessment.external_academic_passages ?? 0} · Wikipedia: {assessment.external_wikipedia_passages ?? 0}</p>
          )}
          {Array.isArray(assessment.sources) && assessment.sources.length > 0 ? (
            <section aria-label="Indexed anatomy evidence">
              <strong>Indexed reference passages cited by BullsAI</strong>
              <div className="sfi-source-list">
                {assessment.sources.map((source, index) => (
                  <EvidenceSource
                    key={`${source.reference_id || "reference"}-${source.passage_id || index}`}
                    source={source}
                    index={index}
                  />
                ))}
              </div>
            </section>
          ) : (
            <p className="sfi-ai-muted">No cited reference passages were returned for this assessment.</p>
          )}
          <div className="sfi-ai-muted">Professor confirmation is required. Retrieved passages are not automatically proof of correctness.</div>
        </div>
      )}
    </section>
  );
}


function ReviewForm({ group, onResolved, onFailure }) {

  const [decision, setDecision] = useState("");

  const [comment, setComment] = useState("");

  const [noteUpdated, setNoteUpdated] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const valid = Boolean(decision) && (decision !== "note_fixed" || noteUpdated);

  const submit = async (event) => {

    event.preventDefault();

    if (!valid || !group.fingerprint || submitting) return;

    setSubmitting(true);

    try {

      const result = await api("/professor/feedback/resolve-group", {

        method: "POST", body: { fingerprint: group.fingerprint, decision, comment: comment.trim() },

      });

      onResolved(`Review saved${result.mode === "mock" ? " in demo mode" : ""}. ${result.resolved_count ?? "Group"} report(s) processed.`);

    } catch (error) { onFailure(error.message); }

    finally { setSubmitting(false); }

  };

  return (

    <form className="sfi-review" onSubmit={submit}>

      <h3>Professor resolution</h3>

      <label htmlFor={`sfi-decision-${group.fingerprint}`}>Decision</label>

      <select id={`sfi-decision-${group.fingerprint}`} value={decision} onChange={(e) => { setDecision(e.target.value); setNoteUpdated(false); }}>

        <option value="" disabled>Select professor decision</option>

        <option value="answer_was_correct">Chatbot answer was correct</option>

        <option value="dismissed">Dismiss report</option>

        <option value="note_fixed">Lecture note was corrected</option>

      </select>

      {decision === "note_fixed" && (

        <label className="sfi-verify">

          <input type="checkbox" checked={noteUpdated} onChange={(e) => setNoteUpdated(e.target.checked)} />

          I confirm that the corrected lecture note has already been finalized and updated in the student chatbot's note source.

        </label>

      )}

      <label htmlFor={`sfi-comment-${group.fingerprint}`} style={{ marginTop: 12 }}>Professor comment (optional)</label>

      <textarea id={`sfi-comment-${group.fingerprint}`} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Explain the review decision for the audit trail…" />

      <button className="sfi-submit" type="submit" disabled={submitting || !valid}>{submitting ? "Saving…" : `Resolve group (${group.count || 1} report${group.count === 1 ? "" : "s"})`}</button>

    </form>

  );

}



export default function StudentFeedbackInbox() {

  const navigate = useNavigate();

  const [status, setStatus] = useState("pending_review");

  const [queue, setQueue] = useState(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");

  const [refresh, setRefresh] = useState(0);



  const load = useCallback(() => setRefresh((n) => n + 1), []);

  useEffect(() => {

    const controller = new AbortController();

    setLoading(true); setError("");

    api(`/professor/feedback/queue?limit=50&status=${status}`, { signal: controller.signal })

      .then(setQueue)

      .catch((err) => { if (err.name !== "AbortError") setError(err.message); })

      .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    return () => controller.abort();

  }, [status, refresh]);



  const groups = Array.isArray(queue?.groups) ? queue.groups : [];

  const reports = useMemo(() => groups.reduce((sum, group) => sum + (Number(group.count) || 0), 0), [groups]);

  const success = (message) => { setNotice(message); setError(""); load(); };

  return (

    <div className="sfi-page">

      <style>{css}</style>

      <main className="sfi-wrap">

        <div className="sfi-top"><button type="button" className="sfi-back" onClick={() => navigate("/professor")}>← Professor Dashboard</button><button type="button" className="sfi-refresh" onClick={load} disabled={loading}>Refresh feedback</button></div>

        <header className="sfi-head"><p className="sfi-kicker">Professor workspace · Student chatbot</p><h1>Student Feedback Inbox</h1><p className="sfi-sub">Review real student chatbot feedback, request evidence-grounded BullsAI analysis, and record professor decisions.</p></header>

        <section className="sfi-stats" aria-label="Feedback summary">

          <div className="sfi-stat"><strong>{groups.length}</strong><span>{status === "pending_review" ? "Open groups" : "Resolved groups"}</span></div>

          <div className="sfi-stat"><strong>{reports}</strong><span>Reports in this view</span></div>

          <div className="sfi-stat"><strong>{queue?.mode === "mock" ? "DEMO" : queue?.mode === "live" ? "LIVE" : "—"}</strong><span>Feedback source</span></div>

        </section>

        <div className="sfi-toolbar"><div className="sfi-tabs" role="tablist" aria-label="Feedback status"><button className="sfi-tab" role="tab" aria-selected={status === "pending_review"} onClick={() => { setNotice(""); setStatus("pending_review"); }}>Pending review</button><button className="sfi-tab" role="tab" aria-selected={status === "resolved"} onClick={() => { setNotice(""); setStatus("resolved"); }}>Resolved</button></div>{queue?.mode === "mock" && <span className="sfi-mode">Sample data only · no student records changed</span>}</div>

        {notice && <div role="status" className="sfi-notice sfi-success">{notice}</div>}

        {error && <div role="alert" className="sfi-notice sfi-error">{error}</div>}

        {loading ? <div className="sfi-empty">Loading feedback…</div> : !groups.length ? <div className="sfi-empty">No {status === "pending_review" ? "pending" : "resolved"} feedback groups found.</div> : groups.map((group, index) => (

          <article key={`${group.fingerprint || index}-${group.reason || ""}`} className="sfi-card">

            <div className="sfi-cardhead"><div><h2>{group.question || "Question not provided"}</h2><span className="sfi-meta">{group.reason === "incorrect" ? "Possible factual error" : "Student feedback"} · Last reported: {group.last_seen ? new Date(group.last_seen).toLocaleString() : "Unknown"}</span></div><span className="sfi-count">{group.count || 1} report(s)</span></div>

            <div className="sfi-fields"><div className="sfi-field"><h3>Original student question</h3><p>{group.question || "Not provided"}</p></div><div className="sfi-field"><h3>Chatbot answer</h3><p>{group.answer || "Not provided"}</p></div></div>

            {Array.isArray(group.comments) && group.comments.length > 0 && <div className="sfi-comments"><h3>Student comments</h3><ul>{group.comments.map((item, i) => <li key={i}>{item}</li>)}</ul></div>}

            {Array.isArray(group.lectures) && group.lectures.length > 0 && <div className="sfi-tags">{group.lectures.map((name, i) => <span className="sfi-tag" key={`${name}-${i}`}>{name}</span>)}</div>}

            <FeedbackAIReview key={`${group.fingerprint || index}-${group.reason || ""}`} group={group} />

            {status === "pending_review" ? <ReviewForm group={group} onResolved={success} onFailure={setError} /> : <div className="sfi-meta" style={{ marginTop: 16 }}>Status: resolved{group.decision ? ` · ${group.decision}` : ""}</div>}

          </article>

        ))}

      </main>

    </div>

  );

}


