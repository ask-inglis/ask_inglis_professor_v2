import { useMemo, useState } from "react";
import "./ClaimReviewCards.css";

const FILTERS = [
  { value: "all", label: "All claims" },
  { value: "not_reviewed", label: "Not AI reviewed" },
  { value: "possible_error", label: "Possible errors" },
  { value: "needs_review", label: "Needs AI review" },
  { value: "pending", label: "Professor pending" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "edited", label: "Edited" },
];

const EVIDENCE_LABELS = {
  direct_support: {
    label: "Direct support",
    background: "#dcfce7",
    color: "#166534",
  },
  contradiction: {
    label: "Contradiction",
    background: "#fee2e2",
    color: "#991b1b",
  },
  background_context: {
    label: "Background context",
    background: "#e2e8f0",
    color: "#334155",
  },
  insufficient_evidence: {
    label: "Insufficient evidence",
    background: "#fef3c7",
    color: "#92400e",
  },
};

function EvidenceBadge({ quality }) {
  const category = EVIDENCE_LABELS[quality];
  const style = category || {
    label: "Not classified",
    background: "#f1f5f9",
    color: "#475569",
  };

  return (
    <span
      title={
        category
          ? "AI-assessed evidence relationship; professor verification required"
          : "This source has no saved evidence-quality classification"
      }
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 9px",
        borderRadius: "999px",
        background: style.background,
        color: style.color,
        fontSize: "0.76rem",
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {style.label}
    </span>
  );
}

function EvidenceSource({ source, index }) {
  const canOpen =
    typeof source.url === "string" &&
    /^https?:\/\//i.test(source.url);
  const passage = source.passage_id;
  const page = source.pdf_page;
  const hasExcerpt = Boolean(source.evidence_text);

  return (
    <div className="claim-review-source">
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          marginBottom: "8px",
        }}
      >
        <div style={{ overflowWrap: "anywhere", minWidth: 0 }}>
          {canOpen ? (
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              {source.title || "Open source"}
            </a>
          ) : (
            <strong>{source.title || `Reference source ${index + 1}`}</strong>
          )}
        </div>
        <EvidenceBadge quality={source.evidence_quality} />
      </div>

      {(passage || page) && (
        <p style={{ fontSize: "0.82rem", color: "#475569", margin: "4px 0 8px" }}>
          {passage ? `Passage ${passage}` : ""}
          {passage && page ? " · " : ""}
          {page ? `PDF page ${page}` : ""}
        </p>
      )}

      {hasExcerpt ? (
        <details>
          <summary
            style={{
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.86rem",
              padding: "4px 0",
            }}
          >
            Read textbook evidence
          </summary>
          <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {source.evidence_text}
          </p>
        </details>
      ) : (
        <p style={{ color: "#64748b" }}>No passage excerpt saved.</p>
      )}
    </div>
  );
}

