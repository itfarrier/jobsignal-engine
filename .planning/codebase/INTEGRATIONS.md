# External Integrations

**Analysis Date:** 2026-06-05

## APIs & External Services

**Job board / ATS APIs (public, no auth):**
- Greenhouse — Company career page job listings
  - SDK/Client: n8n HTTP Request node (`workflows/01a-scanner-greenhouse.json`, node `Fetch Greenhouse API`)
  - Endpoint pattern: `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs` (stored per company in Tracked Companies `API Endpoint` field; examples in `companies-default.csv`)
  - Auth: None (public JSON API)

- Ashby — Company career page job listings
  - SDK/Client: n8n HTTP Request node (`workflows/01b-scanner-ashby.json`)
  - Endpoint pattern: `https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true`
  - Auth: None (public JSON API)

- Lever — Company career page job listings
  - SDK/Client: n8n HTTP Request node (`workflows/01c-scanner-lever.json`)
  - Endpoint pattern: `https://api.lever.co/v0/postings/{slug}`
  - Auth: None (public JSON API)

**Job board scraping (self-hosted only):**
- LinkedIn + Indeed — Via JobSpy Python library
  - SDK/Client: `python-jobspy` in `scripts/jobspy_service.py`; called from n8n HTTP Request (`workflows/01d-scanner-jobspy.json`, URL `http://jobspy-scanner:3457/batch`)
  - Auth: None (public HTML scraping; rate limits apply)
  - Config source: Airtable **Search Queries** table

**AI / LLM (OpenAI-compatible):**
- Google AI Studio (Gemma 4) — Default free-tier recommendation
  - SDK/Client: `@n8n/n8n-nodes-langchain.openAi` node with custom Base URL
  - Base URL: `https://generativelanguage.googleapis.com/v1beta/openai`
  - Auth: API key in n8n **OpenAI API** credential

- OpenAI (GPT-5 mini) — Budget paid tier
  - Base URL: `https://api.openai.com/v1`
  - Auth: OpenAI API key in n8n credential

- OpenRouter — Multi-model gateway
  - Base URL: `https://openrouter.ai/api/v1`
  - Auth: OpenRouter API key in n8n credential

- LM Studio / Ollama — Local inference (self-hosted or Desktop only)
  - Base URL: `http://localhost:1234/v1` (LM Studio) or `http://localhost:11434/v1` (Ollama)
  - Auth: Dummy key (`lm-studio` / `ollama`) or empty

- Used in: `workflows/02-evaluator.json` (2 OpenAI nodes: scoring + interview prep), `workflows/03-tailor.json` (1 OpenAI node: CV rewrite)
- Reference: `docs/AI-PROVIDERS.md`

**Email notifications:**
- Resend — Default in shipped workflows
  - SDK/Client: `n8n-nodes-resend.resend` node
  - Auth: Resend API key in n8n **Resend** credential
  - Used in: `workflows/02-evaluator.json` (High Fit alerts), `workflows/04-housekeeper.json` (stuck-job alerts), `workflows/06-alerter.json` (daily digest)

- Gmail SMTP — Alternative (documented, requires node swap)
  - SDK/Client: n8n **Send Email** node (not in default workflow exports)
  - Auth: Gmail App Password via SMTP (`smtp.gmail.com:465`)
  - Reference: `docs/NOTIFICATION-SETUP.md`

- Discord — Optional webhook notifications (documented, not pre-wired in workflow JSON)
  - SDK/Client: n8n HTTP Request node POST to Discord webhook URL
  - Auth: Webhook URL secret embedded in URL
  - Reference: `docs/NOTIFICATION-SETUP.md`

## Data Storage

**Databases:**
- Airtable — Application source of truth (Profile, Tracked Companies, Pipeline, Search Queries)
  - Connection: Airtable Personal Access Token (PAT)
  - Client: `n8n-nodes-base.airtable` across all workflows
  - Base/table IDs are embedded in workflow JSON (e.g. `appE808oZ5gTSQzUY` in `workflows/01a-scanner-greenhouse.json`) — must be replaced with deployer's base IDs during setup
  - Attachment upload: Airtable Content API via HTTP Request (`workflows/03-tailor.json`, URL `https://content.airtable.com/v0/{baseId}/{recordId}/{fieldId}/uploadAttachment`) with Header Auth credential (`Bearer {PAT}`)
  - Schema reference: `airtable/AIRTABLE-SCHEMA.md`

- PostgreSQL 16 — n8n internal state only (workflows, credentials, execution history)
  - Connection: `DB_POSTGRESDB_*` env vars in `docker-compose.example.yml`
  - Client: n8n built-in Postgres driver
  - Not used for job pipeline data

**File Storage:**
- Airtable attachments — Tailored CV DOCX files uploaded to Pipeline records (`workflows/03-tailor.json`)
- Docker shared volume `shared_tmp:/tmp/jobsignal` — Temporary DOCX files during CV render (`docker-compose.example.yml`)
- Local filesystem — Ephemeral `/tmp/{filename}.docx` in cv-renderer container (`scripts/cv_service.py`)

