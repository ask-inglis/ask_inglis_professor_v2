import { useState } from "react";
import { useNavigate } from "react-router-dom";

const BACKEND_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

// Presentation-only update. Existing authentication, storage, and routing stay intact.
// Keep the image at frontend/public/images/anatomy-hero.webp.
const pageStyles = `
  .medical-login {
    min-height: 100vh;
    width: 100%;
    margin: 0;
    padding: clamp(20px, 4vw, 64px);
    display: grid;
    grid-template-columns: minmax(0, 1.12fr) minmax(350px, .88fr);
    align-items: center;
    gap: clamp(32px, 5vw, 90px);
    position: relative;
    isolation: isolate;
    overflow: hidden;
    color: #eef7ff;
    background: #051224;
  }

  .medical-login::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background:
      radial-gradient(ellipse at 70% 35%, rgba(36, 112, 190, .17), transparent 45%),
      radial-gradient(ellipse at 15% 77%, rgba(62, 58, 146, .19), transparent 46%);
  }

  .medical-login-visual {
    min-width: 0;
    width: 100%;
    max-width: 760px;
    justify-self: center;
  }

  .medical-login-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    font-weight: 750;
    font-size: 1.05rem;
    color: #edf7ff;
  }

  .medical-login-brand-icon {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    border-radius: 13px;
    background: rgba(44, 150, 233, .13);
    border: 1px solid rgba(115, 204, 255, .35);
    color: #80daff;
    font-size: 24px;
  }

  .medical-login-kicker {
    margin: 30px 0 10px;
    font-size: .75rem;
    letter-spacing: .19em;
    text-transform: uppercase;
    color: #79d7ff;
    font-weight: 800;
  }

  .medical-login-title {
    margin: 0;
    font-size: clamp(2.25rem, 4.3vw, 4.35rem);
    line-height: 1.08;
    letter-spacing: -.05em;
    font-weight: 800;
    color: #f4f9ff;
  }

  .medical-login-title span { color: #82d6ff; }

  .medical-login-subtitle {
    margin: 18px 0 16px;
    max-width: 580px;
    color: #b4c8df;
    line-height: 1.7;
    font-size: clamp(.93rem, 1.2vw, 1.05rem);
  }

  /* Unframed anatomy artwork; CSS mask fades the image's rectangular edges. */
  .medical-login-image-wrap {
    position: relative;
    width: min(100%, 620px);
    height: clamp(360px, 46vw, 590px);
    margin: 0 auto;
    border: 0;
    border-radius: 0;
    overflow: visible;
    background: transparent;
    box-shadow: none;
  }

  .medical-login-image {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center 27%;
    -webkit-mask-image: radial-gradient(ellipse 62% 61% at 50% 46%, #000 57%, transparent 100%);
    mask-image: radial-gradient(ellipse 62% 61% at 50% 46%, #000 57%, transparent 100%);
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }

  .medical-login-image-caption {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    color: #d1e9ff;
    font-size: .75rem;
  }

  .medical-login-image-caption span {
    border: 1px solid rgba(141, 210, 255, .27);
    border-radius: 999px;
    background: rgba(3, 19, 43, .74);
    padding: 8px 11px;
  }

  .medical-login-panel {
    width: 100%;
    max-width: 470px;
    justify-self: center;
    padding: clamp(25px, 3vw, 44px);
    border: 1px solid rgba(117, 191, 255, .27);
    border-radius: 24px;
    background: linear-gradient(145deg, rgba(20, 43, 76, .95), rgba(7, 21, 43, .96));
    box-shadow: 0 30px 75px rgba(0, 5, 18, .42);
  }

  .medical-login-eyebrow {
    margin: 0 0 15px;
    color: #79d7ff;
    font-size: .73rem;
    font-weight: 800;
    letter-spacing: .14em;
  }

  .medical-login-panel h2 {
    margin: 0 0 10px;
    font-size: clamp(1.8rem, 2.7vw, 2.3rem);
    letter-spacing: -.04em;
    color: #f4f9ff;
  }

  .medical-login-intro {
    margin: 0 0 22px;
    color: #b3c8df;
    font-size: .92rem;
    line-height: 1.65;
  }

  .medical-login-panel form { display: flex; flex-direction: column; }

  .medical-login-panel label {
    font-weight: 700;
    color: #e5f1ff;
    font-size: .85rem;
    margin: 12px 0 8px;
  }

  .medical-login-panel input {
    width: 100%;
    min-width: 0;
    background: #07182f;
    color: #f5fbff;
    border: 1px solid rgba(129, 187, 244, .32);
    border-radius: 10px;
    padding: 13px 14px;
    outline: none;
    font: inherit;
  }

  .medical-login-panel input::placeholder { color: #829cba; }

  .medical-login-panel input:focus-visible {
    border-color: #79d7ff;
    box-shadow: 0 0 0 3px rgba(75, 180, 255, .16);
  }

  .medical-login-panel button[type="submit"] {
    width: 100%;
    min-height: 49px;
    margin-top: 24px;
    border: 0;
    border-radius: 11px;
    color: #fff;
    font-weight: 800;
    font-size: .95rem;
    cursor: pointer;
    background: linear-gradient(105deg, #147fd8, #6561e6);
  }

  .medical-login-panel button[type="submit"]:hover:not(:disabled) {
    background: linear-gradient(105deg, #249be9, #7975f0);
  }

  .medical-login-panel button[type="submit"]:disabled { opacity: .65; cursor: wait; }

  .medical-login-message {
    margin-top: 17px;
    padding: 12px 14px;
    border-radius: 11px;
    border: 1px solid rgba(255, 121, 144, .42);
    background: rgba(152, 33, 65, .18);
    color: #ffd9e0;
    line-height: 1.5;
  }

  .medical-login-footer {
    margin: 22px 0 0;
    color: #9db5d0;
    text-align: center;
    font-size: .77rem;
  }

  @media (max-width: 980px) {
    .medical-login { grid-template-columns: 1fr; gap: 30px; padding: 30px 22px 60px; }
    .medical-login-visual { text-align: center; }
    .medical-login-brand { justify-content: center; }
    .medical-login-subtitle { margin-left: auto; margin-right: auto; }
    .medical-login-image-wrap { height: 410px; max-width: 620px; }
    .medical-login-panel { max-width: 620px; }
  }

  @media (max-width: 550px) {
    .medical-login { padding: 22px 14px 38px; gap: 22px; }
    .medical-login-kicker { margin-top: 20px; }
    .medical-login-title { font-size: 2.35rem; }
    .medical-login-image-wrap { height: 320px; }
    .medical-login-image-caption { font-size: .69rem; }
    .medical-login-panel { padding: 25px 19px; border-radius: 18px; }
  }
`;

function ProfessorLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setMessage("Email and password are required.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");
      const response = await fetch(`${BACKEND_URL}/professor/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      let result = {};
      try {
        result = await response.json();
      } catch {
        result = {};
      }

      if (!response.ok) {
        throw new Error(result.detail || "Login failed.");
      }

      localStorage.setItem("professor_token", result.access_token);
      localStorage.setItem("professor_email", result.professor.email);
      navigate("/professor", { replace: true });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="medical-login">
      <style>{pageStyles}</style>
      <section className="medical-login-visual" aria-label="Ask Inglis Anatomy AI">
        <div className="medical-login-brand">
          <span className="medical-login-brand-icon" aria-hidden="true">✧</span>
          <span>Ask Inglis <span style={{ color: "#84d9ff" }}>Anatomy AI</span></span>
        </div>
        <p className="medical-login-kicker">Precision meets anatomy</p>
        <h1 className="medical-login-title">Explore anatomy.<br /><span>Verify with evidence.</span></h1>
        <p className="medical-login-subtitle">
          Review lecture materials against anatomical references with an AI-assisted workspace built for professors.
        </p>
        <div className="medical-login-image-wrap">
          <img
            className="medical-login-image"
            src="/images/anatomy-hero.webp"
            alt="Detailed blue-toned anatomical illustration of the human body, skeleton, muscles, and heart"
            loading="eager"
          />
          <div className="medical-login-image-caption" aria-label="Platform capabilities">
            <span>Lecture analysis</span>
            <span>Textbook citations</span>
            <span>Professor-led review</span>
          </div>
        </div>
      </section>

      <section className="medical-login-panel" aria-labelledby="professor-login-heading">
        <p className="medical-login-eyebrow">AUTHORIZED PROFESSOR ACCESS</p>
        <h2 id="professor-login-heading">Welcome back</h2>
        <p className="medical-login-intro">
          Sign in to review anatomy claims, inspect source evidence, and record professor decisions.
        </p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="professor-email">University email</label>
          <input
            id="professor-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="professor@buffalo.edu"
            autoComplete="email"
            required
          />
          <label htmlFor="professor-password">Password</label>
          <input
            id="professor-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            autoComplete="current-password"
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in to professor portal →"}
          </button>
        </form>
        {message && <div className="medical-login-message" role="alert">{message}</div>}
        <p className="medical-login-footer">Secure access · Authorized professors only</p>
      </section>
    </main>
  );
}

export default ProfessorLogin;
