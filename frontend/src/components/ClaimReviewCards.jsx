
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
      claims.filter((claim) => {
        const text = [
          claim.text,
          claim.reason,
          claim.suggested_correction,
          String(claim.claim_number ?? ""),
          String(claim.page ?? ""),
        ]
          .join(" ")
          .toLowerCase();

        if (!text.includes(query.trim().toLowerCase())) {
          return false;
        }

        if (filter === "all") return true;

        if (filter === "pending") {
          return (
            !claim.instructor_decision ||
            claim.instructor_decision === "pending"
          );
        }

        if (["accepted", "rejected", "edited"].includes(filter)) {
          return claim.instructor_decision === filter;
        }

        return claim.ai_status === filter;
      }),
    [claims, query, filter]
  );

  const busy =
    reviewingClaimId != null ||
    savingDecisionClaimId != null;

  function completeWithAI(claim) {
    if (!claim.suggested_correction?.trim()) {
      reviewClaimWithAI(claim.id);

      setExpanded((old) => ({
        ...old,
        [claim.id]: true,
      }));

      return;
    }

    startEditingCorrection(claim);
    setEditCorrectionText(claim.suggested_correction);

    setExpanded((old) => ({
      ...old,
      [claim.id]: true,
    }));
  }

  return (
    <div className="claim-review-module">
      {/* Search and filters */}
      <div className="claim-review-toolbar">
        <label className="claim-review-search">
          <span>Search claims</span>

          <input
            type="search"
            placeholder="Anatomy term, claim or page..."
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
          />
        </label>

        <label className="claim-review-filter">
          <span>Filter by status</span>

          <select
            value={filter}
            onChange={(event) =>
              setFilter(event.target.value)
            }
          >
            {FILTERS.map((item) => (
              <option
                key={item.value}
                value={item.value}
              >
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="claim-review-count">
        Showing {visible.length} of {claims.length} claims
      </p>

      {visible.length === 0 && (
        <p>No claims match these filters.</p>
      )}

      {/* Claim cards */}
      <div className="claim-review-list">
        {visible.map((claim) => {
          const isExpanded = Boolean(expanded[claim.id]);
          const editing = editingClaimId === claim.id;

          const sources = Array.isArray(claim.sources)
            ? claim.sources
            : [];

          return (
            <article
              className="claim-review-card"
              key={claim.id}
            >
              {/* Claim heading */}
              <div className="claim-review-heading">
                <div>
                  <strong>
                    Claim #{claim.claim_number ?? claim.id}
                  </strong>

                  <span className="claim-review-meta">
                    Page {claim.page ?? "—"} · ID {claim.id}
                  </span>
                </div>

                <div className="claim-review-badges">
                  <span
                    className={`status-badge ${getAIStatusClass(
                      claim.ai_status
                    )}`}
                  >
                    {formatAIStatus(claim.ai_status)}
                  </span>

                  <span className="claim-review-decision">
                    {formatDecision(
                      claim.instructor_decision
                    )}
                  </span>
                </div>
              </div>

              {/* Original claim */}
              <p className="claim-review-original">
                {claim.text}
              </p>

              {/* Professor actions */}
              <div className="claim-review-actions">
                <button
                  type="button"
                  onClick={() =>
                    reviewClaimWithAI(claim.id)
                  }
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
                  onClick={() =>
                    saveProfessorDecision(
                      claim.id,
                      "accepted"
                    )
                  }
                  disabled={busy}
                >
                  Accept
                </button>

                <button
                  type="button"
                  onClick={() =>
                    saveProfessorDecision(
                      claim.id,
                      "rejected"
                    )
                  }
                  disabled={busy}
                >
                  Reject
                </button>

                <button
                  type="button"
                  onClick={() => {
                    startEditingCorrection(claim);

                    setExpanded((old) => ({
                      ...old,
                      [claim.id]: true,
                    }));
                  }}
                  disabled={busy}
                >
                  Edit manually
                </button>

                <button
                  type="button"
                  onClick={() =>
                    completeWithAI(claim)
                  }
                  disabled={busy}
                >
                  Complete with AI
                </button>

                <button
                  type="button"
                  className="claim-review-details-btn"
                  aria-expanded={isExpanded}
                  onClick={() =>
                    setExpanded((old) => ({
                      ...old,
                      [claim.id]: !isExpanded,
                    }))
                  }
                >
                  {isExpanded
                    ? "Hide details"
                    : "Show reasoning & sources"}
                </button>
              </div>

              {savingDecisionClaimId === claim.id && (
                <p>Saving decision...</p>
              )}

              {/* Manual correction editor */}
              {editing && (
                <div className="claim-review-edit">
                  <label htmlFor={`correction-${claim.id}`}>
                    Professor-approved correction
                  </label>

                  <textarea
                    id={`correction-${claim.id}`}
                    rows={4}
                    value={editCorrectionText}
                    onChange={(event) =>
                      setEditCorrectionText(
                        event.target.value
                      )
                    }
                    placeholder="Enter the corrected anatomy statement"
                  />

                  <p className="claim-review-note">
                    AI draft text is not saved until
                    you review and choose Save correction.
                  </p>

                  <div className="claim-review-actions">
                    <button
                      type="button"
                      disabled={
                        busy ||
                        !editCorrectionText.trim()
                      }
                      onClick={() =>
                        saveEditedCorrection(claim.id)
                      }
                    >
                      Save correction
                    </button>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={cancelEditing}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Expandable BullsAI assessment */}
              {isExpanded && (
                <div className="claim-review-details">
                  <h4>BullsAI assessment</h4>

                  <p>
                    {claim.reason &&
                    claim.reason !== "—"
                      ? claim.reason
                      : "Not yet assessed."}
                  </p>

                  <h4>Suggested correction</h4>

                  <p>
                    {claim.suggested_correction ||
                      "No correction suggested."}
                  </p>

                  {claim.professor_correction && (
                    <>
                      <h4>
                        Professor's saved correction
                      </h4>

                      <p>
                        {claim.professor_correction}
                      </p>
                    </>
                  )}

                  <h4>Evidence sources</h4>

                  {sources.length ? (
                    sources.map((source, index) => (
                      <div
                        key={source.id || index}
                        className="claim-review-source"
                      >
                        {source.url?.startsWith(
                          "https://"
                        ) ||
                        source.url?.startsWith(
                          "http://"
                        ) ? (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {source.title ||
                              "Open source"}
                          </a>
                        ) : (
                          <strong>
                            {source.title ||
                              "Source without link"}
                          </strong>
                        )}

                        {source.evidence_text && (
                          <p>
                            {source.evidence_text}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p>
                      No independently retrieved
                      sources attached. This AI
                      assessment is not
                      evidence-verified.
                    </p>
                  )}

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      saveProfessorDecision(
                        claim.id,
                        "needs_review"
                      )
                    }
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
