# Codebase Structure

**Analysis Date:** 2026-06-05

## Directory Layout

```
jobsignal-engine/
├── README.md                      # Product overview, architecture diagram, quickstart
├── LICENSE                        # MIT
├── companies-default.csv          # 139 verified companies (import to Tracked Companies)
├── docker-compose.example.yml     # Self-hosted stack: n8n, Postgres, Caddy, sidecars
├── workflows/                     # n8n workflow exports (core application logic)
│   ├── 01a-scanner-greenhouse.json
│   ├── 01b-scanner-ashby.json
│   ├── 01c-scanner-lever.json
│   ├── 01d-scanner-jobspy.json    # Self-hosted / local only
│   ├── 02-evaluator.json
│   ├── 03-tailor.json
│   ├── 04-housekeeper.json
│   └── 06-alerter.json            # Note: no 05 — Optimizer is roadmap
├── scripts/                       # Python sidecar services
│   ├── cv_service.py              # HTTP wrapper for DOCX rendering (port 3456)
│   ├── render_cv.py               # python-docx CV builder
│   ├── jobspy_service.py          # Flask JobSpy scraper (port 3457)
│   ├── Dockerfile.cv-renderer
│   ├── Dockerfile.jobspy
│   └── requirements.txt
├── airtable/                      # Schema docs + CSV import templates
│   ├── AIRTABLE-SCHEMA.md
│   └── templates/
│       ├── Profile-Grid view.csv
│       ├── Tracked Companies-Grid view.csv
│       ├── Pipeline-Grid view.csv
│       └── Search Queries-Grid view.csv
├── docs/                          # Setup and operations guides
│   ├── SETUP.md
│   ├── AIRTABLE-SCHEMA.md         # Duplicate of airtable schema (same content)
│   ├── AI-PROVIDERS.md
│   ├── CUSTOMIZATION.md
│   ├── NOTIFICATION-SETUP.md
│   └── COST-GUIDE.md
├── .github/ISSUE_TEMPLATE/        # GitHub issue templates
├── .planning/                     # GSD planning artifacts (not runtime)
│   ├── config.json
│   ├── codebase/                  # Codebase intelligence docs
│   └── graphs/                    # Knowledge graph outputs
└── graphify-out/                  # Generated graph analysis (not runtime)
```

## Directory Purposes

**`workflows/`:**
- Purpose: Entire orchestration layer — the "application"
- Contains: 8 JSON workflow exports importable via n8n Settings → Import from File
- Key files: Scanner family (`01a`–`01d`), processing (`02`–`03`), maintenance (`04`, `06`)

**`scripts/`:**
- Purpose: Python sidecars called by n8n HTTP Request nodes
- Contains: Flask/HTTPServer services + Dockerfiles + shared `requirements.txt`
- Key files: `cv_service.py`, `jobspy_service.py`, `render_cv.py`

**`airtable/`:**
- Purpose: Database schema contract and bootstrap data
- Contains: Field-type reference and CSV templates for all 4 tables
- Key files: `AIRTABLE-SCHEMA.md`, `templates/*.csv`

**`docs/`:**
- Purpose: Human-facing deployment and customization guides
- Contains: Step-by-step setup for self-hosted, Cloud, and local modes
- Key files: `SETUP.md` (primary onboarding), `AI-PROVIDERS.md`, `NOTIFICATION-SETUP.md`

**`companies-default.csv`:**
- Purpose: Seed data for Tracked Companies table (139 companies, 30 categories)
- Contains: Company name, careers URL, API endpoint, scan method, title keywords
- Key files: Root-level CSV; import or copy into Airtable

## Key File Locations

**Entry Points:**
- `workflows/*.json`: Scheduled and manual workflow triggers (n8n)
- `docker-compose.example.yml`: Self-hosted infrastructure bootstrap
- `scripts/cv_service.py`: `POST /render` on port 3456
- `scripts/jobspy_service.py`: `POST /batch` on port 3457

**Configuration:**
- `docker-compose.example.yml`: n8n env vars, Postgres, Caddy, sidecar builds
- User Airtable base: Base ID + table IDs configured inside each workflow's Airtable nodes (replace developer defaults like `appE808oZ5gTSQzUY`)
- n8n Credentials UI: Airtable PAT, OpenAI API, Resend, Header Auth (not in repo)

**Core Logic:**
- Scanner parse/filter/dedupe: Code nodes inside `workflows/01a-scanner-greenhouse.json` (pattern repeated in `01b`–`01d`)
- AI scoring + interview prep: `workflows/02-evaluator.json`
- CV tailoring + DOCX upload: `workflows/03-tailor.json`
- Pipeline cleanup: `workflows/04-housekeeper.json`
- Daily digest: `workflows/06-alerter.json`

**Testing:**
- Not applicable — no automated test suite. Manual verification via n8n "Execute Workflow" (see `docs/SETUP.md` checklist).

## Naming Conventions

**Files:**
- Workflows: `{NN}{letter?}-{role}-{source}.json` — e.g., `01a-scanner-greenhouse.json`, `02-evaluator.json`
- Scripts: `{service}_service.py` for HTTP wrappers; `render_cv.py` for library logic
- Docs: `UPPERCASE-WITH-DASHES.md` in `docs/`; `AIRTABLE-SCHEMA.md` in `airtable/`
- Airtable templates: `{Table Name}-Grid view.csv` with spaces in filename

