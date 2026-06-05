<!-- refreshed: 2026-06-05 -->
# Architecture

**Analysis Date:** 2026-06-05

## System Overview

JobSignal Engine is an autonomous job-search pipeline: scheduled n8n workflows discover roles, score them with AI, tailor CVs, send notifications, and maintain pipeline hygiene. Airtable is the single source of truth. There is no application server — orchestration lives entirely in exportable n8n workflow JSON plus two optional Python HTTP sidecars.

```text
┌─────────────────────────────────────────────────────────────────────┐
│                   AIRTABLE (Source of Truth)                         │
│  Profile │ Tracked Companies │ Pipeline │ Search Queries             │
│  `airtable/templates/` + user base                                   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ read/write (Airtable PAT)
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ Scanners 1a-d │    │ Evaluator (2) │    │ Tailor (3)    │
│ `workflows/`  │    │ `workflows/`  │    │ `workflows/`  │
│ 8:00–8:15 AM  │    │ 9:00 AM       │    │ 9:30 AM       │
└───────┬───────┘    └───────┬───────┘    └───────┬───────┘
        │                    │                    │
        │ HTTP APIs          │ OpenAI-compatible  │ HTTP → cv-renderer
        │ + JobSpy sidecar   │ + Resend email     │ + Airtable upload
        ▼                    ▼                    ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ External ATS  │    │ AI Provider   │    │ cv-renderer   │
│ Greenhouse,   │    │ (single n8n   │    │ `:3456`       │
│ Ashby, Lever, │    │  credential)  │    │ `scripts/`  │
│ LinkedIn,     │    └───────────────┘    └───────────────┘
│ Indeed        │
│ jobspy `:3457`│
└───────────────┘

        ┌──────────────────┐    ┌──────────────────┐
        │ Housekeeper (4)  │    │ Alerter (6)      │
        │ Weekly           │    │ 6:00 PM daily    │
        └──────────────────┘    └──────────────────┘
```

**Runtime stack (self-hosted):** n8n + PostgreSQL + Caddy reverse proxy + sidecars, defined in `docker-compose.example.yml`.

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Greenhouse Scanner | Poll Greenhouse JSON APIs for tracked companies; filter by title/geography; dedupe; write Pipeline | `workflows/01a-scanner-greenhouse.json` |
| Ashby Scanner | Same pattern for Ashby API (inline descriptions) | `workflows/01b-scanner-ashby.json` |
| Lever Scanner | Same pattern for Lever API (flat array response) | `workflows/01c-scanner-lever.json` |
| JobSpy Scanner | Batch-scrape LinkedIn/Indeed via Python sidecar; self-hosted only | `workflows/01d-scanner-jobspy.json` |
| Evaluator | AI score 1–10, fit tier, interview prep, High Fit email alerts | `workflows/02-evaluator.json` |
| Tailor | AI CV rewrite → DOCX via sidecar → Airtable attachment | `workflows/03-tailor.json` |
| Housekeeper | Archive stale Low Fit; auto-close ghosted applications; stuck-job warnings | `workflows/04-housekeeper.json` |
| Alerter | Evening digest email with pipeline stats and High Fit cards | `workflows/06-alerter.json` |
| CV Renderer Sidecar | Markdown → DOCX over HTTP | `scripts/cv_service.py`, `scripts/render_cv.py` |
| JobSpy Sidecar | Job board scraping over HTTP | `scripts/jobspy_service.py` |
| Airtable Schema | Field types, views, import order | `airtable/AIRTABLE-SCHEMA.md`, `docs/AIRTABLE-SCHEMA.md` |
| Company Seed Data | 139 verified companies with API endpoints | `companies-default.csv` |

**Not in repo (roadmap):** Workflow 5 — Optimizer (closed-loop scoring analytics). **Branch-only:** `01e-scanner-hhru.json` (hh.ru API scanner) exists on `add-hh-ru` branch, not in `main` workflow set.

## Pattern Overview

**Overall:** Hub-and-spoke with Airtable as hub; loosely coupled scheduled workflows as spokes.

