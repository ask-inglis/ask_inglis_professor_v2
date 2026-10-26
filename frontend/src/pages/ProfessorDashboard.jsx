import { useNavigate } from "react-router-dom";

// Dashboard UI only. Future modules are intentionally informational until
// authenticated API endpoints and their review workflows are implemented.
const styles = `
  .inglis-dashboard { min-height:100vh; color:#edf7ff; background:radial-gradient(circle at 83% 11%,rgba(41,127,205,.18),transparent 37%),radial-gradient(circle at 10% 75%,rgba(55,72,177,.16),transparent 42%),#061326; font-family:inherit; }
  .inglis-dashboard * { box-sizing:border-box; }
  .inglis-header { border-bottom:1px solid rgba(121,184,245,.17); background:rgba(5,17,35,.91); }
  .inglis-header-inner { max-width:1220px; margin:auto; min-height:82px; padding:14px 26px; display:flex; justify-content:space-between; align-items:center; gap:16px; }
  .inglis-brand { display:flex; align-items:center; gap:13px; font-weight:800; letter-spacing:-.02em; }
  .inglis-mark { width:44px; height:44px; display:grid; place-items:center; border:1px solid #365c83; background:#102c4b; color:#82dafa; border-radius:13px; font-size:25px; }
  .inglis-brand small { display:block; margin-top:3px; color:#9dbbd8; font-size:11px; font-weight:500; letter-spacing:0; }
  .inglis-account { display:flex; align-items:center; justify-content:flex-end; flex-wrap:wrap; gap:14px; color:#b6cae3; font-size:13px; overflow-wrap:anywhere; }
  .inglis-logout { color:#e7f2ff; background:#183455; border:1px solid #41638a; padding:10px 16px; border-radius:9px; cursor:pointer; font-weight:700; }
  .inglis-logout:hover { background:#23466d; }
  .inglis-main { max-width:1220px; margin:auto; padding:35px 26px 70px; }
  .inglis-hero { display:grid; grid-template-columns:minmax(0,1.24fr) minmax(260px,.76fr); align-items:center; gap:26px; border:1px solid rgba(103,169,235,.27); border-radius:24px; padding:clamp(26px,4.5vw,55px); background:linear-gradient(120deg,rgba(18,48,82,.98),rgba(6,24,49,.96)); overflow:hidden; }
  .inglis-kicker { margin:0 0 16px; color:#84d9ff; font-size:11px; letter-spacing:.19em; font-weight:800; text-transform:uppercase; }
  .inglis-hero h1 { margin:0 0 20px; font-size:clamp(2rem,4vw,3.8rem); line-height:1.12; letter-spacing:-.05em; }
  .inglis-hero h1 span { color:#80d6ff; }
  .inglis-hero p:not(.inglis-kicker) { color:#b8cce3; line-height:1.8; margin:0; max-width:600px; }
  .inglis-hero-image { width:100%; height:300px; background-image:linear-gradient(to right,#071a32 0%,transparent 22%,transparent 78%,#071a32 100%),url('/images/anatomy-hero.webp'); background-position:center; background-size:cover; border-radius:14px; mask-image:radial-gradient(ellipse 70% 76% at center,#000 47%,transparent 100%); -webkit-mask-image:radial-gradient(ellipse 70% 76% at center,#000 47%,transparent 100%); }
  .inglis-section-header { margin:35px 0 18px; }
  .inglis-section-header h2 { color:#f1f7ff; margin:0 0 7px; font-size:23px; letter-spacing:-.025em; }
  .inglis-section-header p { color:#a8c0db; margin:0; line-height:1.6; }
  .inglis-workspaces { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18px; }
  .inglis-workspace { display:flex; flex-direction:column; align-items:flex-start; padding:27px; border-radius:18px; min-width:0; border:1px solid #295276; background:linear-gradient(155deg,#112f50,#0a203c); }
  .inglis-workspace-top { display:flex; align-items:center; justify-content:space-between; gap:12px; width:100%; }
  .inglis-workspace-icon { display:grid; place-items:center; width:48px; height:48px; border-radius:14px; background:#173f68; border:1px solid #3875a5; color:#8ddafa; font-size:20px; font-weight:800; }
  .inglis-workspace-icon.purple { background:#282d62; border-color:#5c63aa; color:#d2c6ff; }
  .inglis-workspace-icon.teal { background:#123e48; border-color:#347e83; color:#9be9df; }
  .inglis-workspace-icon.amber { background:#42341e; border-color:#937142; color:#ffd99c; }
  .inglis-status { border:1px solid #236a67; border-radius:99px; padding:5px 10px; color:#a4f0cf; background:#0d3d3d; font-size:11px; font-weight:700; white-space:nowrap; }
  .inglis-status.soon { border-color:#5f637a; color:#c4d2e4; background:#28334a; }
  .inglis-workspace h3 { margin:23px 0 9px; color:#f1f7ff; font-size:20px; letter-spacing:-.02em; }
  .inglis-workspace p { margin:0 0 22px; color:#b9cce3; font-size:14px; line-height:1.75; flex:1; }
  .inglis-action { border:1px solid #5f8fff; border-radius:10px; background:linear-gradient(105deg,#157dd9,#5268e9); color:#fff; padding:12px 19px; font:inherit; font-weight:800; cursor:pointer; }
  .inglis-action:hover { filter:brightness(1.1); }
  .inglis-upcoming-note { margin-top:auto; padding:11px 13px; width:100%; border-radius:9px; background:rgba(104,139,182,.11); border:1px dashed rgba(150,184,220,.32); color:#bfcee1; font-size:12px; line-height:1.55; }
  .inglis-architecture-note { color:#96b1ce; font-size:12px; line-height:1.7; text-align:center; margin:30px 0 0; }
  @media(max-width:850px) { .inglis-hero { grid-template-columns:1fr; } .inglis-hero-image { height:240px; max-width:440px; margin:auto; width:100%; } }
  @media(max-width:650px) { .inglis-header-inner { align-items:flex-start; flex-direction:column; } .inglis-main { padding:20px 16px 50px; } .inglis-workspaces { grid-template-columns:1fr; } .inglis-hero { padding:24px 20px; } .inglis-hero-image { height:220px; } .inglis-workspace { padding:22px; } }
`;

