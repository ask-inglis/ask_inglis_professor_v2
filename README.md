# Ask Inglis Anatomy AI — Professor Portal

**CDA 650 | University at Buffalo**

An AI-powered anatomy lecture review and student feedback management system using FastAPI, React, UB BullsAI, and evidence-based verification.

## 1. Project Overview

Ask Inglis Anatomy AI is a collaborative project designed to help anatomy professors review lecture materials and improve the accuracy of AI-generated answers provided to students.

The project consists of two independent applications:

1. **Professor Dashboard** — Allows professors to upload lecture notes, extract anatomy claims, verify them with AI, review evidence, and manage student feedback.
2. **Student Chatbot** — Allows students to ask anatomy questions, receive answers grounded in lecture notes, and submit feedback when answers are incorrect or unclear.

The applications communicate through protected backend APIs.

### Project Repositories

**Professor Dashboard:**
`ask_inglis_professor_v2`

**Student Chatbot:**
https://github.com/ask-inglis/ask_inglis_chatbot

**Private Lecture Notes Repository:**
`ask-inglis/ask_inglis_notes`

The notes repository stores lecture material and feedback records and is accessed through the Student Chatbot backend.

**Proxy (nginx):**
`ask_inglis_proxy`

The proxy routes web addresses to the two applications on the droplet.

### Live Addresses

| Address | What it is |
|---|---|
| https://inglis.gansonstreet.com/ask_inglis_professor/ | Professor Dashboard |
| https://inglis.gansonstreet.com/ask_inglis_chatbot/ | Student Chatbot |
| https://profapi.159-203-143-149.sslip.io | Professor backend (API only; the `/docs` pages are hidden) |
| https://prof.159-203-143-149.sslip.io | Older Professor Dashboard address; it redirects to the new one |

How the live site is deployed is described in section 19.

---

## 2. Technologies Used

### Frontend
- React
- JavaScript / JSX
- Vite
- HTML and CSS

### Backend
- Python
- FastAPI
- Uvicorn
- REST APIs
- JWT Authentication
- SQLite

### AI and Retrieval
- UB BullsAI API
- Gemini API (Student Chatbot)
- ChromaDB (Student Chatbot)
- Professor-owned reference PDF indexing
- Evidence-grounded claim verification

### External References
- Wikipedia
- PubMed
- Europe PMC
- Academic research articles with eligible reuse permissions

### Integration and Version Control
- Git
- GitHub
- GitHub App authentication
- GitHub API
- GitHub Desktop

---

## 3. Professor Dashboard Features

### 3.1 Professor Authentication

The Professor Dashboard provides an independent authentication system.

Features:
- Professor login
- Password-based authentication
- JWT-protected API endpoints
- Access control for professor-only operations
- Protected lecture and feedback workflows

Students cannot directly access professor-only review features.

### 3.2 Lecture Document Upload

Professors can upload anatomy lecture materials.

Supported formats:
- PDF
- DOCX

The backend processes uploaded documents and extracts anatomy-related content for review.

### 3.3 AI Claim Extraction

The system identifies anatomical claims from uploaded lecture documents.

The extracted claims are displayed individually in the Professor Dashboard.

Professors can:
- View extracted claims
- Search claims
- Filter claims by status
- Review individual claims
- Review multiple claims

### 3.4 BullsAI Claim Verification

The Professor Dashboard integrates with the University at Buffalo BullsAI API.

> **Note: in the current setup the `BULLSAI_*` settings point to Gemini, not to BullsAI.** The settings keep their BullsAI names because the code talks to an OpenAI-compatible service, and Gemini offers one. `BULLSAI_BASE_URL` is Google's Gemini address, `BULLSAI_MODEL` is a Gemini model, and `BULLSAI_API_KEY` holds a Gemini key. BullsAI itself can only be reached from UB's network, so the live droplet cannot use it.

BullsAI analyzes anatomical statements using retrieved reference evidence.

The assessment can include:
- Claim verdict
- Verification status
- Reasoning and explanation
- Suggested correction
- Supporting citations
- Evidence-quality classification

A claim may be classified as correct, potentially incorrect, or requiring further review, depending on the evidence.

AI assessments are advisory. Final decisions remain with the professor.

