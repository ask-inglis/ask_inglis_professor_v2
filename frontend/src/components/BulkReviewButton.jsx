import { useRef, useState } from "react";

const WAIT_BETWEEN_REQUESTS_MS = 1200;

const styles = {
  panel: {
    padding: "clamp(18px, 3vw, 26px)",
    border: "1px solid rgba(112, 191, 255, 0.25)",
    borderRadius: "16px",
    background: "linear-gradient(145deg, #112b4c 0%, #0b1c35 100%)",
    boxShadow: "0 16px 34px rgba(0, 7, 24, 0.23)",
    marginBottom: "24px",
    color: "#e9f4ff",
  },
  heading: {
    margin: "0 0 10px",
    color: "#f2f8ff",
    fontSize: "1.15rem",
    fontWeight: 750,
    letterSpacing: "-0.02em",
  },
  description: {
    color: "#bbd1e8",
    lineHeight: 1.6,
    margin: "0 0 18px",
  },
  progress: {
    width: "100%",
    height: "14px",
    accentColor: "#50bfff",
    borderRadius: "999px",
  },
  progressText: {
    color: "#d7eaff",
    fontSize: "0.9rem",
    margin: "8px 0 16px",
  },
  actions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  primaryButton: {
    padding: "11px 18px",
    background: "linear-gradient(105deg, #177ed8, #655ee5)",
    color: "#fff",
    border: "1px solid rgba(145, 205, 255, 0.3)",
    borderRadius: "10px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "11px 18px",
    border: "1px solid rgba(157, 195, 232, 0.45)",
    borderRadius: "10px",
    background: "#233f61",
    color: "#f2f8ff",
    fontWeight: 700,
    cursor: "pointer",
  },
  status: {
    margin: "14px 0 0",
    color: "#c9e7ff",
    lineHeight: 1.55,
  },
  note: {
    display: "block",
    marginTop: "14px",
    color: "#9fb9d4",
    lineHeight: 1.6,
    fontSize: "0.8rem",
  },
};

export default function BulkReviewButton({
  claims = [],
  reviewClaimWithAI,
  disabled = false,
}) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({
    completed: 0,
    total: 0,
    failed: 0,
  });
  const [message, setMessage] = useState("");
  const stopRequested = useRef(false);
  const runningRef = useRef(false);

  const pendingClaims = claims.filter(
    (claim) => claim.ai_status === "not_reviewed" || !claim.ai_status
  );

  const wait = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));

  async function reviewAllClaims() {
    if (runningRef.current || disabled) return;

    const queue = [...pendingClaims];

    if (queue.length === 0) {
      setMessage("All claims have already been AI reviewed.");
      return;
    }

    const confirmed = window.confirm(
      `Review ${queue.length} unreviewed claims with BullsAI?\n\n` +
        "Each claim will be processed individually. " +
        "This may take several minutes and use your API quota. " +
        "Professor decisions will not be changed."
    );

    if (!confirmed) return;

    runningRef.current = true;
    stopRequested.current = false;
    setRunning(true);
    setMessage("Starting BullsAI verification...");
    setProgress({ completed: 0, total: queue.length, failed: 0 });

    let completed = 0;
    let failed = 0;
    let stoppedForError = false;

    try {
      for (const claim of queue) {
        if (stopRequested.current) break;

        setMessage(`Verifying claim ${completed + 1} of ${queue.length}...`);

        try {
          // The parent function must return true on success and throw on failure.
          const result = await reviewClaimWithAI(claim.id);

          if (result !== true) {
            throw new Error("AI verification did not confirm a successful save.");
          }

          completed += 1;
        } catch (error) {
          failed += 1;
          stoppedForError = true;
          setMessage(
            `Verification stopped at claim ${claim.id}: ` +
              (error.message || "Unknown error")
          );
        }

        setProgress({ completed, total: queue.length, failed });

        if (stoppedForError || stopRequested.current) break;

        if (completed < queue.length) {
          await wait(WAIT_BETWEEN_REQUESTS_MS);
        }
      }

      if (!stoppedForError) {
        if (stopRequested.current) {
          setMessage(`Stopped. ${completed} claims verified and saved.`);
        } else {
          setMessage(`Completed! ${completed} claims verified and saved.`);
        }
      }
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }

  return (
    <section style={styles.panel} aria-label="Bulk AI Verification">
      <h3 style={styles.heading}>Bulk AI Verification</h3>
      <p style={styles.description}>
        <strong style={{ color: "#f3f9ff" }}>{pendingClaims.length}</strong>{" "}
        claims are waiting for BullsAI verification.
      </p>

      {progress.total > 0 && (
        <div>
          <progress
            value={progress.completed}
            max={progress.total}
            style={styles.progress}
            aria-label="Bulk AI review progress"
          />
          <p style={styles.progressText} aria-live="polite">
            Verified: {progress.completed} / {progress.total}
            {progress.failed > 0 && ` | Failed: ${progress.failed}`}
          </p>
        </div>
      )}

      <div style={styles.actions}>
        <button
          type="button"
          onClick={reviewAllClaims}
          disabled={running || disabled || pendingClaims.length === 0}
          style={{
            ...styles.primaryButton,
            cursor: running ? "wait" : "pointer",
            opacity: running || disabled || pendingClaims.length === 0 ? 0.75 : 1,
          }}
        >
          {running ? "Reviewing claims..." : "Review All with BullsAI"}
        </button>

        {running && (
          <button
            type="button"
            onClick={() => {
              stopRequested.current = true;
              setMessage("Stopping after the current claim finishes...");
            }}
            style={styles.secondaryButton}
          >
            Stop Review
          </button>
        )}
      </div>

      {message && (
        <p style={styles.status} role="status" aria-live="polite">
          {message}
        </p>
      )}

      <small style={styles.note}>
        Claims are processed sequentially to reduce API pressure. Completed
        assessments are saved individually. Stopping does not undo completed
        reviews.
      </small>
    </section>
  );
}