**Key Characteristics:**
- Workflows do not call each other — coordination is via Airtable `Pipeline.Status` and time-based schedules
- Business logic is embedded in n8n **Code** nodes (`n8n-nodes-base.code`), duplicated across scanner workflows rather than shared libraries
- Job identity uses pure-JS **FNV-1a** hash of title + company + apply link (no `crypto` module — blocked in n8n Code nodes)
- **Retry** on critical nodes: `retryOnFail: true` with `waitBetweenTries: 5000` on Airtable writes and HTTP fetches
- **Safety brakes:** max 100 net-new Pipeline records per scanner run; JobSpy caps `results_wanted` at 100 and batch at 10 queries

## Layers

**Configuration / Data Layer:**
- Purpose: User profile, company list, job lifecycle state, JobSpy query config
- Location: Airtable base (templates in `airtable/templates/`)
- Contains: 4 tables — Profile (1 row), Tracked Companies (~139), Pipeline (grows), Search Queries (JobSpy)
- Depends on: User-filled Profile; imported CSV templates
- Used by: All workflows via Airtable nodes

**Discovery Layer (Scanners 1a–1d):**
- Purpose: Find new jobs from ATS APIs and job boards
- Location: `workflows/01a-scanner-greenhouse.json` through `workflows/01d-scanner-jobspy.json`
- Contains: Schedule Trigger → read config → HTTP fetch → Parse & Filter → dedupe → Create Pipeline (`Status: New`)
- Depends on: Airtable PAT; Profile `Target Geography`; Tracked Companies or Search Queries; JobSpy sidecar for 1d
- Used by: Downstream Evaluator reading `Status = New`

**Intelligence Layer (Evaluator + Tailor):**
- Purpose: AI scoring, interview prep, CV tailoring
- Location: `workflows/02-evaluator.json`, `workflows/03-tailor.json`
- Contains: OpenAI-compatible nodes, prompt-building Code nodes, JSON parsing with preamble stripping
- Depends on: Single OpenAI API credential (any OpenAI-compatible provider); Profile `CV Markdown` for quality output
- Used by: Alerter (reads evaluated records); user (applies manually)

**Notification Layer:**
- Purpose: Real-time High Fit alerts and daily digest
- Location: `workflows/02-evaluator.json` (Resend node), `workflows/06-alerter.json`, `workflows/04-housekeeper.json` (weekly summary)
- Contains: HTML email built in Code nodes; `n8n-nodes-resend.resend` community nodes
- Depends on: Profile `Notification Email`; Resend API credential

**Sidecar Layer (self-hosted / local only):**
- Purpose: Capabilities n8n cannot run natively (DOCX rendering, JobSpy scraping)
- Location: `scripts/`; Docker services in `docker-compose.example.yml`
- Contains: Stateless Flask/HTTPServer microservices on ports 3456 and 3457
- Depends on: Docker network hostname `cv-renderer` / `jobspy-scanner` (or `localhost` for local Docker runs)

## Data Flow

### Primary Daily Pipeline

1. **8:00** — `01a-scanner-greenhouse.json` Schedule Trigger (`triggerAtHour: 8`) → `Get Profile` → `Get Tracked Companies` (Enabled, Scan Method = Greenhouse API) → loop per company → `Fetch Greenhouse API` → `Parse & Filter Jobs` → optional `Fetch Job Detail` + `Merge Descriptions` → `Aggregate All Jobs` → `Get Existing Job IDs` → `Deduplicate vs Pipeline` → `Create Pipeline Records`
2. **8:05 / 8:10 / 8:15** — `01b-scanner-ashby.json` (minute 5), `01c-scanner-lever.json` (minute 10), `01d-scanner-jobspy.json` (minute 15) run the same dedupe-and-create pattern against their respective sources
3. **9:00** — `02-evaluator.json` → `Get Profile` → `Get New Jobs` (Status = New) → `Build Scoring Prompt` → `Loop Over Jobs` → OpenAI score → `Parse AI Response` → `Update Job Record` (Status = Evaluated) → if `Fit Tier = High` → Resend alert + interview prep branch
4. **9:30** — `03-tailor.json` → `Get High Fit Jobs` without tailored CV → AI rewrite → `Render DOCX` (`http://cv-renderer:3456/render`) → `Update Pipeline Record` + `HTTP Request` Airtable attachment upload
5. **18:00** — `06-alerter.json` (`triggerAtHour: 18`) → sequential Airtable searches → `Build Email` → `Send Digest (Resend)`
6. **Weekly** — `04-housekeeper.json` Schedule Trigger (weekly interval) → sequential queries for stale Low Fit, stale applications, stuck New jobs → batch archive/close → housekeeping email