### 3.5 Professor Review Controls

Professors can manage claims through the following controls:

1. **Accept** — Approve a claim.
2. **Reject** — Reject a claim.
3. **Edit Manually** — Make corrections directly.
4. **Complete with AI** — Request AI-assisted claim improvement.

These controls support human oversight of lecture content.

### 3.6 Reviewed Lecture PDF

The professor workflow includes reviewed-document generation.

After reviewing the lecture material, professors can generate and download a reviewed PDF.

---

## 4. External Evidence Verification

BullsAI verification supports both professor-uploaded reference PDFs and eligible external references.

### Local Reference Verification

Professors upload reference PDFs that are indexed for evidence retrieval.

The system searches relevant passages and retains source information such as:
- Reference title
- Passage identifier
- PDF page number
- Evidence excerpt

### External Reference Discovery

External research integrates:

**Wikipedia**
- Searches relevant anatomy articles.
- Retrieves useful article passages.
- Can search relevant sections beyond introductory text.
- Provides article URLs and attribution information.

**PubMed**
- Searches biomedical research publications.
- Retrieves relevant publication metadata.
- Provides academic titles, identifiers, and links.

**Europe PMC**
- Searches biomedical literature.
- Retrieves eligible full-text passages where supported.
- Applies source licensing restrictions.

### External Evidence Processing

The system:

1. Identifies anatomical search terms.
2. Searches local and external sources.
3. Retrieves candidate evidence passages.
4. Ranks passages for relevance.
5. Passes eligible evidence to BullsAI.
6. Evaluates the anatomical claim.
7. Displays explanations and citations.

Search matches are not automatically considered proof of correctness.

### Verified Example

**Claim:**

"The biceps brachii muscle is supplied by the musculocutaneous nerve."

The system retrieved evidence from the Wikipedia article "Musculocutaneous nerve."

BullsAI identified direct support for the anatomical relationship.

Observed assessment:
- Verdict: Correct
- Status: Likely correct
- External citation: Musculocutaneous nerve
- Evidence quality: Direct support
- Professor confirmation: Required

Academic full-text coverage and broader lecture-claim verification still require additional testing.

---

## 5. Student Chatbot Feedback Integration

The Professor Dashboard integrates with the Student Chatbot through protected backend APIs.

Students can submit feedback when they believe a chatbot answer is incorrect or unclear.

### Complete Feedback Workflow

**Step 1 — Student asks a question**

The student enters an anatomy question in the Student Chatbot.

**Step 2 — AI generates an answer**

The Student Chatbot generates an answer using its configured AI provider and retrieved lecture material.

**Step 3 — Student submits feedback**

Students can use:
- Thumbs-up
- Thumbs-down
- Feedback comments
- Answer dispute functionality, where available

**Step 4 — Feedback is saved to GitHub**

The Student Chatbot backend saves feedback as JSON records in the private GitHub notes repository.

Example structure:

```text
ask_inglis_notes/
└── feedback/
    ├── up/
    │   └── feedback_id.json
    └── down/
        └── feedback_id.json
```

Records can contain:
- Student question
- Chatbot answer
- Feedback rating
- Student comment
- Related lectures
- Feedback identifier
- Timestamp
- Review status

**Step 5 — Professor Dashboard retrieves feedback**

The Professor Dashboard communicates with the Student Chatbot backend using an authenticated server-to-server API.

**Step 6 — Professor reviews feedback**

The inbox displays:
- Original student question
- Chatbot answer
- Student comments
- Lecture sources
- Feedback grouping and report counts

**Step 7 — BullsAI verifies the reported answer**

The professor can request evidence-grounded verification using indexed PDFs and eligible external references.

**Step 8 — Professor makes a decision**

The professor can record a decision to:
- Confirm the answer was correct
- Confirm that the relevant note was fixed
- Dismiss the report

Feedback resolution remains a human decision.

---

## 6. GitHub App Integration

The Student Chatbot backend uses GitHub App authentication to access the private notes repository.

The GitHub App is used for:
- Lecture note ingestion
- Feedback submission
- Feedback record updates

### GitHub Bot Identity

Configured GitHub App bot:

`ask-inglis-bot[bot]`

Feedback submission commits have been verified as authored by the GitHub App bot.

