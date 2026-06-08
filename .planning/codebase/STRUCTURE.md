# Codebase Structure

**Analysis Date:** 2026-06-09

## Directory Layout

```
jobsignal-engine/
├── .github/
│   └── ISSUE_TEMPLATE/
│       └── bug_report.md              # Bug report template for GitHub Issues
├── .planning/
│   ├── codebase/                       # Auto-generated codebase analysis docs
│   ├── graphs/                         # Knowledge graph data
│   └── config.json                     # GSD workflow configuration
├── airtable/
│   ├── AIRTABLE-SCHEMA.md              # Full schema documentation for all 4 tables
│   └── templates/                      # CSV import templates for Airtable base setup
│       ├── Profile-Grid view.csv
│       ├── Tracked Companies-Grid view.csv
│       ├── Pipeline-Grid view.csv
│       └── Search Queries-Grid view.csv
├── assets/                             # Screenshots and diagrams for README
│   ├── banner.png
│   ├── daily-digest.png
│   ├── demo.gif
│   ├── evaluator-workflow.png
│   ├── high-fit-alert.png
│   ├── interview-prep-questions.png
│   ├── interview-prep-star.png
│   ├── pipeline-view.png
│   └── tailored-cv.png
├── docs/                               # User-facing documentation
│   ├── AI-PROVIDERS.md                 # AI provider configuration guide (273 lines)
│   ├── AIRTABLE-SCHEMA.md              # Duplicate of airtable/AIRTABLE-SCHEMA.md
│   ├── COST-GUIDE.md                   # Detailed monthly cost breakdowns
│   ├── CUSTOMIZATION.md                # Guide for adding companies, tuning keywords
│   ├── NOTIFICATION-SETUP.md           # Email notification configuration
│   └── SETUP.md                        # Full setup guide (391 lines)
├── scripts/                            # Python sidecar services
│   ├── cv_service.py                   # HTTP service: markdown→DOCX conversion (79 lines)
│   ├── Dockerfile.cv-renderer          # Docker image for CV renderer
│   ├── Dockerfile.jobspy               # Docker image for JobSpy scanner
│   ├── jobspy_service.py               # Flask HTTP service: LinkedIn/Indeed scraping (293 lines)
│   ├── render_cv.py                    # Core DOCX generation library (361 lines)
│   └── requirements.txt                # Python dependencies (python-docx, flask, python-jobspy)
├── workflows/                          # n8n workflow definitions (JSON)
│   ├── 01a-scanner-greenhouse.json     # Wf 1a: Greenhouse API scanner (908 lines)
│   ├── 01b-scanner-ashby.json          # Wf 1b: Ashby API scanner
│   ├── 01c-scanner-lever.json          # Wf 1c: Lever API scanner
│   ├── 01d-scanner-jobspy.json         # Wf 1d: JobSpy sidecar scanner (762 lines)
│   ├── 02-evaluator.json               # Wf 2: AI scoring + interview prep + alerts (1376 lines)
│   ├── 03-tailor.json                  # Wf 3: AI CV tailoring + DOCX generation (825 lines)
│   ├── 04-housekeeper.json             # Wf 4: Auto-archive/close/alert (1350 lines)
│   └── 06-alerter.json                 # Wf 6: Daily digest email (359 lines)
├── .gitignore
├── companies-default.csv               # 139 pre-verified companies with API endpoints
├── docker-compose.example.yml          # Full Docker Compose stack (n8n, Postgres, Caddy, sidecars)
├── LICENSE                             # MIT license
└── README.md                           # Project overview, architecture, quickstart (693 lines)
```

## Directory Purposes

**`workflows/` — n8n Pipeline Workflows:**
- Purpose: All scheduled n8n workflow definitions — the core of the system
- Contains: 8 JSON files, each representing one pipeline workflow
- Key files:
  - `01a-scanner-greenhouse.json` — Scans Greenhouse API for jobs across tracked companies
  - `01b-scanner-ashby.json` — Scans Ashby API (OpenAI, Perplexity, Runway, etc.)
  - `01c-scanner-lever.json` — Scans Lever API (Mistral, Plaid, etc.)
  - `01d-scanner-jobspy.json` — Scrapes LinkedIn/Indeed via Python sidecar (self-hosted only)
  - `02-evaluator.json` — Core AI scoring + interview prep + high-fit alert (largest: 1376 lines)
  - `03-tailor.json` — AI CV tailoring → DOCX generation via sidecar
  - `04-housekeeper.json` — Weekly maintenance: archive, close, alert
  - `06-alerter.json` — Daily digest email builder
- Naming: Numbered prefix (01a, 01b, ... 06) indicates execution order. Gap at 05 is reserved for future Optimizer workflow

