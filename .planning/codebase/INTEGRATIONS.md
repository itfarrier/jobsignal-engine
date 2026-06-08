# External Integrations

**Analysis Date:** 2026-06-09

## APIs & External Services

**Job Board APIs (Production — Used by all deployments):**
- **Greenhouse Public API** — Reads job listings from 139+ tracked company career pages.
  - Endpoint pattern: `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs`
  - Free, no API key required. Public JSON feed.
  - Source: Tracked Companies table `API Endpoint` field.
  - Workflow: `01a-scanner-greenhouse.json` (Workflow 1a). Runs daily at 8:00 AM.
  - Rate limiting: N/A (public API, no auth).
  - Coverage: ~40% of 139 tracked companies.

- **Ashby Posting API** — Reads job listings with compensation data.
  - Endpoint pattern: `https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true`
  - Free, no API key required. Public JSON feed.
  - Covers companies that have migrated from Greenhouse (OpenAI, Perplexity, Runway, LangChain, Replit, etc.).
  - Workflow: `01b-scanner-ashby.json` (Workflow 1b). Runs daily at 8:05 AM.

- **Lever API** — Reads job listings.
  - Endpoint pattern: `https://api.lever.co/v0/postings/{slug}`
  - Free, no API key required. Public JSON feed.
  - Thinner coverage — Mistral, Plaid confirmed.
  - Workflow: `01c-scanner-lever.json` (Workflow 1c). Runs daily at 8:10 AM.

**AI APIs (Production — One credential drives all AI workflows):**
- **OpenAI-compatible API** — Single credential in n8n (type: `openAiApi`).
  - Workflows using it: `02-evaluator.json` (scoring + interview prep), `03-tailor.json` (CV tailoring).
  - 3 total OpenAI nodes: "Score Job (GPT-5 mini)", "Generate Interview Prep (GPT-5 mini)", "Tailor CV (GPT-5 mini)".
  - Model configured per node. Default in workflows: `gpt-5-mini`.
  - Swappable Base URL to any OpenAI-compatible provider:
    | Provider | Base URL | Model String |
    |----------|----------|-------------|
    | Google AI Studio (free) | `https://generativelanguage.googleapis.com/v1beta/openai` | `gemma-4-26b-a4b-it` |
    | OpenAI (budget) | `https://api.openai.com/v1` | `gpt-5-mini` |
    | OpenRouter (flexible) | `https://openrouter.ai/api/v1` | `google/gemma-4-26b-a4b-it` |
    | LM Studio (local) | `http://localhost:1234/v1` | Any loaded model |
    | Ollama (local) | `http://localhost:11434/v1` | `qwen3:8b` |
  - Cost tracking: Every AI call logs exact token cost using GPT-5 mini pricing ($0.25/1M input, $2.00/1M output). See `workflows/02-evaluator.json` Code nodes "Parse AI Response" and "Parse Interview Prep".
  - JSON parsing: Code nodes strip `<thought>` tags, markdown fences, and preamble before parsing — supports open-source model quirks.

**Notification APIs:**
- **Resend (default)** — HTTP email API.
  - n8n credential type: `resendApi`.
  - Used by: Workflow 2 (Evaluator — High Fit alerts), Workflow 4 (Housekeeper — alert notifications), Workflow 6 (Alerter — daily digest).
  - Free tier: 100 emails/day.
  - Why default: Works on DigitalOcean (SMTP blocked). No port restrictions.
  - Configured in `docs/NOTIFICATION-SETUP.md`.
  - Endpoint: Resend API (n8n built-in node, no raw URL exposed).
  - API key prefix: `re_`.

- **Gmail SMTP (alternative)** — Send Email via SMTP.
  - Not pre-wired in shipped workflows. Requires swapping Resend nodes for SMTP nodes.
  - Port: 465 (SSL/TLS). Blocked on DigitalOcean by default.
  - Auth: App Password (16-character, requires 2FA enabled).
  - See `docs/NOTIFICATION-SETUP.md` for setup.

- **Discord Webhooks (alternative)** — HTTP POST notifications.
  - Not pre-wired. Requires adding HTTP Request nodes.
  - No SDK — raw `POST` to `https://discord.com/api/webhooks/{webhook_id}/{token}`.
  - Embed format documented in `docs/NOTIFICATION-SETUP.md`.

## Data Storage

**Databases:**
- **Airtable** — Source of truth. All 4 tables (Profile, Tracked Companies, Pipeline, Search Queries).
  - n8n credential type: `airtableTokenApi` (Personal Access Token).
  - Airtable Base ID: `appE808oZ5gTSQzUY` (hardcoded in all workflow nodes).
  - Table IDs: Profile = `tbl4hqn6sfFVbLuzd`, Tracked Companies = `tbl5yytlFEcocSK2v`, Pipeline = `tblqvCvqMIczRGjLi`, Search Queries = `tblWfL2m2XlVrR3yj`.
  - Airtable content API endpoint used for file attachments: `https://content.airtable.com/v0/{baseId}/{recordId}/{fieldId}/uploadAttachment` (used by Workflow 3 Tailor for DOCX uploads).
  - All workflows query Airtable to fetch profile data, look up tracked companies, read pipeline records, and write results back.
  - Free tier cap: 1,000 records per base. Housekeeper (Workflow 4) manages this with weekly auto-archive.