Example commit:

```text
Add down feedback
Author: ask-inglis-bot[bot]
Status: Verified
```

Earlier feedback-resolution commits were attributed to a developer account.

Bot attribution for a newly created feedback-resolution commit still requires final end-to-end verification.

---

## 7. Local Development Architecture

The Professor Dashboard and Student Chatbot use separate frontend and backend servers.

| Application | Port |
|------------|------|
| Professor Backend | 8000 |
| Professor Frontend | 5173 |
| Student Chatbot Backend | 8002 |
| Student Chatbot Frontend | 5174 |

### Application Communication

```text
STUDENT CHATBOT
React Frontend (5174)
        |
        v
FastAPI Backend (8002)
        |
        v
Private GitHub Notes Repository
        |
        | Protected feedback API
        v
PROFESSOR DASHBOARD
FastAPI Backend (8000)
        |
        v
React Frontend (5173)
        |
        v
Professor Feedback Inbox
        |
        v
BullsAI Verification
        |
        v
Professor Decision
```

The Professor Dashboard accesses the Student Chatbot's protected feedback API using a shared administrator key.

---

## 8. Running the Student Chatbot

The following instructions use the latest cloned Student Chatbot repository.

### 8.1 Student Backend

Open a terminal in Student Chatbot VS Code.

```bash
cd ~/Downloads/ask_inglis_chatbot_latest/backend

set -a
source .env
set +a

./.venv/bin/python -m uvicorn main:app \
  --host 127.0.0.1 \
  --port 8002
```

Backend URL:

http://127.0.0.1:8002

### Backend Dependencies

For a fresh clone, create a virtual environment and install the dependencies:

```bash
cd ~/Downloads/ask_inglis_chatbot_latest/backend

python3 -m venv .venv

./.venv/bin/python -m pip install -r requirements.txt
```

The current PowerPoint ingestion module also imports `pptx`.

If the import is missing:

```bash
./.venv/bin/python -m pip install python-pptx
```

### 8.2 Student Frontend

Open a second terminal.

```bash
cd ~/Downloads/ask_inglis_chatbot_latest/frontend

npm ci

npm run dev -- --host 127.0.0.1 --port 5174
```

Frontend URL:

http://127.0.0.1:5174

### Student Frontend Environment

Create:

`frontend/.env.local`

Add:

```dotenv
VITE_BACKEND_URL=http://127.0.0.1:8002
```

This prevents the Student Chatbot frontend from accidentally connecting to the Professor Dashboard backend.

---

## 9. Running the Professor Dashboard

### 9.1 Professor Backend

Open a terminal in Professor Dashboard VS Code.

```bash
cd ~/Documents/GitHub/ask_inglis_professor_v2/backend

set -a
source .env
set +a

./venv/bin/python -m uvicorn app.main:app \
  --host 127.0.0.1 \
  --port 8000
```

Backend URL:

http://127.0.0.1:8000

API documentation:

http://127.0.0.1:8000/docs

### 9.2 Professor Frontend

Open another terminal.

```bash
cd ~/Documents/GitHub/ask_inglis_professor_v2/frontend

npm run dev -- --host 127.0.0.1 --port 5173
```

Professor Dashboard:

http://127.0.0.1:5173/professor

Student Feedback Inbox:

http://127.0.0.1:5173/professor/feedback

---

## 10. Environment Configuration

Each application has its own environment configuration.

Never commit real API keys, passwords, private keys, or environment files.

### Student Chatbot Backend

File:

`ask_inglis_chatbot_latest/backend/.env`

Important variables:

```dotenv
LLM_PROVIDER=gemini
GEMINI_API_KEY=YOUR_GEMINI_API_KEY

GITHUB_NOTES_REPO=ask-inglis/ask_inglis_notes

GITHUB_APP_ID=YOUR_GITHUB_APP_ID
GITHUB_APP_PRIVATE_KEY=YOUR_PRIVATE_KEY

GITHUB_BOT_NAME=YOUR_APP_BOT_NAME
GITHUB_BOT_EMAIL=YOUR_APP_BOT_EMAIL

ADMIN_API_KEY=YOUR_ADMIN_API_KEY

PUBLIC_BASE_URL=http://127.0.0.1:8002
ALLOWED_ORIGINS=http://localhost:5174,http://127.0.0.1:5174
TRUSTED_PROXY_HOPS=0
```

