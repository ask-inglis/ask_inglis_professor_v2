import React from "react";

// Artificial data only — never real student activity.
const lectureNames = [
  "Upper Limb Anatomy",
  "Cardiovascular System",
  "Nervous System",
  "Muscular System",
];

function generateSampleData(weeks) {
  const trends = [];
  const topics = lectureNames.map((name) => ({
    name,
    count: 0,
  }));
  const quizzes = lectureNames.map((name) => ({
    name,
    correct: 0,
    incorrect: 0,
  }));

  for (let index = 0; index < weeks; index++) {
    const activity = 48 + index * 8;

    trends.push({
      week: index + 1,
      answers: activity,
    });

    topics.forEach((topic, i) => {
      topic.count +=
        Math.max(1, Math.round(activity * (0.35 - i * 0.06)));
    });

    quizzes.forEach((quiz, i) => {
      const answered = 12 + index + i * 2;
      const missed = Math.round(
        answered * (0.4 - i * 0.05 + (index % 3) * 0.02)
      );

      quiz.correct += answered - missed;
      quiz.incorrect += missed;
    });
  }

  return { trends, topics, quizzes };
}

const card = {
  padding: 24,
  background: "#102840",
  border: "1px solid #2b4b68",
  borderRadius: 17,
};

const muted = {
  color: "#aac9db",
  fontSize: 13,
};

function PopularTopics({ topics }) {
  const maximum = Math.max(1, ...topics.map((t) => t.count));

  return (
    <section style={card}>
      <h3>Frequently Asked Topics</h3>
      <p style={muted}>Sample interactions by anatomy topic</p>

      {topics.map((topic) => (
        <div key={topic.name} style={{ marginTop: 22 }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 8,
            fontSize: 13,
          }}>
            <span>{topic.name}</span>
            <strong>{topic.count}</strong>
          </div>

          <div style={{
            height: 12,
            background: "#203e57",
            borderRadius: 10,
            overflow: "hidden",
          }}>
            <div style={{
              width: `${(topic.count / maximum) * 100}%`,
              height: "100%",
              background: "#69d6cf",
              borderRadius: 10,
            }} />
          </div>
        </div>
      ))}
    </section>
  );
}

function QuizPerformance({ quizzes }) {
  return (
    <section style={card}>
      <h3>Quiz Performance</h3>
      <p style={muted}>
        Sample correct and incorrect answer percentages
      </p>

      {quizzes.map((quiz) => {
        const total = quiz.correct + quiz.incorrect;
        const correct = total
          ? (quiz.correct / total) * 100
          : 0;
        const incorrect = 100 - correct;

        return (
          <div key={quiz.name} style={{ marginTop: 22 }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 8,
              fontSize: 13,
            }}>
              <span>{quiz.name}</span>
              <span>{incorrect.toFixed(1)}% incorrect</span>
            </div>

            <div style={{
              display: "flex",
              height: 15,
              borderRadius: 10,
              overflow: "hidden",
              background: "#203e57",
            }}>
              <div style={{
                width: `${correct}%`,
                background: "#69d6cf",
              }} />
              <div style={{
                width: `${incorrect}%`,
                background: "#ed9c78",
              }} />
            </div>
          </div>
        );
      })}

      <p style={{ ...muted, marginTop: 24 }}>
        <span style={{ color: "#69d6cf" }}>●</span> Correct
        {"  "}
        <span style={{ color: "#ed9c78" }}>●</span> Incorrect
      </p>
    </section>
  );
}

function WeeklyActivity({ trends }) {
  const width = 600;
  const height = 200;
  const maximum = Math.max(1, ...trends.map((t) => t.answers));

  const coordinates = trends.map((row, index) => {
    const x = 25 + index * ((width - 50) / Math.max(1, trends.length - 1));
    const y = height - 25 - (row.answers / maximum) * 145;
    return [x, y];
  });

  const points = coordinates.map(([x, y]) => `${x},${y}`).join(" ");

  return (
    <section style={{ ...card, marginTop: 18 }}>
      <h3>Weekly Learning Activity</h3>
      <p style={muted}>
        Sample chatbot activity over {trends.length} weeks
      </p>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Artificial activity trend across ${trends.length} weeks`}
        style={{ width: "100%", marginTop: 20 }}
      >
        {[50, 100, 150].map((y) => (
          <line
            key={y}
            x1="25"
            y1={y}
            x2="575"
            y2={y}
            stroke="#31516a"
            strokeDasharray="5 5"
          />
        ))}

        <polyline
          points={points}
          fill="none"
          stroke="#69d6cf"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {coordinates.map(([cx, cy], index) => (
          <circle
            key={index}
            cx={cx}
            cy={cy}
            r="3.5"
            fill="#69d6cf"
          />
        ))}
      </svg>

      <div style={{
        display: "flex",
        justifyContent: "space-between",
        color: "#aac9db",
        fontSize: 12,
      }}>
        <span>Week 1</span>
        <span>Week {trends.length}</span>
      </div>
    </section>
  );
}

export default function InsightsDemoCharts({ weeks = 4 }) {
  const safeWeeks = [4, 8, 12, 26].includes(weeks) ? weeks : 4;
  const { topics, quizzes, trends } = generateSampleData(safeWeeks);

  return (
    <section style={{ marginTop: 25 }}>
      <div style={{
        padding: 16,
        marginBottom: 20,
        border: "1px solid #8f7853",
        borderRadius: 12,
        background: "#393020",
        color: "#ffe3a9",
      }}>
        <strong>DEMO DATA — NOT REAL STUDENT ACTIVITY</strong>
        <p style={{ marginBottom: 0, fontSize: 13 }}>
          These charts show artificial statistics for the
          selected {safeWeeks}-week period.
        </p>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
        gap: 18,
      }}>
        <PopularTopics topics={topics} />
        <QuizPerformance quizzes={quizzes} />
      </div>

      <WeeklyActivity trends={trends} />
    </section>
  );
}
