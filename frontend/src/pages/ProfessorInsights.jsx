import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./ProfessorInsights.css";
import InsightsDemoCharts from "./InsightsDemoCharts";

const API_URL =
  import.meta.env.VITE_PROFESSOR_API_URL ||
  (import.meta.env.DEV
    ? "http://127.0.0.1:8000"
    : window.location.origin);

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
  const [showDemo, setShowDemo] = useState(false);

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

        const withheld =
          data?.status === "insufficient_anonymous_data" &&
          data?.privacy?.contributor_verification === "unavailable";

        const snapshot =
          data?.status === "reviewed_snapshot_candidate" &&
          data?.weeks_requested === 4 &&
          data?.privacy?.contributor_verification === "not_applicable" &&
          data?.privacy?.reporting_basis ===
            "interaction_activity_not_students";

        if (
          data?.privacy?.individual_data_exposed !== false ||
          (!withheld && !snapshot)
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

        {import.meta.env.DEV && (
          <div style={{ marginBottom: 22 }}>
            <button
              type="button"
              className="pi-back"
              onClick={() => setShowDemo((current) => !current)}
            >
              {showDemo
                ? "Hide Sample Analytics"
                : "Preview Sample Analytics"}
            </button>

            {showDemo && <InsightsDemoCharts weeks={weeks} />}
          </div>
        )}

        {loading ? (
          <div className="pi-message" role="status">
            Loading privacy-protected Insights…
          </div>
        ) : error ? (
          <div className="pi-message pi-error" role="alert">
            {error}
          </div>
        ) : report?.status === "reviewed_snapshot_candidate" ? (
          <>
            <div className="pi-privacy-banner">
              <span className="pi-lock" aria-hidden="true">♧</span>
              <div>
                <strong>Course-wide interaction summary</strong>
                <p>
                  This report describes chatbot interactions, not
                  individual students or unique student counts.
                </p>
              </div>
            </div>

            <div className="pi-stats">
              <div className="pi-stat">
                <span>Course Activity</span>
                <strong>
                  {report.course_activity?.activity_level
                    ?.replaceAll("_", " ")
                    .toUpperCase() || "Not available"}
                </strong>
                <small>
                  {report.course_activity?.period_start} to{" "}
                  {report.course_activity?.period_end}
                </small>
                <small>Four completed reporting weeks</small>
              </div>
            </div>

            <div className="pi-message">
              Detailed topic, quiz, and weekly statistics are
              not included in this reporting snapshot.
            </div>
          </>
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