**`scripts/` — Python Sidecar Services:**
- Purpose: Companion services that n8n calls via HTTP for tasks Python handles better than low-code
- Contains: Python scripts, Dockerfiles for containerization
- Key files:
  - `cv_service.py` — Flask-like HTTP server on port 3456, endpoint POST `/render` returns base64 DOCX
  - `render_cv.py` — Core library: parses CV markdown, builds DOCX via python-docx, handles section headers, bullet points, skills formatting
  - `jobspy_service.py` — Flask app on port 3457, endpoints POST `/scan` (single query), POST `/batch` (multi-query), GET `/health`
  - `Dockerfile.cv-renderer` — Alpine-based: installs python-docx, copies both cv_service.py and render_cv.py
  - `Dockerfile.jobspy` — Slim-based: installs python-jobspy and flask
- Port convention: CV renderer = 3456, JobSpy = 3457

**`airtable/` — Database Schema & Templates:**
- Purpose: Airtable schema reference and CSV templates for easy setup
- Contains: Schema docs, 4 CSV template files
- Key files:
  - `AIRTABLE-SCHEMA.md` — Complete field-by-field documentation for all 4 tables (Profile, Tracked Companies, Pipeline, Search Queries) with field types and auto-population notes
  - `templates/Profile-Grid view.csv` — Single-row profile template
  - `templates/Tracked Companies-Grid view.csv` — 139 pre-loaded verified companies
  - `templates/Pipeline-Grid view.csv` — Pipeline column structure
  - `templates/Search Queries-Grid view.csv` — JobSpy query configuration

**`docs/` — User Documentation:**
- Purpose: Setup guides, configuration references, cost estimation
- Contains: 6 markdown documents
- Key files:
  - `SETUP.md` — Full walkthrough for all 3 deployment modes (self-hosted, local, n8n Cloud)
  - `AI-PROVIDERS.md` — How to switch between Google AI Studio, OpenAI, LM Studio, Ollama, OpenRouter
  - `CUSTOMIZATION.md` — Adding companies, tuning scoring keywords, adjusting geography
  - `NOTIFICATION-SETUP.md` — Gmail SMTP, Resend HTTP API, Discord webhook configuration
  - `COST-GUIDE.md` — Detailed breakdown: VPS pricing, per-job AI costs, sidecar vs cloud comparison

**`assets/` — Media & Screenshots:**
- Purpose: Visual resources for README
- Contains: PNG screenshots of Airtable pipeline view, email alerts, demo GIF, workflow canvas

**`.planning/` — GSD Project Planning:**
- Purpose: GSD (Goal-oriented Software Development) planning artifacts
- Contains: Codebase analysis (`codebase/`), knowledge graph data (`graphs/`), configuration

## Key File Locations

**Workflow Definitions (Core Logic):**
- `workflows/02-evaluator.json`: AI scoring pipeline — the most complex workflow. Contains: Profile fetch → New Jobs fetch → Build Scoring Prompt → Loop Over Jobs → Score Job AI → Parse AI Response → Update Airtable → Branch on High Fit → Interview Prep AI → Send Email
- `workflows/03-tailor.json`: CV tailoring pipeline. Contains: Schedule + Manual triggers → Get High Fit Jobs → Get Profile → Loop over jobs → Build Tailoring Prompt → AI Rewrite CV → Parse → Store markdown → HTTP to cv-renderer → Upload DOCX to Airtable
- `workflows/04-housekeeper.json`: Maintenance pipeline. Three parallel data gathering branches (stale low-fit, ghosted applications, stuck new) → merge → conditional update → optional email alert
- `workflows/06-alerter.json`: Digest email builder. Queries today's new jobs, high-fit awaiting review, and all pipeline statuses → builds HTML email body → sends via email node

**Configuration:**
- `docker-compose.example.yml`: Full stack definition — 5 services (caddy, db, n8n, cv-renderer, jobspy-scanner) with volumes, ports, dependencies, environment variables
- `scripts/Dockerfile.cv-renderer`: Python 3.12-alpine, installs python-docx, copies render_cv.py + cv_service.py, exposes port 3456
- `scripts/Dockerfile.jobspy`: Python 3.12-slim, installs python-jobspy + flask, copies jobspy_service.py, exposes port 3457

**Entry Points:**
- `workflows/*.json` — Each workflow JSON is an importable n8n workflow. Import via n8n UI: Settings → Import from File
- `scripts/cv_service.py` — Entry point for the CV renderer Docker container (line 75: `__main__` starts HTTP server on port 3456)
- `scripts/jobspy_service.py` — Entry point for the JobSpy scanner Docker container (line 291: `__main__` starts Flask on port 3457)

## Naming Conventions

