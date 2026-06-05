# Technology Stack

**Analysis Date:** 2026-06-05

## Languages

**Primary:**
- Python 3.12 — Sidecar microservices in `scripts/` (`jobspy_service.py`, `cv_service.py`, `render_cv.py`)
- JSON — n8n workflow definitions in `workflows/*.json`

**Secondary:**
- Markdown — Documentation in `docs/`, `README.md`, `airtable/AIRTABLE-SCHEMA.md`
- CSV — Airtable import templates in `airtable/templates/`, default company list in `companies-default.csv`
- JavaScript — Inline in n8n Code nodes (`n8n-nodes-base.code`) within workflow JSON files

## Runtime

**Environment:**
- Docker / Docker Compose — Self-hosted full stack (`docker-compose.example.yml`)
- n8n — Workflow orchestration runtime (Node.js internally; shipped as `docker.n8n.io/n8nio/n8n` image)
- Python 3.12 — Flask HTTP server (`scripts/jobspy_service.py`) and stdlib HTTP server (`scripts/cv_service.py`)

**Package Manager:**
- pip — Python dependencies in `scripts/requirements.txt`
- Lockfile: missing (Dockerfiles install packages directly with `pip install --no-cache-dir`)

## Frameworks

**Core:**
- n8n — Workflow automation and scheduling; all business logic lives in exported workflow JSON (`workflows/`)
- Flask — HTTP API for JobSpy scanner sidecar (`scripts/jobspy_service.py`, port 3457)
- python-docx — DOCX generation for tailored CVs (`scripts/render_cv.py`)

**Testing:**
- Not detected — No test framework, test files, or CI test pipeline in the repository

**Build/Dev:**
- Docker Compose — Multi-service stack orchestration (`docker-compose.example.yml`)
- Docker — Sidecar images built from `scripts/Dockerfile.jobspy` and `scripts/Dockerfile.cv-renderer`
- Caddy — HTTPS reverse proxy in self-hosted deployments (`caddy:latest` in `docker-compose.example.yml`)

## Key Dependencies

**Critical:**
- `python-jobspy` — LinkedIn and Indeed job scraping; imported in `scripts/jobspy_service.py` via `from jobspy import scrape_jobs`
- `flask` — JobSpy sidecar HTTP layer (`scripts/jobspy_service.py`)
- `python-docx` — CV DOCX rendering (`scripts/render_cv.py`, `scripts/Dockerfile.cv-renderer`)

**Infrastructure:**
- `postgres:16-alpine` — n8n workflow/credential persistence (`docker-compose.example.yml`, service `db`)
- `docker.n8n.io/n8nio/n8n` — n8n application container (no version tag pinned in example compose)
- `caddy:latest` — TLS termination and reverse proxy to n8n

**n8n community/integration nodes (referenced in workflow JSON):**
- `@n8n/n8n-nodes-langchain.openAi` — AI scoring, interview prep, CV tailoring (`workflows/02-evaluator.json`, `workflows/03-tailor.json`)
- `n8n-nodes-resend.resend` — Default email delivery (`workflows/02-evaluator.json`, `workflows/04-housekeeper.json`, `workflows/06-alerter.json`)
- `n8n-nodes-base.airtable` — All Airtable read/write operations across workflows
- `n8n-nodes-base.httpRequest` — External API calls (career boards, sidecars, Airtable attachment upload)

## Configuration

**Environment:**
- Self-hosted stack configured via `docker-compose.yml` (copied from `docker-compose.example.yml`; `docker-compose.yml` is gitignored)
- n8n credentials (Airtable PAT, OpenAI-compatible API key, Resend API key, Header Auth for Airtable uploads) stored in n8n's credential store — not in the repository
- `.env` file pattern is gitignored (`.gitignore`); no committed env file in repo

**Key configs required (self-hosted, from `docker-compose.example.yml` and `docs/SETUP.md`):**
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` — Postgres for n8n
- `DB_TYPE=postgresdb`, `DB_POSTGRESDB_*` — n8n database connection
- `WEBHOOK_URL` — Public n8n URL when behind Caddy
- `N8N_METRICS`, `N8N_SECURE_COOKIE` — n8n runtime flags
- `GENERIC_TIMEZONE` — Schedule trigger timezone (documented in `docs/SETUP.md`, not in example compose)
- `N8N_BASIC_AUTH_USER`, `N8N_BASIC_AUTH_PASSWORD`, `N8N_HOST`, `N8N_PROTOCOL` — Optional n8n access hardening (`docs/SETUP.md`)

**Build:**
- `docker-compose.example.yml` — Full self-hosted stack definition
- `scripts/Dockerfile.jobspy` — Python 3.12-slim image, installs `python-jobspy` and `flask`
- `scripts/Dockerfile.cv-renderer` — Python 3.12-alpine image, installs `python-docx`
- `scripts/requirements.txt` — Declares `python-docx`, `flask`, `python-jobspy` (unpinned versions)

## Platform Requirements

**Development:**
- n8n instance (Desktop, Cloud, or self-hosted Docker) for importing and running `workflows/*.json`
- Airtable account with Personal Access Token
- OpenAI-compatible AI provider API key (or local LM Studio/Ollama for fully local mode)
- For full features: Docker with 2GB+ RAM to run n8n + Postgres + Caddy + both Python sidecars simultaneously (`README.md`, `docs/SETUP.md`)

**Production:**
- **Self-hosted (recommended):** VPS with Docker Compose — Ubuntu 24.04, 2GB RAM minimum (`docs/SETUP.md`)
- **n8n Cloud:** Hosted n8n; sidecars unavailable (no JobSpy, no DOCX CV renderer)
- **Fully local:** n8n Desktop + optional local Docker sidecars; runs only when machine is on (`docs/SETUP.md`)

**Deployment targets:**
| Mode | Orchestration | Sidecars | Persistence |
|------|---------------|----------|-------------|
| Self-hosted VPS | Docker Compose (`docker-compose.example.yml`) | `cv-renderer:3456`, `jobspy-scanner:3457` | Postgres 16 + Docker volumes |
| n8n Cloud | n8n.io hosted | Not supported | n8n Cloud managed |
| n8n Desktop | Local app | Optional local Docker | Local n8n storage |

---

*Stack analysis: 2026-06-05*