### Scanner Internal Pattern (1a–1c)

All company-ATS scanners share this node chain:

```text
Schedule Trigger → Get Profile → Get Tracked Companies → Loop Companies
  → Prepare Company Data → Fetch * API → Parse & Filter Jobs
  → [Greenhouse only: Fetch Job Detail → Merge Descriptions → Wait 1s]
  → Aggregate All Jobs → Get Existing Job IDs → Deduplicate vs Pipeline
  → If (has new jobs) → Create Pipeline Records
```

Geography filtering reads `Profile.Target Geography` dynamically in 1a–1c. JobSpy (`01d`) has a **hardcoded** geography list with a `TODO` to read Profile in v1.1.

### JobSpy Flow (1d)

1. `Get Search Queries` (Enabled rows) → `Build Batch Payload`
2. `Call JobSpy Scanner` → `http://jobspy-scanner:3457/batch` (POST)
3. `Parse & Filter Jobs` → dedupe → `Create Pipeline Records`

### Evaluator High-Fit Branch

1. `Parse AI Response` sets `Fit Tier` from AI JSON (`parsed.tier`; prompt defines High ≥ 8.0)
2. `If` node checks `Fit Tier === "High"`
3. True branch: `Send a new email` (Resend) → `Build Interview Prep Prompt` → OpenAI → `Parse & Save Interview Prep` → `Update Interview Prep`

**State Management:**
- Pipeline `Status` field drives workflow handoffs: `New` → `Evaluated` → user-managed (`Applied`, `Interview`, etc.) → `Archived`/`Rejected`
- No workflow shares in-memory state; each execution reads fresh from Airtable
- n8n persists workflow definitions and execution history in PostgreSQL when self-hosted

## Key Abstractions

**Job ID (deduplication key):**
- Purpose: Stable identity across sources for the same role
- Examples: FNV-1a implementation inside `Parse & Filter Jobs` Code nodes in all scanners
- Pattern: Hash of normalized `jobTitle + company + applyLink`; stored in Pipeline `Job ID`

**Profile-driven prompts:**
- Purpose: All AI behavior derives from one Airtable Profile row
- Examples: `Build Scoring Prompt` in `02-evaluator.json`; `Build Tailoring Prompt` in `03-tailor.json`
- Pattern: Code node reads `$('Get Profile')`, injects skills/roles/geography/negative filters/CV markdown into system prompts

**OpenAI-compatible credential:**
- Purpose: Provider-agnostic AI (Gemma, GPT, LM Studio, Ollama, OpenRouter)
- Examples: All `*GPT-5 mini*` OpenAI nodes across workflows 2 and 3
- Pattern: Single n8n OpenAI credential; swap Base URL + API key; disable "Output Content as JSON" for open-source models

**Sidecar HTTP contract:**
- Purpose: Offload Python-only work from n8n
- Examples: `POST /render` on port 3456; `POST /scan` and `POST /batch` on port 3457
- Pattern: n8n HTTP Request node → JSON in/out; sidecars are stateless

## Entry Points

**n8n Schedule Triggers:**
- Location: Each workflow's `Schedule Trigger` node (`n8n-nodes-base.scheduleTrigger`)
- Triggers: Server-local time via `GENERIC_TIMEZONE` (self-hosted) or n8n Cloud UTC
- Responsibilities: Start daily/weekly unattended runs

**n8n Manual Triggers:**
- Location: `Manual Trigger` node in every workflow
- Triggers: User clicks "Execute Workflow" in n8n UI
- Responsibilities: Setup testing and on-demand runs

**Python sidecar HTTP:**
- Location: `scripts/cv_service.py` (`GET /health`, `POST /render`); `scripts/jobspy_service.py` (`GET /health`, `POST /scan`, `POST /batch`)
- Triggers: n8n HTTP Request nodes from workflows 1d and 3
- Responsibilities: DOCX generation and job board scraping