Use the private-key formatting documented in the Student Chatbot's `.env.example`.

### Professor Dashboard Backend

File:

`ask_inglis_professor_v2/backend/.env`

Important variables:

```dotenv
# The BULLSAI_* names are historical: they currently point to Gemini (see the note in section 3.4)
BULLSAI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
BULLSAI_MODEL=gemini-3.5-flash-lite
BULLSAI_API_KEY=YOUR_GEMINI_API_KEY

JWT_SECRET_KEY=YOUR_JWT_SECRET

STUDENT_FEEDBACK_MODE=live

STUDENT_CHATBOT_URL=http://127.0.0.1:8002

STUDENT_CHATBOT_ADMIN_KEY=YOUR_SHARED_ADMIN_KEY

STUDENT_CHATBOT_TIMEOUT_SECONDS=45

EXTERNAL_EVIDENCE_ENABLED=true
```

The following values must match:

**Student Chatbot:**
`ADMIN_API_KEY`

**Professor Dashboard:**
`STUDENT_CHATBOT_ADMIN_KEY`

The shared key must remain on the backend.

---

## 11. Student Feedback API Endpoints

The Student Chatbot backend exposes the following endpoints.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/feedback` | Submit student feedback |
| POST | `/feedback/dispute` | Dispute an answer |
| GET | `/admin/feedback` | Retrieve feedback records |
| GET | `/admin/feedback/queue` | Retrieve grouped feedback |
| POST | `/admin/feedback/resolve-group` | Resolve a feedback group |
| POST | `/admin/feedback/{feedback_id}/resolve` | Resolve one feedback report |
| POST | `/admin/feedback/resolve-lecture` | Resolve lecture-related feedback |

Administrator endpoints require authenticated backend access.

The Professor Dashboard communicates with these endpoints through its feedback client service.

### Important Implementation Files

**Professor Dashboard:**

```text
backend/app/student_feedback_routes.py
backend/app/services/student_feedback_client.py
backend/app/services/student_feedback_ai_service.py
frontend/src/pages/StudentFeedbackInbox.jsx
```

**Student Chatbot:**

```text
backend/main.py
backend/feedback.py
backend/github_auth.py
backend/ingestion.py
frontend/src/App.jsx
```

---

## 12. Testing the Feedback Integration

### Step 1

Start both the Student Chatbot and Professor Dashboard.

### Step 2

Open:

http://127.0.0.1:5174

Ask:

"Which nerve supplies the biceps brachii muscle?"

The expected answer identifies the musculocutaneous nerve.

### Step 3

Click the thumbs-down feedback button.

Submit a clearly identified integration-test comment.

### Step 4

Open:

http://127.0.0.1:5173/professor/feedback

Click **Refresh feedback**.

### Step 5

Confirm that the Professor Dashboard displays:
- Student question
- Original chatbot answer
- Feedback comment
- Related lecture
- Report count

### Step 6

Click **Verify with BullsAI**.

Review the verdict, explanation, and citations.

### Step 7

For controlled test records only, verify the professor's resolution workflow.

Do not resolve genuine student reports during testing.

### Step 8

Check GitHub commit history to confirm bot attribution.

---

## 13. Troubleshooting

### 13.1 Student Chatbot Cannot Generate an Answer

Check the backend:

```bash
curl -i http://127.0.0.1:8002/
```

Test the chatbot API:

```bash
curl -i --max-time 120 \
  -X POST http://127.0.0.1:8002/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Which nerve supplies the biceps brachii muscle?",
    "history": []
  }'