- **PostgreSQL 16 (Alpine)** — n8n persistence only.
  - Defined in `docker-compose.example.yml` as `postgres:16-alpine`.
  - Not used by JobSignal business logic. Only stores n8n workflow state, execution history, and credentials.
  - Volume: `db_storage:/var/lib/postgresql/data`.

**File Storage:**
- **Shared Docker volume** (`shared_tmp:/tmp/jobsignal`) — Temporary file exchange between n8n and the CV renderer sidecar. n8n writes markdown CV, CV renderer reads it, outputs DOCX, n8n reads the DOCX and uploads to Airtable.
- **Airtable Attachment field** — Tailored CV DOCX files stored as Airtable record attachments (Pipeline table `Tailored CV` field).

**Caching:**
- Not detected. No Redis, Memcached, or other caching layer.

## Authentication & Identity

**Auth Provider:**
- Not detected. No user authentication, no login system, no API key validation on JobSignal's side. The system is a personal pipeline — single user, single Profile row.
- n8n itself handles its own authentication (n8n login), but that's external to JobSignal.

## Monitoring & Observability

**Error Tracking:**
- Not detected. No Sentry, DataDog, or similar APM.
- n8n built-in: workflow execution log (click clock icon in n8n UI to see node execution history and errors).
- `N8N_METRICS=true` set in `docker-compose.example.yml` but no metrics consumer configured.

**Logs:**
- Python sidecars: `logging.INFO` to stdout (Docker container logs). Minimal logging — only scan results, errors, and startup messages.
- Workflow execution logs: Captured in n8n database (PostgreSQL).

**Cost Tracking:**
- Custom: Every AI evaluation, interview prep, and CV tailoring call calculates cost from actual token usage (OpenAI-compatible API response `usage` field). Costs stored in Pipeline table as decimal fields (`AI Evaluation Cost`, `CV Tailoring Cost`, `Interview Prep Cost`).
- Pricing constants (see `02-evaluator.json` Code nodes): `INPUT_COST_PER_TOKEN = 0.25 / 1_000_000`, `OUTPUT_COST_PER_TOKEN = 2.00 / 1_000_000`.

## CI/CD & Deployment

**Hosting:**
- Self-hosted VPS (recommended), n8n Cloud, or n8n Desktop (fully local).
- Docker Compose is the deployment mechanism. See `docker-compose.example.yml`.
- Caddy handles reverse proxy + TLS for self-hosted deployments.

**CI Pipeline:**
- Not detected. No GitHub Actions, no CI configuration. `.github/` only contains `ISSUE_TEMPLATE/bug_report.md`.

## Environment Configuration

**Required env vars (n8n container in docker-compose.example.yml):**
- `DB_TYPE=postgresdb`
- `DB_POSTGRESDB_HOST`, `DB_POSTGRESDB_PORT`, `DB_POSTGRESDB_DATABASE`, `DB_POSTGRESDB_USER`, `DB_POSTGRESDB_PASSWORD`
- `N8N_METRICS`, `N8N_SECURE_COOKIE`
- `WEBHOOK_URL` (optional, for production)
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (PostgreSQL container)

**Secrets location:**
- Managed in n8n credential store (encrypted in n8n database). Never stored in repo files.
- Required credentials to create in n8n:
  1. **Airtable Personal Access Token** — read/write to the JobSignal base
  2. **OpenAI API** — Base URL + API key (can switch providers by editing this credential)
  3. **Resend API** (optional) — if using Resend for email
  4. **HTTP Header Auth** (CV renderer) — `httpHeaderAuth` credential for internal sidecar communication
- `.env` file: Not present in repo. If used locally, it's gitignored.

## Webhooks & Callbacks

**Incoming:**
- Not detected. No webhook endpoints exposed.

**Outgoing:**
- Not detected. No outgoing webhooks configured.

## Sidecar Services (Self-Hosted Only)

**CV Renderer (port 3456):**
- HTTP Flask-like service (built-in `http.server`). Endpoints:
  - `POST /render` — Accepts `{ "markdown": "...", "filename": "..." }`, returns base64-encoded DOCX.
  - `GET /health` — Health check.
- Called by n8n Workflow 3 (Tailor) via HTTP Request node.
- Credential: `httpHeaderAuth` (basic header auth for internal communication).
- Source: `scripts/cv_service.py` + `scripts/render_cv.py`.
- Docker image: Python 3.12-alpine + python-docx.
- Not available on n8n Cloud (cannot reach internal Docker network).

**JobSpy Scanner (port 3457):**
- Flask service. Endpoints:
  - `POST /scan` — Single JobSpy search query.
  - `POST /batch` — Batch multiple queries (max 10 per batch).
  - `GET /health` — Health check.
- Scrapes LinkedIn and Indeed using `python-jobspy` library.
- Source: `scripts/jobspy_service.py`.
- Docker image: Python 3.12-slim + flask + python-jobspy.
- Max results per query: 100 (safety brake). Max batch size: 10.
- Only available on self-hosted and n8n Desktop deployments.

---

*Integration audit: 2026-06-09*
