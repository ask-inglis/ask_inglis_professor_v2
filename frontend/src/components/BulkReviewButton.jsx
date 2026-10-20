
import { useRef, useState } from "react";

const WAIT_BETWEEN_REQUESTS_MS = 1200;

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
    (claim) =>
      claim.ai_status === "not_reviewed" ||
      !claim.ai_status
  );

  const wait = (milliseconds) =>
    new Promise((resolve) =>
      setTimeout(resolve, milliseconds)
    );

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
    setProgress({
      completed: 0,
      total: queue.length,
      failed: 0,
    });

    let completed = 0;
    let failed = 0;
    let stoppedForError = false;

    try {
      for (const claim of queue) {
        if (stopRequested.current) break;

        setMessage(
          `Verifying claim ${completed + 1} of ${queue.length}...`
        );

        try {
          // The parent function must return true on
          // success and throw an error on failure.
          const result = await reviewClaimWithAI(claim.id);

          if (result !== true) {
            throw new Error(
              "AI verification did not confirm a successful save."
            );
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

        setProgress({
          completed,
          total: queue.length,
          failed,
        });

        if (stoppedForError || stopRequested.current) break;

        if (completed < queue.length) {
          await wait(WAIT_BETWEEN_REQUESTS_MS);
        }
      }

      if (!stoppedForError) {
        if (stopRequested.current) {
          setMessage(
            `Stopped. ${completed} claims verified and saved.`
          );
        } else {
          setMessage(
            `Completed! ${completed} claims verified and saved.`
          );
        }
      }
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }

  return (
    <section
      style={{
        padding: "20px",
        border: "1px solid #dbe3ee",
        borderRadius: "12px",
        background: "#f8fafc",
        marginBottom: "24px",
      }}
    >
      <h3 style={{ marginTop: 0 }}>
        Bulk AI Verification
      </h3>

      <p>
        <strong>{pendingClaims.length}</strong>{" "}
        claims are waiting for BullsAI verification.
      </p>

      {progress.total > 0 && (
        <div>
          <progress
            value={progress.completed}
            max={progress.total}
            style={{
              width: "100%",
              height: "16px",
            }}
          />

          <p aria-live="polite">
            Verified: {progress.completed} / {progress.total}
            {progress.failed > 0 &&
              ` | Failed: ${progress.failed}`}
          </p>
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={reviewAllClaims}
          disabled={
            running ||
            disabled ||
            pendingClaims.length === 0
          }
          style={{
            padding: "11px 18px",
            background: "#1d4ed8",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontWeight: 600,
            cursor: running ? "wait" : "pointer",
          }}
        >
          {running
            ? "Reviewing claims..."
            : "Review All with BullsAI"}
        </button>

        {running && (
          <button
            type="button"
            onClick={() => {
              stopRequested.current = true;
              setMessage(
                "Stopping after the current claim finishes..."
              );
            }}
            style={{
              padding: "11px 18px",
              border: "1px solid #94a3b8",
              borderRadius: "8px",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Stop Review
          </button>
        )}
      </div>

      {message && (
        <p role="status" aria-live="polite">
          {message}
        </p>
      )}

      <small style={{ color: "#64748b" }}>
        Claims are processed sequentially to reduce
        API pressure. Completed assessments are saved
        individually. Stopping does not undo completed
        reviews.
      </small>
    </section>
  );
}