```

If the API works but the browser fails, verify the Student Chatbot frontend configuration and CORS settings.

### 13.2 CORS Error

The Student Chatbot backend must allow the local frontend origin.

```dotenv
ALLOWED_ORIGINS=http://localhost:5174,http://127.0.0.1:5174
```

Restart the Student Chatbot backend after changing this setting.

### 13.3 Professor Feedback Inbox Timeout

During integration testing, the Student Chatbot feedback API took approximately 10.61 seconds to return its results.

The Professor Dashboard originally had a 10-second timeout, which caused:

```text
Student chatbot is unreachable or timed out
```

The working configuration was updated to:

```dotenv
STUDENT_CHATBOT_TIMEOUT_SECONDS=45
```

Restart the Professor Dashboard backend after changing the timeout.

This resolved the observed timeout in local testing.

### 13.4 Port Already in Use

Check which process is running:

```bash
lsof -nP -iTCP:8000 -sTCP:LISTEN
```

Replace `8000` with `8002`, `5173`, or `5174` as needed.

If the correct server is already running, do not start another instance on the same port.

### 13.5 Missing PowerPoint Dependency

If the Student Chatbot backend reports:

```text
ModuleNotFoundError: No module named 'pptx'
```

Install:

```bash
./.venv/bin/python -m pip install python-pptx
```

---

## 14. Testing and Validation

### Professor Backend Syntax Check

```bash
cd ~/Documents/GitHub/ask_inglis_professor_v2/backend

./venv/bin/python -m py_compile \
  app/main.py \
  app/services/lecture_claim_evidence_service.py \
  app/services/student_feedback_ai_service.py
```

### Professor Evidence Pipeline Tests

```bash
./venv/bin/python -m unittest discover \
  -s ../tests \
  -p 'test_external_evidence_pipeline.py' -v
```

### Student Frontend Build

```bash
cd ~/Downloads/ask_inglis_chatbot_latest/frontend

npm run build
```

### Student Frontend Security Audit

```bash
npm audit --omit=dev
```

A local production-dependency audit previously reported zero vulnerabilities. Dependency checks should be repeated because security advisories change.

---

## 15. Security and Privacy

Security measures include:

- Professor authentication
- JWT-protected professor endpoints
- Backend-only administrator credentials
- GitHub App authentication
- Private lecture notes repository
- Separate application environments
- Protected feedback management APIs
- Professor-controlled final decisions

Sensitive configuration must never be committed.

Do not commit:
- `.env`
- `.env.local`
- GitHub App private keys
- Gemini API keys
- BullsAI API keys
- JWT secrets
- Administrator credentials

External research should not send identifying student, donor, or patient information to public services.

### Copyright and Licensing

External material is retrieved only as bounded evidence passages.

Wikipedia material requires appropriate attribution and license compliance.

Academic articles must be checked for reuse permissions before their full text is used.

AI verification must rely on actual cited passages rather than unsupported assumptions.

---

## 16. Current Project Status

| Feature | Status |
|---------|--------|
| Professor authentication | Implemented |
| Professor Dashboard | Working |
| PDF/DOCX lecture upload | Working |
| AI claim extraction | Working |
| BullsAI claim verification | Working |
| Professor acceptance/rejection/editing | Implemented |
| Reviewed PDF generation | Implemented |
| Indexed reference PDF search | Working |
| Wikipedia evidence retrieval | Tested |
| PubMed and Europe PMC discovery | Working |
| Academic full-text evidence coverage | Needs improvement |
| Student Chatbot frontend/backend | Tested with latest repository |
| Student feedback submission | Tested |
| Student feedback GitHub storage | Tested |
| GitHub App feedback submission | Verified |
| Professor live feedback inbox | Tested |
| Feedback timeout configuration fix | Verified |
| BullsAI student feedback verification | Tested |
| External evidence in lecture claim review | Integrated; broader live testing pending |
| GitHub bot feedback-resolution commit | Final verification pending |
| Live deployment on the droplet | Live; redeploys on every push to `main` |

---

## 17. Future Improvements

Planned development includes:

1. Broader academic evidence retrieval.
2. Testing correct, incorrect, and ambiguous lecture claims.
3. Improving external citation accuracy.
4. Optimizing feedback retrieval performance.
5. Reducing repeated GitHub API requests.
6. Testing all professor feedback resolution actions.
7. Confirming GitHub bot identity for new resolution commits.
8. Improving large-batch lecture verification.
9. Additional end-to-end integration testing.
10. Security review and secret rotation before handover.

---

## 18. Collaboration

This is a collaborative CDA 650 project.

The Student Chatbot and Professor Dashboard are maintained as separate applications.

Teammates can continue developing Student Chatbot features independently while Professor Dashboard development focuses on:

- Lecture verification
- Evidence-grounded BullsAI integration
- External reference research
- Professor decision workflows
- Student feedback review and verification

Changes between applications should preserve established API compatibility.

---

## 19. Live Deployment

The Professor Dashboard runs in Docker on the shared droplet (159.203.143.149), next to the Student Chatbot.

### How it is deployed

Merging or pushing to `main` is a deploy. GitHub Actions copies the repository to the droplet and runs:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

Test changes on your own computer before merging to `main`.

### How it is set up

- `docker-compose.prod.yml` runs two containers: the backend (FastAPI, port 8001 inside the container) and the frontend (served on port 8080 inside the container).
- Neither container publishes a port. They join the Docker network `web` with the names `professor-backend` and `professor-frontend`. The `ask_inglis_proxy` nginx sends traffic to them by those names.
- The database (SQLite) and uploaded files live in the Docker volume `portal_data`, mounted at `/data` in the backend container.
- The frontend is built to live under `/ask_inglis_professor/`. The build settings are `VITE_BASE_PATH=/ask_inglis_professor/` and `VITE_API_BASE_URL=https://<PROF_API_HOST>`. Both are fixed when the site is built. Running locally (sections 8 and 9) does not need them.