**Files:**
- **Workflow JSONs**: `{number}-{hyphenated-name}.json` — Two-digit number with optional letter suffix for scanner variants (e.g., `01a-scanner-greenhouse.json`, `02-evaluator.json`, `06-alerter.json`)
- **Python scripts**: `snake_case_service.py` for services, `snake_case.py` for libraries (e.g., `cv_service.py`, `render_cv.py`, `jobspy_service.py`)
- **Dockerfiles**: `Dockerfile.{service-name}` (e.g., `Dockerfile.cv-renderer`, `Dockerfile.jobspy`)
- **Documentation**: `UPPERCASE-HYPHENATED.md` (e.g., `AIRTABLE-SCHEMA.md`, `AI-PROVIDERS.md`, `NOTIFICATION-SETUP.md`)
- **CSV templates**: `{Table Name}-Grid view.csv` — matches Airtable's CSV export naming

**Directories:**
- All lowercase with hyphens for multi-word names (e.g., `airtable/templates/`, `scripts/`, `workflows/`, `docker-compose.example.yml`)

**Workflow Nodes (within n8n JSON):**
- Action-oriented PascalCase names: `Get Profile`, `Get Tracked Companies`, `Loop Companies`, `Build Scoring Prompt`, `Score Job (GPT-5 mini)`, `Parse AI Response`, `Generate STAR Responses`
- Node type suffixes reference n8n-specific types: `n8n-nodes-base.code`, `n8n-nodes-base.airtable`, `@n8n/n8n-nodes-langchain.openAi`, `n8n-nodes-base.splitInBatches`

**Python Functions:**
- `snake_case` for functions and variables (e.g., `run_single_query`, `parse_markdown`, `build_docx`, `is_section_header`, `_build_location_string`)
- `CamelCase` for classes (e.g., `CVHandler(HTTPServer)`, `Flask` app instance)
- Single leading underscore for private/helper functions (e.g., `_respond`, `_build_location_string`, `_safe_number`)

**Airtable Fields:**
- Space-separated PascalCase: `Full Name`, `Professional Summary`, `Core Skills`, `Target Roles`, `Fit Score`, `Fit Tier`, `CV Tailoring Notes`, `Tailored CV`
- Source-specific suffixes: `AI Evaluation Cost`, `CV Tailoring Cost`, `Interview Prep Cost`

## Where to Add New Code

**New Scanner Source:**
- Primary code: `workflows/{number}-scanner-{source}.json` — Follow the pattern of existing scanner workflows (Airtable query for Tracked Companies → Loop → HTTP API → Parse → Deduplicate → Insert)
- Example: `workflows/01e-scanner-glassdoor.json` for a new Glassdoor scanner
- Tests: Not applicable (n8n workflows are tested manually via n8n UI)

**New Workflow / Pipeline Stage:**
- Implementation: `workflows/{number}-{name}.json` — Follow the schedule-trigger → Airtable read → processing → Airtable write → notification pattern
- Numbering: Use the next available number in the sequence. Gap at 05 for Optimizer

**New Python Sidecar:**
- Implementation service: `scripts/{name}_service.py` — HTTP service with GET /health and relevant POST endpoints
- Core library (if needed): `scripts/{name}.py` — Separated from service layer
- Dockerfile: `scripts/Dockerfile.{name}`
- Integration: Add service to `docker-compose.example.yml`
- Port: Choose an unused port (3456-3459 range established)

**New Airtable Table / Schema Change:**
- Schema doc: Update `airtable/AIRTABLE-SCHEMA.md` with new field definitions
- Template: Add CSV to `airtable/templates/`
- Workflow updates: Update all workflows that read/write the affected table

**New Notification Channel:**
- Document configuration: Update `docs/NOTIFICATION-SETUP.md`
- Workflow update: Add notification node to `workflows/02-evaluator.json` (high-fit alert) and `workflows/06-alerter.json` (daily digest)

**New AI Provider Support:**
- Document: Update `docs/AI-PROVIDERS.md` with Base URL and model configuration
- Workflow changes: None required — all AI nodes use the same OpenAI-compatible credential. Provider switch is a credential-level change only

**Configuration / Setup Changes:**
- Deployment: Update `docs/SETUP.md`
- Docker: Update `docker-compose.example.yml`
- AI costs: Update `docs/COST-GUIDE.md`

**Utilities / Shared Code:**
- Shared Python helpers: `scripts/` directory
- Shared n8n sub-workflows: Not currently used — no shared workflow fragments exist

## Special Directories

**`.git/`:**
- Purpose: Git repository data
- Generated: Yes (by `git init`)
- Committed: No

**`.github/`:**
- Purpose: GitHub-specific configurations (issue templates)
- Generated: No
- Committed: Yes

**`.planning/`:**
- Purpose: GSD (Goal-oriented Software Development) project planning artifacts — codebase maps, knowledge graphs, config
- Generated: Yes (by `/gsd-map-codebase` and other GSD commands)
- Committed: Yes (required by GSD workflow)

**`assets/`:**
- Purpose: Screenshots and media for README documentation
- Generated: No (user-created screenshots)
- Committed: Yes

---

*Structure analysis: 2026-06-09*
