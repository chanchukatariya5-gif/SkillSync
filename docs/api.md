# SkillSync API

All routes are served by the Express API. Except for `/api/health`, routes require `Authorization: Bearer <token>` unless stated otherwise. JSON errors use `{ "error": "..." }`.

| Method and path | Auth | Purpose |
| --- | --- | --- |
| `GET /api/health` | No | API liveness check. |
| `POST /api/auth/register` | No | Create an account with `{ "name", "email", "password" }`; returns `{ "token", "user" }`. |
| `POST /api/auth/login` | No | Sign in with `{ "email", "password" }`; returns `{ "token", "user" }`. |
| `GET /api/auth/me` | Yes | Return the authenticated account. |
| `POST /api/resume/analyze` | Yes | Multipart `resume` PDF, up to 5 MB. Returns the saved profile and skill count. |
| `GET /api/dashboard` | Yes | Return the user's profile, ranked jobs, skill gaps, generated roadmaps, applications, and completed skills. |
| `POST /api/applications` | Yes | Create an application with `{ "jobId", "status?", "notes?" }`. |
| `PATCH /api/applications/:id` | Yes | Update `status`, `notes`, or both. Status is `Applied`, `Interview`, `Offer`, or `Rejected`. |
| `DELETE /api/applications/:id` | Yes | Delete an application owned by the current user. Returns 204. |
| `PATCH /api/progress/:skill` | Yes | Set `{ "completed": true|false }` for a supported roadmap skill. |

Resume analysis returns a profile with `filename`, `analyzedAt`, detected `name` and `email`, `skills`, `technical_skills`, `soft_skills`, and `extracted_text`. The dashboard's job records include the catalog fields, `match_percentage`, `matched_skills`, `missing_skills`, and roadmap steps with `skill`, `title`, `priority`, and `completed`.

The parser service is an internal dependency, normally at `http://127.0.0.1:8000/analyze`; set `RESUME_SERVICE_URL` to change it. The API responds with 503 when the parser cannot be reached and forwards validation errors for unreadable PDFs.
