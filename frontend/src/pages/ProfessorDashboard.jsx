import { useNavigate } from "react-router-dom";


function ProfessorDashboard() {
  const navigate = useNavigate();

  const professorEmail =
    localStorage.getItem(
      "professor_email"
    );


  const handleLogout = () => {
    localStorage.removeItem(
      "professor_token"
    );

    localStorage.removeItem(
      "professor_email"
    );

    navigate(
      "/",
      {
        replace: true,
      }
    );
  };


  const openDocumentReview = () => {
    navigate("/professor/documents");
  };

  const openAIReview = () => {
    navigate("/professor/ai-review");
  };


  return (
    <div className="professor-page">

      <header className="professor-header">

        <div>
          <h1>
            Professor Dashboard
          </h1>

          <p>
            Human Anatomy
          </p>
        </div>


        <div className="professor-header-actions">

          <span>
            {professorEmail}
          </span>

          <button
            onClick={handleLogout}
          >
            Logout
          </button>

        </div>

      </header>


      <main className="professor-content">

        <section className="dashboard-welcome">

          <p className="dashboard-eyebrow">
            HUMAN ANATOMY
          </p>

          <h2>
            Course Material Review
          </h2>

          <p>
            Upload lecture notes, extract claims,
            verify them with AI-assisted research,
            inspect sources, and save your final
            instructor decisions.
          </p>

        </section>


        <section className="dashboard-grid">

          <div className="dashboard-tile dashboard-tile-active">

            <div className="dashboard-tile-top">
              <span className="dashboard-icon">
                PDF
              </span>

              <span className="feature-status feature-active">
                Available
              </span>
            </div>

            <h3>
              Documents & Claim Extraction
            </h3>

            <p>
              Upload PDF or DOCX lecture files,
              extract text and anatomy claims,
              reopen saved lectures, and remove
              outdated documents.
            </p>

            <button
              type="button"
              className="dashboard-action-button"
              onClick={openDocumentReview}
            >
              Open Document Review →
            </button>

          </div>


          <div className="dashboard-tile dashboard-tile-active">

            <div className="dashboard-tile-top">

              <span className="dashboard-icon">
                AI
              </span>

              <span className="feature-status feature-active">
                Available
              </span>

            </div>

            <h3>
              AI Verification & Professor Decisions
            </h3>

            <p>
              Open saved claims, run BullsAI assessments,
              inspect explanations, then accept, reject,
              flag, or edit instructor decisions.
            </p>

            <button
              type="button"
              className="dashboard-action-button"
              onClick={openAIReview}
            >
              Open AI Review →
            </button>

          </div>

        </section>

      </main>

    </div>
  );
}


export default ProfessorDashboard;
