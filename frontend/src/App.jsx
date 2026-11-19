import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import "./App.css";

import ProfessorLogin from "./pages/ProfessorLogin";
import ProfessorDashboard from "./pages/ProfessorDashboard";
import LectureReview from "./pages/LectureReview";
import StudentFeedbackInbox from "./pages/StudentFeedbackInbox";

function ProtectedProfessorRoute({ children }) {
  const token = localStorage.getItem("professor_token");

  if (!token) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Routes>
        <Route path="/" element={<ProfessorLogin />} />

        <Route
          path="/professor/login"
          element={<Navigate to="/" replace />}
        />

        <Route
          path="/professor"
          element={
            <ProtectedProfessorRoute>
              <ProfessorDashboard />
            </ProtectedProfessorRoute>
          }
        />

        <Route
          path="/professor/documents"
          element={
            <ProtectedProfessorRoute>
              <LectureReview mode="documents" />
            </ProtectedProfessorRoute>
          }
        />

        <Route
          path="/professor/ai-review"
          element={
            <ProtectedProfessorRoute>
              <LectureReview mode="ai" />
            </ProtectedProfessorRoute>
          }
        />

        <Route
          path="/professor/feedback"
          element={
            <ProtectedProfessorRoute>
              <StudentFeedbackInbox />
            </ProtectedProfessorRoute>
          }
        />

        <Route
          path="/professor/review"
          element={<Navigate to="/professor/documents" replace />}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
