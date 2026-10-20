# Anatomy AI — Professor Portal Only

This is the professor-only version of the Anatomy AI project. The student-facing page has been removed. Opening the frontend at `/` now goes directly to the Professor Login page.

## Included professor features

- Secure professor login with Argon2 password hashing and JWT authentication
- Protected professor-only frontend routes and backend endpoints
- PDF and DOCX upload
- Text extraction and anatomy claim extraction
- Saved lecture/document list
- Reopen previously processed documents
- Delete saved documents
- Preliminary AI-assisted claim assessment using the UB BullsAI Model Hub (subject to API compatibility)
- BullsAI returns no external evidence links until a separate retrieval/grounding integration is added
- Single-claim and batch claim review
- Professor decisions: accept, reject, needs review, or edited correction
- Persisted professor decisions, corrections, claims, and document records in SQLite

## Project structure

```text
anatomy-ai-professor-only/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── security.py
│   │   └── services/
│   │       ├── claim_extractor.py
│   │       ├── document_parser.py
│   │       └── providers/
│   │           └── bullsai_provider.py
│   ├── uploads/
│   ├── anatomy_ai.db
│   ├── create_initial_data.py
│   ├── migrate_database.py
│   └── requirements.txt
└── frontend/
    ├── public/
    │   └── favicon.svg
    ├── src/
    │   ├── pages/
    │   │   ├── ProfessorLogin.jsx
    │   │   ├── ProfessorDashboard.jsx
    │   │   └── LectureReview.jsx
    │   ├── App.jsx
    │   ├── App.css
    │   ├── index.css
    │   └── main.jsx
    ├── index.html
    ├── package.json
    ├── package-lock.json
    └── vite.config.js
```

## 1. Run the backend

From the project root:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Set a JWT secret for professor sessions:

```bash
export JWT_SECRET_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(64))')"
```

Set your BullsAI developer API details (obtain the actual values from UB):

```bash
export BULLSAI_API_KEY="YOUR_BULLSAI_API_KEY"
export BULLSAI_BASE_URL="YOUR_BULLSAI_CHAT_API_BASE_URL"
export BULLSAI_MODEL="YOUR_APPROVED_MODEL_ID"
```

Then run FastAPI:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The backend will be available at:

```text
http://127.0.0.1:8000
```

## 2. Professor account

The included SQLite database already contains the professor account used by the existing project:

```text
professor@buffalo.edu
```

Use the password you already created for that account.

For a brand-new database, remove or rename `backend/anatomy_ai.db`, set an initial password, and run the setup script before starting the backend:

```bash
export INITIAL_PROFESSOR_EMAIL="professor@buffalo.edu"
export INITIAL_PROFESSOR_PASSWORD="YOUR_PASSWORD"
python create_initial_data.py
```

`create_initial_data.py` now creates the database tables automatically when starting from an empty database.

## 3. Run the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173/
```

That URL now opens the Professor Login page directly. There is no student page in this version.

## Authentication flow

1. Professor signs in at `/`.
2. The frontend sends credentials to `POST /professor/login`.
3. The backend verifies the Argon2 password hash and returns a JWT access token.
4. The token is stored in browser local storage as `professor_token`.
5. Protected professor API calls send `Authorization: Bearer <token>`.
6. Missing or expired sessions return the professor to `/`.

## Important environment variables

```text
JWT_SECRET_KEY             Required for JWT creation/verification
BULLSAI_API_KEY           Required for BullsAI calls
BULLSAI_BASE_URL          API root (not a chat webpage)
BULLSAI_MODEL             Your approved model identifier
INITIAL_PROFESSOR_EMAIL    Used only when creating initial professor data
INITIAL_PROFESSOR_PASSWORD Used only when creating initial professor data
```

Do not commit real API keys or JWT secrets into source files.

## BullsAI migration caveat

The new adapter **assumes** an OpenAI-compatible `POST {BULLSAI_BASE_URL}/chat/completions` interface authenticated using `Authorization: Bearer`. UB's public website does **not** document the actual endpoint or protocol; verify them using UB's developer-only documentation before using this adapter. If UB uses a different format, adjust `backend/app/services/providers/bullsai_provider.py`.

BullsAI is a **model provider**, not automatically a web source-verification tool. To avoid making unsupported claims, AI suggestions are labeled `needs_review`, include no invented sources, and require a professor decision. To restore evidence-backed verification, integrate a separately approved retrieval/search or curated medical reference source.

For local `.env` settings, the app does not currently call `load_dotenv`; export variables in your shell, or install/configure python-dotenv explicitly. Do not commit secrets. UB-hosted endpoints may require campus VPN.