function ProfessorDashboard() {
  const navigate = useNavigate();
  const professorEmail = localStorage.getItem("professor_email");

  const handleLogout = () => {
    localStorage.removeItem("professor_token");
    localStorage.removeItem("professor_email");
    navigate("/", { replace: true });
  };

  const openDocumentReview = () => navigate("/professor/documents");
  const openAIReview = () => navigate("/professor/ai-review");

  return (
    <div className="inglis-dashboard">
      <style>{styles}</style>
      <header className="inglis-header">
        <div className="inglis-header-inner">
          <div className="inglis-brand">
            <span className="inglis-mark" aria-hidden="true">✧</span>
            <span>Ask Inglis <span style={{ color: "#8bdcfd" }}>Anatomy AI</span><small>Secure Professor Workspace</small></span>
          </div>
          <div className="inglis-account">
            {professorEmail && <span>{professorEmail}</span>}
            <button type="button" className="inglis-logout" onClick={handleLogout}>Log out</button>
          </div>
        </div>
      </header>

      <main className="inglis-main">
        <section className="inglis-hero" aria-labelledby="inglis-welcome-title">
          <div>
            <p className="inglis-kicker">Human anatomy · Professor portal</p>
            <h1 id="inglis-welcome-title">Anatomy education,<br /><span>backed by evidence.</span></h1>
            <p>Manage lecture materials, analyze meaningful anatomy claims, inspect textbook references, and make the final academic decisions. Reviewed lecture PDFs and student chatbot feedback are the next planned workspaces.</p>
          </div>
          <div className="inglis-hero-image" role="img" aria-label="Anatomical illustration of a human torso and heart" />
        </section>

        <div className="inglis-section-header">
          <h2>Active workspaces</h2>
          <p>Continue with the workflows available in your professor portal.</p>
        </div>
        <section className="inglis-workspaces" aria-label="Available professor tools">
          <article className="inglis-workspace">
            <div className="inglis-workspace-top"><span className="inglis-workspace-icon" aria-hidden="true">PDF</span><span className="inglis-status">Available</span></div>
            <h3>Lecture Notes &amp; Claim Extraction</h3>
            <p>Upload PDF or DOCX lecture notes, extract claims, reopen saved documents, and organize course materials.</p>
            <button className="inglis-action" type="button" onClick={openDocumentReview}>Open Document Review →</button>
          </article>
          <article className="inglis-workspace">
            <div className="inglis-workspace-top"><span className="inglis-workspace-icon purple" aria-hidden="true">AI</span><span className="inglis-status">Available</span></div>
            <h3>AI Verification &amp; Professor Decisions</h3>
            <p>Examine BullsAI assessments and cited evidence, then accept, reject, flag, or edit claims using existing review controls.</p>
            <button className="inglis-action" type="button" onClick={openAIReview}>Open AI Review →</button>
          </article>
        </section>

        <div className="inglis-section-header">
          <h2>Coming next</h2>
          <p>Planned features are shown for navigation planning only. They are not yet active or connected to an API.</p>
        </div>
        <section className="inglis-workspaces" aria-label="Upcoming professor tools">
          <article className="inglis-workspace">
            <div className="inglis-workspace-top"><span className="inglis-workspace-icon teal" aria-hidden="true">↓</span><span className="inglis-status soon">Planned</span></div>
            <h3>Generate Reviewed Lecture PDF</h3>
            <p>Preserve the original document, apply only professor-approved factual corrections, and download a separate reviewed PDF with appropriate citations.</p>
            <div className="inglis-upcoming-note">Available after PDF export and professor-approval integration. Original uploads will remain unchanged.</div>
          </article>
          <article className="inglis-workspace">
            <div className="inglis-workspace-top"><span className="inglis-workspace-icon amber" aria-hidden="true">✉</span><span className="inglis-status soon">Integration planned</span></div>
            <h3>Student Chatbot Feedback</h3>
            <p>View student-reported questions and chatbot answers, request cited AI analysis, and record professor decisions and resolution history.</p>
            <div className="inglis-upcoming-note">Connect to the teammates' chatbot after confirming its feedback API, authentication, and data format.</div>
          </article>
        </section>
        <p className="inglis-architecture-note">AI assessments assist review; final academic decisions remain with the professor. Future modules will not alter existing records without explicit professor actions.</p>
      </main>
    </div>
  );
}

export default ProfessorDashboard;