**Docker Compose:**
- Location: `docker-compose.example.yml`
- Triggers: `docker compose up -d`
- Responsibilities: Boot n8n, Postgres, Caddy, both sidecars on shared Docker network

## Architectural Constraints

- **Threading:** n8n runs Node.js event loop; Python sidecars are separate processes. No shared memory between workflows.
- **Global state:** None in application code. All durable state in Airtable. n8n execution state in Postgres (self-hosted).
- **Circular imports:** Not applicable (no shared JS modules between workflows).
- **n8n Code node sandbox:** `require('crypto')` is blocked — FNV-1a must stay inline in Code nodes.
- **Parallel fan-in to Code nodes:** Housekeeper chains Airtable reads **sequentially** (`Get Profile` → `Get Stale Low Fit` → `Get Stale Applications` → `Get Stuck New Jobs`). Do not fan multiple Airtable nodes into one Code node — causes "node hasn't been executed" errors.
- **Airtable free tier:** 1,000 records/base — dedicated workspace required.
- **Deployment mode limits:** n8n Cloud cannot reach `cv-renderer` or `jobspy-scanner` sidecars — no DOCX attachments or LinkedIn/Indeed on Cloud tier.
- **Schedule timezone:** `triggerAtHour` uses n8n instance timezone (`GENERIC_TIMEZONE` in `docker-compose.example.yml`).

## Anti-Patterns

### Parallel Airtable reads into one Code node

**What happens:** Multiple Airtable search nodes connect in parallel to a single Code node that references all of them (e.g., `$('Get Stale Low Fit')` and `$('Get Stuck New Jobs')`).

**Why it's wrong:** n8n may execute the Code node before all upstream branches complete, producing "node hasn't been executed" failures.

**Do this instead:** Chain Airtable queries sequentially, as in `workflows/04-housekeeper.json` and `workflows/06-alerter.json`.

### Using `crypto` for job IDs

**What happens:** Code node imports Node `crypto` for SHA-256 hashing.

**Why it's wrong:** n8n sandbox blocks `require('crypto')`.

**Do this instead:** Use the inline FNV-1a hash in existing scanner `Parse & Filter Jobs` Code nodes.

### Relying on Airtable multi-select for AI-generated skill lists

**What happens:** Writing AI output to multi-select fields with values not pre-defined as options.

**Why it's wrong:** Airtable rejects unknown select values; writes fail silently or error.

**Do this instead:** Store `Matched Skills` and `Missing Skills` as **long text** fields (see `airtable/AIRTABLE-SCHEMA.md`).

### Enabling "Output Content as JSON" with open-source models

**What happens:** Gemma, LM Studio, Ollama return garbled or wrapped responses.

**Why it's wrong:** Provider JSON mode is inconsistent; models wrap output in `<thought>` tags.

**Do this instead:** Turn JSON mode off; enforce JSON in system prompts; strip preamble in `Parse AI Response` Code nodes (`workflows/02-evaluator.json`).

## Error Handling

**Strategy:** Fail loud on parse errors; retry transient external failures; degrade non-critical paths.

**Patterns:**
- Code nodes `throw new Error(...)` with context when Profile empty, JSON parse fails, or safety brake trips
- `retryOnFail: true` on Airtable create/update, HTTP fetches, OpenAI calls, DOCX render
- Scanner dedupe returns `{ _empty: true }` sentinel when zero net-new jobs (workflow completes cleanly)
- CV render failure in Tailor should not block scoring (scoring already completed in Workflow 2)
- JobSpy `/batch` catches per-query errors and returns partial results with `error` field per query

## Cross-Cutting Concerns

**Logging:** n8n execution logs per workflow run (clock icon in UI); Python sidecars use `logging` / `log_message` on errors only (`scripts/jobspy_service.py`, `scripts/cv_service.py`).

**Validation:** Profile presence checked at workflow start; AI JSON validated for required `score` field; markdown minimum length (50 chars) in cv-renderer.

**Authentication:** Airtable PAT credential on all Airtable nodes; Header Auth (`Bearer PAT`) for DOCX attachment upload in `03-tailor.json`; Resend API key for email; no end-user auth (single-user personal pipeline).

---

*Architecture analysis: 2026-06-05*
