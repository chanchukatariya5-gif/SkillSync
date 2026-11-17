# SkillSync

SkillSync is a local-first career planning application for analyzing resumes, comparing skills with job opportunities, setting learning goals, and tracking applications.

## Features

- Account registration, login, and logout with password hashing and expiring bearer tokens.
- PDF resume text extraction, contact detail detection, and technical/soft skill identification.
- Explainable job compatibility scores and per-role matched/missing skill lists.
- Per-role learning roadmaps with saved completion progress.
- Application tracking with status changes and follow-up notes.
- An authenticated AI career assistant for resume, role, and learning questions.
- Per-user data persisted to a local JSON file by the API.

Job opportunities and learning recommendations are project demo data, not live job listings or endorsements. Compatibility scores compare the detected skills with listed required skills; they are not hiring predictions.

## Requirements

- Node.js 20 or newer and npm.
- Python 3.10 or newer and pip.

## Run locally

Open three terminals from the repository root.

1. Install and start the resume parser:

   ```sh
   python3 -m venv resume-service/.venv
   resume-service/.venv/bin/python -m pip install -r resume-service/requirements.txt
   resume-service/.venv/bin/python resume-service/app.py
   ```

2. Install and start the API:

   ```sh
   cd backend
   npm install
   cp ../.env.example .env
   npm run dev
   ```

   Set a private random `JWT_SECRET` in `backend/.env` before using real accounts. The API uses a development-only fallback when `NODE_ENV` is not `production`; production startup fails without a configured secret.

   To enable the AI assistant, add `OPENAI_API_KEY` to `backend/.env` (and optionally set `OPENAI_MODEL`). The assistant sends the user's message, recent chat messages, and a limited summary of detected skills, job matches, and application count to OpenAI; it does not send resume text or contact details. Chat requests return a configuration error when no key is set.

3. Install and start the web app:

   ```sh
   cd frontend
   npm install
   npm run dev
   ```

   Open the Vite URL, normally <http://localhost:5173>. The dev server proxies `/api` requests to the backend on port 5000.

Resume analysis requires a text-based PDF. Scanned/image-only PDFs are rejected with a clear message. Uploaded PDF bytes are processed in memory and discarded; extracted text and detected skills are saved in the local profile store.

## Tests and checks

```sh
cd backend && npm test
cd frontend && npm run lint && npm run build
python3 -m unittest discover -s resume-service
```

The backend tests use temporary storage and do not modify the local application data. Python test execution requires the resume-service requirements to be installed.

## Architecture

- `frontend/`: React/Vite single-page application. API traffic is same-origin under `/api`.
- `backend/src/app.js`: Express routes, validation, authentication, and ownership checks.
- `backend/src/jobs.js`: Demo job catalog, compatibility scoring, and roadmap recommendations.
- `backend/src/store.js`: serialized, atomic JSON persistence in `backend/data/store.json`.
- `resume-service/app.py`: isolated Flask/PDF extraction service.

The JSON store is intended for a single-instance academic/demo deployment. For multi-instance or production use, replace it with a managed database, configure HTTPS and a strong secret, and establish appropriate retention and access controls for personal resume data.