**Directories:**
- Lowercase single-word or kebab-case: `workflows/`, `scripts/`, `airtable/`, `docs/`

**n8n node names (inside JSON):**
- Descriptive Title Case: `Get Profile`, `Parse & Filter Jobs`, `Deduplicate vs Pipeline`
- Loop nodes: `Loop Companies`, `Loop Over Jobs`
- Conditional: `If`, `Has Low Fit to Archive?`

## Where to Add New Code

**New job source scanner (e.g., another ATS API):**
- Primary code: Copy `workflows/01a-scanner-greenhouse.json` → new file `workflows/01x-scanner-{source}.json`
- Modify: `Parse & Filter Jobs` Code node for API response shape; `Get Tracked Companies` filter for new `Scan Method` value
- Data: Add companies to `companies-default.csv` and/or user Tracked Companies table with verified `API Endpoint`
- Schedule: Offset `triggerAtMinute` to avoid collision (existing: 0, 5, 10, 15 past 8:00)

**New AI processing step (e.g., cover letter):**
- Primary code: New workflow JSON in `workflows/` or extend `02-evaluator.json` / `03-tailor.json`
- Data: Add Pipeline fields in `airtable/AIRTABLE-SCHEMA.md` and user base first
- Pattern: `Get Profile` → query Pipeline → Code node builds prompt → OpenAI node → parse Code node → Airtable update

**New sidecar capability:**
- Implementation: New `scripts/{name}_service.py` + `scripts/Dockerfile.{name}`
- Infrastructure: Add service block to `docker-compose.example.yml` with `expose` port
- Workflow: HTTP Request node pointing at Docker service hostname

**New notification channel (Slack, Discord, Telegram):**
- Primary code: Replace or branch from Resend nodes in `02-evaluator.json` and `06-alerter.json`
- Reference: `docs/NOTIFICATION-SETUP.md`

**Profile / scoring customization:**
- Prompt changes: `Build Scoring Prompt` Code node in `workflows/02-evaluator.json`
- User-facing config: `Profile.Scoring Rubric Override` field (documented in `airtable/AIRTABLE-SCHEMA.md`)
- Guide: `docs/CUSTOMIZATION.md`

**New Pipeline fields:**
- Schema: Update `airtable/AIRTABLE-SCHEMA.md` and `docs/AIRTABLE-SCHEMA.md`
- Templates: Update `airtable/templates/Pipeline-Grid view.csv`
- Workflows: Update Airtable node field mappings in every workflow that reads/writes Pipeline (field lists are duplicated per workflow JSON)

**New company seed data:**
- File: `companies-default.csv` (columns: company, careers URL, API endpoint, scan method, keywords, category)

## Special Directories

**`.planning/`:**
- Purpose: GSD project planning, codebase maps, knowledge graphs
- Generated: Partially (graphs from analysis tools)
- Committed: Yes — intelligence for agents, not used at runtime

**`graphify-out/`:**
- Purpose: Knowledge graph HTML/JSON from graphify analysis
- Generated: Yes
- Committed: Present in repo; not part of JobSignal runtime

**`.git/`, `.github/`:**
- Purpose: Version control and issue templates
- Generated: Standard git metadata
- Committed: Yes

## Workflow Import Order

When setting up a new n8n instance, import from `workflows/` in this order (from `README.md` and `docs/SETUP.md`):

1. `01a-scanner-greenhouse.json`
2. `01b-scanner-ashby.json`
3. `01c-scanner-lever.json`
4. `01d-scanner-jobspy.json` (self-hosted only — skip on n8n Cloud)
5. `02-evaluator.json`
6. `03-tailor.json`
7. `04-housekeeper.json`
8. `06-alerter.json`

After import, replace Airtable base/table IDs and credential references in every workflow.

## Schedule Reference

All times use n8n instance timezone (`GENERIC_TIMEZONE` in Docker):

| Workflow | File | Schedule |
|----------|------|----------|
| Greenhouse | `01a-scanner-greenhouse.json` | Daily 8:00 |
| Ashby | `01b-scanner-ashby.json` | Daily 8:05 |
| Lever | `01c-scanner-lever.json` | Daily 8:10 |
| JobSpy | `01d-scanner-jobspy.json` | Daily 8:15 |
| Evaluator | `02-evaluator.json` | Daily 9:00 |
| Tailor | `03-tailor.json` | Daily 9:30 |
| Housekeeper | `04-housekeeper.json` | Weekly |
| Alerter | `06-alerter.json` | Daily 18:00 |

## Docker Service Map

From `docker-compose.example.yml`:

| Service | Image / Build | Port | Connects to |
|---------|---------------|------|-------------|
| `n8n` | `docker.n8n.io/n8nio/n8n` | 5678 (exposed) | Postgres, sidecars via Docker DNS |
| `db` | `postgres:16-alpine` | internal | n8n persistence |
| `caddy` | `caddy:latest` | 80, 443 | Reverse proxy to n8n |
| `cv-renderer` | `scripts/Dockerfile.cv-renderer` | 3456 (expose) | `shared_tmp` volume with n8n |
| `jobspy-scanner` | `scripts/Dockerfile.jobspy` | 3457 (expose) | n8n HTTP only |

n8n workflows reference sidecars by Docker service name: `http://cv-renderer:3456/render`, `http://jobspy-scanner:3457/batch`.

---

*Structure analysis: 2026-06-05*
