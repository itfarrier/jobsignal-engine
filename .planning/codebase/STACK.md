# Technology Stack

**Analysis Date:** 2026-06-09

## Languages

**Primary:**
- JavaScript (ES2020+) — Used in n8n Code nodes for all workflow logic: job parsing, deduplication (FNV-1a hashing), prompt building, Airtable data transformation, AI response parsing, cost calculation. See `workflows/*.json` for all Code node implementations.
- Python 3.12 — Used for Docker sidecar services: CV rendering (`scripts/cv_service.py`, `scripts/render_cv.py`) and JobSpy scraping (`scripts/jobspy_service.py`).

## Runtime

**Environment:**
- n8n (self-hosted via Docker, or n8n Cloud, or n8n Desktop) — The workflow orchestration engine. All business logic lives in n8n workflow JSON files under `workflows/`. No separate application server.
- Python 3.12-alpine (CV renderer sidecar) — `scripts/Dockerfile.cv-renderer`
- Python 3.12-slim (JobSpy scanner sidecar) — `scripts/Dockerfile.jobspy`

**Package Manager:**
- pip — Python dependencies for sidecars
- Lockfile: Not detected (no `requirements.lock` or similar)
- No Node.js package manager — n8n is the runtime; no `package.json` in this repo

## Frameworks

**Core:**
- [n8n](https://n8n.io) (self-hosted or cloud) — Workflow automation engine. All 8 workflows (scanners, evaluator, tailor, housekeeper, alerter) are n8n-native JSON definitions. Runtime provided by the `docker.n8n.io/n8nio/n8n` Docker image.
- Model used: `n8nio/n8n` (latest) — configured in `docker-compose.example.yml`

**Testing:**
- Not detected — No test framework, test files, or test configurations found

**Build/Dev:**
- Docker / Docker Compose — Local development and deployment via `docker-compose.example.yml`

## Key Dependencies

**Critical:**
- `python-jobspy` — Scrapes LinkedIn and Indeed. Used by `scripts/jobspy_service.py`. Only relevant for self-hosted deployments with the JobSpy sidecar. Upstream stability depends on LinkedIn/Indeed HTML structure.
- `python-docx` — Generates DOCX files from markdown CVs. Used by `scripts/render_cv.py` and `cv_service.py`. Self-hosted sidecar.
- `flask` — HTTP server for jobspy_service.py CV rendering and scanning endpoints.

**Infrastructure:**
- `Caddy` (latest) — Reverse proxy (TLS termination, domain routing). Configured in `docker-compose.example.yml` but `Caddyfile` is in `.gitignore` / not in repo.
- `postgres:16-alpine` — n8n persistence database. Not used by JobSignal business logic — n8n stores its own workflow state here.
- Resend (HTTP API) — Email sending. Pre-wired in n8n nodes. Free tier: 100 emails/day.
- Airtable (Personal Access Token auth) — Source of truth database. All 8 workflows read/write Airtable.

## Configuration

**Environment:**
- No `.env` file detected — configuration is managed through n8n credential store and Docker Compose environment variables.
- `docker-compose.example.yml` defines required environment variables for n8n:
  - `DB_TYPE=postgresdb`, `DB_POSTGRESDB_HOST`, `DB_POSTGRESDB_PORT`, `DB_POSTGRESDB_DATABASE`, `DB_POSTGRESDB_USER`, `DB_POSTGRESDB_PASSWORD`
  - `N8N_METRICS=true`, `N8N_SECURE_COOKIE=true`
  - `WEBHOOK_URL` — optional, for production domain
  - `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` — for the PostgreSQL container

**Build:**
- `docker-compose.example.yml` — Full stack definition (Caddy, n8n, PostgreSQL, CV renderer, JobSpy scanner)
- `scripts/Dockerfile.cv-renderer` — Python 3.12-alpine image, installs python-docx
- `scripts/Dockerfile.jobspy` — Python 3.12-slim image, installs flask + python-jobspy

## Platform Requirements

**Development:**
- Docker Desktop or Docker Engine
- An Airtable account (free tier)
- An n8n instance (self-hosted Docker, n8n Cloud, or n8n Desktop)
- An AI provider API key (Google AI Studio for free tier, or OpenAI/OpenRouter/LM Studio/Ollama)
- 16GB RAM recommended if running local AI (LM Studio with 8B+ models)

**Production:**
- VPS with 2GB+ RAM for self-hosted full stack (recommended: DigitalOcean $12/mo droplet)
- 1GB minimum for core stack without sidecars
- Ports: 80/443 (Caddy), 5678 (n8n), 3456 (CV renderer), 3457 (JobSpy scanner)
- SMTP ports (465, 587) blocked on DigitalOcean by default — must use Resend or request SMTP unblock
- No CI pipeline detected — `.github/` only contains an issue template

---

*Stack analysis: 2026-06-09*