### Files that live only on the droplet

These are never copied by the deploy and must never be committed:

| File | What it holds |
|---|---|
| `backend/.env` | The real settings and keys (the Gemini key in `BULLSAI_API_KEY`, `JWT_SECRET_KEY`, `STUDENT_CHATBOT_ADMIN_KEY`, and so on) |
| `.env.prod` | The API address used when the frontend is built, for example `PROF_API_HOST=profapi.159-203-143-149.sslip.io` |

Settings that matter on the droplet:

```dotenv
ALLOWED_ORIGINS=<the addresses the dashboard is opened from, comma separated>
STUDENT_CHATBOT_URL=<where this backend reaches the Student Chatbot backend>
STUDENT_CHATBOT_ADMIN_KEY=<must match the chatbot's ADMIN_API_KEY>
```

`ALLOWED_ORIGINS` must include `https://inglis.gansonstreet.com`. The backend reads `.env` only when it starts, so restart it after changing a value.

### Restarting (on the droplet)

```bash
docker ps --format '{{.Names}}' | grep -i backend     # the chatbot has a backend too; pick the professor one
docker restart NAME_HERE
docker logs -f --tail 20 NAME_HERE
```

Do not touch containers that belong to other projects on the droplet.

### Professor login

The professor login is an email and a password. The first account is created from `INITIAL_PROFESSOR_EMAIL` and `INITIAL_PROFESSOR_PASSWORD` in `backend/.env` using `create_initial_data.py`. To set a new password, use `reset_professor_password.py`. After the password is changed, remove `INITIAL_PROFESSOR_PASSWORD` from `backend/.env`.

### Keep the data safe

- Never run `docker compose down -v` or `docker volume rm` on this project. That deletes the `portal_data` volume with the database.
- Back up the volume before large changes.

### Handover checklist

- Rotate `JWT_SECRET_KEY`, the shared admin key (change it in both applications) and the deploy key.
- Move the Gemini key (stored in `BULLSAI_API_KEY`) to an account owned by new owner or the course.
- Give the new owner access to all four repositories and to the droplet.

### Troubleshooting the live site

| Problem | What to check |
|---|---|
| Error page (502) | Is the portal backend or frontend container running? `docker ps` on the droplet |
| Login works but nothing loads, or the browser reports a CORS error | `ALLOWED_ORIGINS` in the droplet's `backend/.env`; restart the backend |
| Page loads but images or styles are missing | The frontend must be built with `VITE_BASE_PATH=/ask_inglis_professor/` |
| Feedback inbox times out | `STUDENT_CHATBOT_TIMEOUT_SECONDS` (see section 13.3) and `STUDENT_CHATBOT_URL` |
| Deploy run is red in GitHub Actions | Open the run and read the failing step |

---

## 20. Disclaimer

Ask Inglis Anatomy AI is an educational research project.

AI-generated answers, anatomical assessments, and suggested corrections may contain errors.

All lecture modifications and disputed information require appropriate professor verification.

The application is not intended to provide medical advice.