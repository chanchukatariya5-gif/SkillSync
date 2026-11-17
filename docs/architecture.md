# SkillSync architecture

## Components and responsibilities

- **React/Vite frontend** renders the user workspace and calls the API through `/api`. Views cover dashboard metrics, resume results, role matches, skill gaps, roadmaps, and the application tracker.
- **Express API** owns authentication, request validation, per-user authorization, job scoring, and persistence. Job definitions and scoring live in `backend/src/jobs.js`; API handlers live in `backend/src/app.js`.
- **JSON store** in `backend/src/store.js` serializes writes and replaces the data file atomically. User records, analyzed profiles, progress, and applications are scoped by a generated user ID. The default file is `backend/data/store.json`; `SKILLSYNC_DATA_FILE` can select another path.
- **Flask resume service** extracts text from PDFs with pdfplumber, detects skill keywords, categorizes technical and soft skills, and reads basic contact details. It receives resume bytes from the API in memory and has no access to the application store.
- **Career assistant** is a signed-in frontend chat widget backed by `POST /api/chat`. The API sends the current message, up to 8 in-memory conversation messages, and a limited skills/job-match/application-count summary to OpenAI; it does not send the stored extracted resume text or contact details.

## Data flow

1. A user registers or signs in. The API hashes passwords with bcrypt and issues a seven-day JWT.
2. The browser uploads a PDF using the authenticated resume endpoint. The API checks its type, size, and PDF signature, then forwards it to the parser.
3. The API stores only the parsed profile (including extracted text); the uploaded file itself is not retained.
4. The dashboard compares detected skills with each demo role's required skills. Missing skills create roadmap steps, while completion is stored per user and skill.
5. Applications reference a catalog job and include a user-owned status and optional notes. Every read or update filters by the authenticated user ID.

## Compatibility score

For each role:

```text
score = round(100 * number of matched required skills / number of required skills)
```

The API also returns matched and missing skill lists so the score can be explained. It is a skills-overlap estimate, not a hiring prediction.

## Persistence and deployment limits

The JSON store is appropriate for a local academic demo and a single API process. It is not a multi-instance database: use a transactional database before horizontal scaling or production use. Configure a strong `JWT_SECRET`, HTTPS, appropriate CORS origins, and a retention policy before storing real personal data. Job opportunities and learning suggestions are seeded demo content, not live listings.

The AI assistant requires a server-side `OPENAI_API_KEY`; never place this key in frontend code. The chat UI discloses the profile summary and recent chat messages sent to OpenAI. Chat transcripts remain in React memory and are not persisted.

## Test strategy

- `backend/test/app.test.js` checks role scoring, input validation, authentication, resume analysis integration, durable profile/progress storage, and application ownership.
- `resume-service/test_app.py` checks skill boundaries, contact extraction, malformed and oversized PDFs, and parser response categories.
- The frontend is linted and production-built. Browser smoke testing covers registration, PDF analysis, tracking an application, editing its status/notes, and completing a roadmap step.