**Caching:**
- None — No Redis or application-level cache detected

## Authentication & Identity

**Auth Provider:**
- No end-user authentication — Single-user personal job pipeline
- Service-to-service auth:
  - **Airtable PAT** — All Airtable node operations + attachment upload Header Auth
  - **OpenAI-compatible API key** — All LLM calls via single n8n credential
  - **Resend API key** — Email sending
  - **n8n Basic Auth** (optional) — UI access on self-hosted (`docs/SETUP.md`)

**Implementation:**
- Credentials managed in n8n credential store (encrypted at rest when using Postgres backend)
- No OAuth, JWT, or session management in application code

## Monitoring & Observability

**Error Tracking:**
- None — No Sentry, Datadog, or similar integration

**Logs:**
- n8n execution logs — Per-workflow run history in n8n UI (click clock icon on workflow)
- Python sidecar stdout — Flask/stdlib HTTP server logging (`scripts/jobspy_service.py` uses `logging`; `scripts/cv_service.py` logs 500 errors only)
- `N8N_METRICS=true` — Enables n8n metrics endpoint in self-hosted Docker (`docker-compose.example.yml`)

## CI/CD & Deployment

**Hosting:**
- Self-hosted VPS (DigitalOcean, Hetzner, Vultr, Linode) with Docker Compose — `docs/SETUP.md`
- n8n Cloud — `n8n.io` hosted SaaS
- n8n Desktop — Local macOS/Windows/Linux app

**CI Pipeline:**
- None — `.github/` contains only `ISSUE_TEMPLATE/bug_report.md`; no GitHub Actions workflows

## Environment Configuration

**Required env vars (self-hosted Docker, from `docker-compose.example.yml`):**
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `DB_TYPE`, `DB_POSTGRESDB_HOST`, `DB_POSTGRESDB_PORT`, `DB_POSTGRESDB_DATABASE`, `DB_POSTGRESDB_USER`, `DB_POSTGRESDB_PASSWORD`
- `WEBHOOK_URL` (when using Caddy with a public domain)
- `N8N_METRICS`, `N8N_SECURE_COOKIE`

**Additional env vars (documented in `docs/SETUP.md`, user-added to compose):**
- `GENERIC_TIMEZONE` — Critical for correct schedule trigger times
- `N8N_BASIC_AUTH_USER`, `N8N_BASIC_AUTH_PASSWORD`
- `N8N_HOST`, `N8N_PROTOCOL`

**Secrets location:**
- n8n credential store (Airtable PAT, AI API key, Resend key, Header Auth bearer token)
- `docker-compose.yml` for Postgres password (gitignored; example uses `REPLACE_WITH_YOUR_PASSWORD` placeholder)
- No `.env` file committed to repository

**n8n credentials required at setup (from `docs/SETUP.md`):**
| Credential type | Used by |
|----------------|---------|
| Airtable Personal Access Token | All Airtable nodes |
| OpenAI API (with custom Base URL) | Evaluator + Tailor workflows |
| Resend API | Evaluator, Housekeeper, Alerter |
| Header Auth (`Bearer {PAT}`) | Tailor CV attachment upload (self-hosted only) |

## Webhooks & Callbacks

**Incoming:**
- n8n Wait node webhooks — Used in scanner workflows for rate-limiting delays (e.g. `webhookId` in `workflows/01a-scanner-greenhouse.json`, node `Wait 1s`)
- n8n `WEBHOOK_URL` — Base URL for n8n-managed webhooks when self-hosted behind Caddy

**Outgoing:**
- Greenhouse/Ashby/Lever public job APIs — Scanner workflows 01a–01c
- `http://jobspy-scanner:3457/batch` — JobSpy sidecar (`workflows/01d-scanner-jobspy.json`)
- `http://cv-renderer:3456/render` — CV renderer sidecar (`workflows/03-tailor.json`)
- `https://content.airtable.com/v0/.../uploadAttachment` — DOCX upload (`workflows/03-tailor.json`)
- OpenAI-compatible LLM endpoints — Evaluator and Tailor workflows
- Resend email API — Evaluator, Housekeeper, Alerter workflows
- Optional: Gmail SMTP, Discord webhook URL (manual configuration per `docs/NOTIFICATION-SETUP.md`)

**Internal service mesh (Docker Compose network):**
| Service | Hostname | Port | Endpoints |
|---------|----------|------|-----------|
| cv-renderer | `cv-renderer` | 3456 | `GET /health`, `POST /render` |
| jobspy-scanner | `jobspy-scanner` | 3457 | `GET /health`, `POST /scan`, `POST /batch` |
| n8n | `n8n` | 5678 | n8n UI and workflow execution |

---

*Integration audit: 2026-06-05*
