import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./ProfessorInsights.css";

const API_URL = "http://127.0.0.1:8000";

const sections = [
  {
    id: "frequently_asked_topics",
    icon: "◈",
    title: "Frequently Asked Topics",
    description: "Discover the anatomy topics students revisit most often.",
  },
  {
    id: "quiz_performance",
    icon: "◎",
    title: "Quiz Performance",
    description: "Identify lectures with higher incorrect-answer rates.",
  },
  {
    id: "dissection_guides",
    icon: "▤",
    title: "Dissection Guide Analytics",
    description: "Understand which dissection guides need additional support.",
  },
  {
    id: "learning_gaps",
    icon: "◇",
    title: "Learning Gaps",
    description: "Highlight recurring areas of difficulty for teaching review.",
  },
];

export default function ProfessorInsights() {
  const navigate = useNavigate();

  const [weeks, setWeeks] = useState(4);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadInsights() {
      setLoading(true);
      setError("");

      try {
        const token = localStorage.getItem("professor_token");

        if (!token) {
          navigate("/", { replace: true });
          return;
        }

        const response = await fetch(
          `${API_URL}/professor/insights/summary?weeks=${weeks}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          }
        );

        if (response.status === 401) {
          navigate("/", { replace: true });
          return;
        }

        if (!response.ok) {
          throw new Error("Unable to load Insights at this time.");
        }

        const data = await response.json();

        if (
          data?.privacy?.individual_data_exposed !== false ||
          data?.privacy?.contributor_verification !== "unavailable"
        ) {
          throw new Error("Unexpected Insights privacy response.");
        }

        setReport(data);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Insights are temporarily unavailable.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadInsights();
    return () => controller.abort();
  }, [weeks, navigate]);

  return (
    <div className="pi-page">
      <div className="pi-shell">
        <header className="pi-header">
          <button
            className="pi-back"
            onClick={() => navigate("/professor")}
          >
            ← Professor Dashboard
          </button>
          <span className="pi-secure">Privacy-first analytics</span>
        </header>

        <section className="pi-hero">
          <div>
            <p className="pi-eyebrow">ASK INGLIS · PROFESSOR WORKSPACE</p>
            <h1>Learning <span>Insights</span></h1>
            <p>
              Understand learning patterns without exposing individual
              student questions, identities, or conversations.
            </p>
          </div>
          <div className="pi-hero-icon" aria-hidden="true">◉</div>
        </section>

        <section className="pi-toolbar">
          <div>
            <h2>Analytics overview</h2>
            <p>Student interaction trends and teaching opportunities</p>
          </div>

          <label>
            Time range
            <select
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value))}
            >
              <option value={4}>Last 4 weeks</option>
              <option value={8}>Last 8 weeks</option>
              <option value={12}>Last 12 weeks</option>
              <option value={26}>Last 26 weeks</option>
            </select>
          </label>
        </section>

        {loading ? (
          <div className="pi-message" role="status">
            Loading privacy-protected Insights…
          </div>
        ) : error ? (
          <div className="pi-message pi-error" role="alert">
            {error}
          </div>
        ) : (
          <>
            <div className="pi-privacy-banner">
              <span className="pi-lock" aria-hidden="true">♧</span>
              <div>
                <strong>Student privacy is protected</strong>
                <p>
                  Individual conversations are never displayed. Analytics
                  remain unavailable until minimum anonymous-contributor
                  requirements can be verified.
                </p>
              </div>
            </div>

            <div className="pi-stats">
              {[
                ["Questions & Topics", "Not available"],
                ["Quiz Performance", "Not available"],
                ["Guide Engagement", "Not available"],
                ["Learning Gaps", "Not available"],
              ].map(([label, value]) => (
                <div className="pi-stat" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <small>Privacy threshold not verified</small>
                </div>
              ))}
            </div>

            <div className="pi-grid">
              {sections.map((section) => (
                <article className="pi-card" key={section.id}>
                  <div className="pi-card-title">
                    <span className="pi-card-icon">{section.icon}</span>
                    <h3>{section.title}</h3>
                  </div>
                  <p>{section.description}</p>

                  <div className="pi-empty">
                    <span className="pi-empty-symbol" aria-hidden="true">▥</span>
                    <strong>Insufficient anonymous data</strong>
                    <span>
                      Results will appear when privacy requirements
                      are satisfied.
                    </span>
                  </div>
                </article>
              ))}
            </div>

            <section className="pi-recommendations">
              <h2>Teaching Recommendations</h2>
              <p>
                Evidence-based recommendations will appear when
                sufficiently protected learning statistics are available.
              </p>
              <div className="pi-rec-empty">
                No recommendations available yet.
              </div>
            </section>

            <footer className="pi-footer">
              Selected period: {report?.weeks_requested ?? weeks} weeks ·
              Minimum contributors:{" "}
              {report?.privacy?.minimum_contributors ?? 10} ·
              No individual student data displayed
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