export default function ClaimReviewCards({
  claims,
  reviewClaimWithAI,
  saveProfessorDecision,
  startEditingCorrection,
  saveEditedCorrection,
  editingClaimId,
  editCorrectionText,
  setEditCorrectionText,
  cancelEditing,
  reviewingClaimId,
  savingDecisionClaimId,
  formatAIStatus,
  getAIStatusClass,
  formatDecision,
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState({});

  const visible = useMemo(
    () =>
      (claims || []).filter((claim) => {
        const text = [
          claim.text,
          claim.reason,
          claim.ai_reason,
          claim.suggested_correction,
          String(claim.claim_number ?? ""),
          String(claim.page ?? ""),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!text.includes(query.trim().toLowerCase())) return false;
        if (filter === "all") return true;
        if (filter === "pending") {
          return !claim.instructor_decision || claim.instructor_decision === "pending";
        }
        if (["accepted", "rejected", "edited"].includes(filter)) {
          return claim.instructor_decision === filter;
        }
        return claim.ai_status === filter;
      }),
    [claims, query, filter]
  );

  const busy = reviewingClaimId != null || savingDecisionClaimId != null;

  function completeWithAI(claim) {
    if (!claim.suggested_correction?.trim()) {
      reviewClaimWithAI(claim.id);
      setExpanded((old) => ({ ...old, [claim.id]: true }));
      return;
    }
    startEditingCorrection(claim);
    setEditCorrectionText(claim.suggested_correction);
    setExpanded((old) => ({ ...old, [claim.id]: true }));
  }

  return (
    <div className="claim-review-module">
      <div className="claim-review-toolbar">
        <label className="claim-review-search">
          <span>Search claims</span>
          <input
            type="search"
            placeholder="Anatomy term, claim or page..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="claim-review-filter">
          <span>Filter by status</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            {FILTERS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="claim-review-count">
        Showing {visible.length} of {(claims || []).length} claims
      </p>

      {visible.length === 0 && <p>No claims match these filters.</p>}

      <div className="claim-review-list">
        {visible.map((claim) => {
          const isExpanded = Boolean(expanded[claim.id]);
          const editing = editingClaimId === claim.id;
          const sources = Array.isArray(claim.sources) ? claim.sources : [];

          return (
            <article className="claim-review-card" key={claim.id}>
              <div className="claim-review-heading">
                <div>
                  <strong>Claim #{claim.claim_number ?? claim.id}</strong>
                  <span className="claim-review-meta">
                    Page {claim.page ?? "—"} · ID {claim.id}
                  </span>
                </div>
                <div className="claim-review-badges">
                  <span className={`status-badge ${getAIStatusClass(claim.ai_status)}`}>
                    {formatAIStatus(claim.ai_status)}
                  </span>
                  <span className="claim-review-decision">
                    {formatDecision(claim.instructor_decision)}
                  </span>
                </div>
              </div>

              <p className="claim-review-original">{claim.text}</p>

              <div className="claim-review-actions">
                <button
                  type="button"
                  onClick={() => reviewClaimWithAI(claim.id)}
                  disabled={busy}
                >
                  {reviewingClaimId === claim.id
                    ? "Reviewing..."
                    : claim.ai_status === "not_reviewed"
                      ? "Verify with BullsAI"
                      : "Review again"}
                </button>
                <button
                  type="button"
                  onClick={() => saveProfessorDecision(claim.id, "accepted")}
                  disabled={busy}
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => saveProfessorDecision(claim.id, "rejected")}
                  disabled={busy}
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => {
                    startEditingCorrection(claim);
                    setExpanded((old) => ({ ...old, [claim.id]: true }));
                  }}
                  disabled={busy}
                >
                  Edit manually
                </button>
                <button
                  type="button"
                  onClick={() => completeWithAI(claim)}
                  disabled={busy}
                >
                  Complete with AI
                </button>
                <button
                  type="button"
                  className="claim-review-details-btn"
                  aria-expanded={isExpanded}
                  onClick={() =>
                    setExpanded((old) => ({ ...old, [claim.id]: !isExpanded }))
                  }
                >
                  {isExpanded ? "Hide details" : "Show reasoning & sources"}
                </button>
              </div>

              {savingDecisionClaimId === claim.id && <p>Saving decision...</p>}

              {editing && (
                <div className="claim-review-edit">
                  <label htmlFor={`correction-${claim.id}`}>
                    Professor-approved correction
                  </label>
                  <textarea
                    id={`correction-${claim.id}`}
                    rows={4}
                    value={editCorrectionText}
                    onChange={(event) => setEditCorrectionText(event.target.value)}
                    placeholder="Enter the corrected anatomy statement"
                  />
                  <p className="claim-review-note">
                    AI draft text is not saved until you review and choose Save correction.
                  </p>
                  <div className="claim-review-actions">
                    <button
                      type="button"
                      disabled={busy || !editCorrectionText.trim()}
                      onClick={() => saveEditedCorrection(claim.id)}
                    >
                      Save correction
                    </button>
                    <button type="button" disabled={busy} onClick={cancelEditing}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {isExpanded && (
                <div className="claim-review-details">
                  <h4>BullsAI assessment</h4>
                  <p>
                    {(claim.reason && claim.reason !== "—" ? claim.reason : null) ||
                      (claim.ai_reason && claim.ai_reason !== "—" ? claim.ai_reason : null) ||
                      "Not yet assessed."}
                  </p>

                  <h4>Suggested correction</h4>
                  <p>{claim.suggested_correction || "No correction suggested."}</p>

                  {claim.professor_correction && (
                    <>
                      <h4>Professor's saved correction</h4>
                      <p>{claim.professor_correction}</p>
                    </>
                  )}

                  <h4>Evidence sources</h4>
                  {sources.length ? (
                    <>
                      <p className="claim-review-note">
                        Evidence labels are generated by BullsAI and require professor verification.
                        Older reviews may show “Not classified” until reviewed again.
                      </p>
                      {sources.map((source, index) => (
                        <EvidenceSource
                          key={source.id ?? source.passage_id ?? index}
                          source={source}
                          index={index}
                        />
                      ))}
                    </>
                  ) : (
                    <p>
                      No independently retrieved sources attached. This AI assessment is not
                      evidence-verified.
                    </p>
                  )}

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => saveProfessorDecision(claim.id, "needs_review")}
                  >
                    Mark for further review
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
