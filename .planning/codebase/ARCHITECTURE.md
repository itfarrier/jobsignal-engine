<!-- refreshed: 2026-06-09 -->
# Architecture

**Analysis Date:** 2026-06-09

## System Overview

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                        AIRTABLE (Source of Truth)                          │
│                                                                             │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌───────────────────────┐  │
│  │ Profile  │  │   Tracked    │  │ Pipeline │  │   Search Queries      │  │
│  │ (1 row)  │  │  Companies   │  │ (grows)  │  │  (JobSpy config)      │  │
│  └──────────┘  └──────┬───────┘  └────┬─────┘  └───────────────────────┘  │
└────────────────────────┼───────────────┼───────────────────────────────────┘
                         │               │
         ┌───────────────┼───────────────┼───────────────────┐
         │               │               │                   │
         ▼               ▼               ▼                   ▼
┌────────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────────┐
│ Wf 1a: Scan    │ │ Wf 1b:    │ │ Wf 1c:    │ │ Wf 1d: Scan       │
│ Greenhouse     │ │ Scan      │ │ Scan      │ │ JobSpy Sidecar     │
│ (HTTP API)     │ │ Ashby     │ │ Lever     │ │ (Python/Flask)     │
│ 8:00 AM        │ │ 8:05 AM   │ │ 8:10 AM   │ │ 8:15 AM            │
└───────┬────────┘ └─────┬─────┘ └──────┬────┘ └────────┬───────────┘
        │                │              │                │
        └────────────────┼──────────────┼────────────────┘
                         ▼              ▼
               ┌────────────────────────────┐
               │    PIPELINE TABLE           │
               │    (New jobs inserted)      │
               └─────────────┬──────────────┘
                             │
                             ▼
               ┌────────────────────────────┐
               │   Wf 2: Evaluator          │  ← 9:00 AM
               │   ┌─────────────────────┐  │
               │   │ AI Scoring (1-10)   │──┤── High Fit? ──► Email Alert
               │   │ Interview Prep      │  │          + 15 Q + 5 STAR
               │   │ (15 Q + 5 STAR)     │  │
               │   └─────────────────────┘  │
               └─────────────┬──────────────┘
                             │
                             ▼
               ┌────────────────────────────┐
               │   Wf 3: Tailor             │  ← 9:30 AM
               │   ┌─────────────────────┐  │
               │   │ AI rewrites CV      │──┤──► DOCX via cv-renderer
               │   │ Python sidecar      │  │    sidecar (port 3456)
               │   │ Uploads to Airtable  │  │
               │   └─────────────────────┘  │
               └─────────────┬──────────────┘
                             │
               ┌─────────────┴──────────────┐
               │                            │
               ▼                            ▼
┌────────────────────────┐    ┌────────────────────────┐
│ Wf 4: Housekeeper      │    │ Wf 6: Alerter          │
│ Sunday midnight        │    │ 6:00 PM                │
│ ┌────────────────┐     │    │ ┌────────────────┐     │
│ │Archive stale   │     │    │ │Daily digest    │     │
│ │Close ghosted   │     │    │ │email with      │     │
│ │Alert stuck     │     │    │ │pipeline stats  │     │
│ └────────────────┘     │    │ └────────────────┘     │
└────────────────────────┘    └────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Greenhouse Scanner | Fetch jobs from Greenhouse API career pages, deduplicate, insert into Pipeline | `workflows/01a-scanner-greenhouse.json` |
| Ashby Scanner | Fetch jobs from Ashby API career pages, deduplicate, insert into Pipeline | `workflows/01b-scanner-ashby.json` |
| Lever Scanner | Fetch jobs from Lever API career pages, deduplicate, insert into Pipeline | `workflows/01c-scanner-lever.json` |
| JobSpy Scanner | Scrape LinkedIn/Indeed via Python sidecar, insert into Pipeline | `workflows/01d-scanner-jobspy.json` |
| Evaluator | AI-fit scoring, interview prep generation, high-fit email alerts | `workflows/02-evaluator.json` |
| Tailor | AI-driven CV rewriting per job, DOCX generation via sidecar | `workflows/03-tailor.json` |
| Housekeeper | Auto-archive stale low-fit jobs, close ghosted applications, alert stuck items | `workflows/04-housekeeper.json` |
| Alerter | Daily digest email with pipeline statistics | `workflows/06-alerter.json` |
| Airtable | Central database — Profile, Tracked Companies, Pipeline, Search Queries tables | `airtable/AIRTABLE-SCHEMA.md` |
| CV Renderer | HTTP service converting markdown CV to DOCX | `scripts/cv_service.py`, `scripts/render_cv.py` |
| JobSpy Service | Flask HTTP service for LinkedIn/Indeed scraping | `scripts/jobspy_service.py` |

## Pattern Overview

**Overall:** [Pipeline orchestration pattern] — A set of scheduled, sequentially-timed n8n workflows that read from and write to a shared Airtable database (source of truth). Each workflow is a self-contained pipeline stage with a single responsibility. Workflows are loosely coupled through the database rather than direct chaining.

**Key Characteristics:**
- **Database-as-integration-layer**: All workflows read/write through Airtable; no direct workflow-to-workflow calls
- **Scheduled sequential timing**: Workflows run at staggered times (8:00, 8:05, 8:10, 8:15 → 9:00 → 9:30 → 18:00) rather than being event-chained
- **Polling-based triggers**: Each workflow polls Airtable for records matching its stage criteria (e.g., Status='New', Status='Evaluated')
- **Docker sidecar pattern**: Python services run as isolated containers alongside n8n, called via HTTP
- **Provider-agnostic AI**: All AI nodes use the OpenAI-compatible API format — switching providers means changing one credential
- **Graceful degradation**: Failures in downstream stages (CV generation, notifications) never block upstream stages (scoring)

## Layers

**Database Layer (Airtable):**
- Purpose: Single source of truth for all pipeline state, profile data, and job records
- Location: `airtable/` directory (schema docs and CSV templates)
- Contains: Schema definitions (`AIRTABLE-SCHEMA.md`), CSV import templates (`airtable/templates/`)
- Depends on: Nothing
- Used by: All 7 workflows, user manual operations

**Orchestration Layer (n8n Workflows):**
- Purpose: Scheduled pipeline execution — scanning, evaluation, tailoring, housekeeping, alerting
- Location: `workflows/`
- Contains: 8 n8n workflow JSON files (numbered 01a through 06)
- Depends on: Airtable (read/write), AI provider (HTTP), Python sidecars (HTTP)
- Used by: The end user (receives email alerts and digests)

**AI Layer (OpenAI-compatible API):**
- Purpose: Job scoring, interview question generation, STAR response generation, CV tailoring
- Location: Embedded in workflow JSON nodes (`workflows/02-evaluator.json`, `workflows/03-tailor.json`)
- Contains: LangChain OpenAI nodes with scoring/interview/tailoring prompts
- Depends on: Profile data from Airtable (injected into prompts)
- Used by: Workflow 2 (Evaluator), Workflow 3 (Tailor)

**Sidecar Layer (Python Services):**
- Purpose: CV rendering (markdown → DOCX) and job scraping (LinkedIn/Indeed via JobSpy)
- Location: `scripts/`
- Contains: Flask/HTTP services (`cv_service.py`, `jobspy_service.py`), DOCX builder (`render_cv.py`), Dockerfiles
- Depends on: n8n HTTP requests (caller)
- Used by: Workflow 3 (Tailor for CV render), Workflow 1d (Scanner for JobSpy)

**Infrastructure Layer (Docker):**
- Purpose: Container orchestration, persistence, reverse proxy
- Location: `docker-compose.example.yml`
- Contains: n8n, PostgreSQL, Caddy, cv-renderer, jobspy-scanner
- Depends on: Host system (VPS, local machine, or cloud)

## Data Flow

### Primary Request Path — A job's journey through the pipeline

1. **Discovery (8:00-8:15 AM)** — Scanner workflows pull jobs from Greenhouse/Ashby/Lever APIs and JobSpy sidecar, deduplicate via FNV-1a hash, insert into Pipeline with Status="New" (`workflows/01a-scanner-greenhouse.json`, `workflows/01d-scanner-jobspy.json`)
2. **Evaluation (9:00 AM)** — Evaluator fetches Profile from Airtable (once), builds scoring prompt per job, sends to AI, parses JSON response, updates Pipeline with score/fit-tier/reasoning/skills. For High Fit: triggers interview prep (AI → 15 questions + 5 STAR) and sends email alert (`workflows/02-evaluator.json`)
3. **CV Tailoring (9:30 AM)** — Tailor polls for Evaluated+High Fit jobs without tailored CVs, sends JD + Profile to AI for rewriting, stores markdown CV, sends to cv-renderer sidecar for DOCX conversion, uploads DOCX to Airtable attachment (`workflows/03-tailor.json`)
4. **Daily Digest (6:00 PM)** — Alerter queries today's new jobs, high-fit jobs awaiting review, and pipeline stats, builds email HTML, sends via SMTP/HTTP (`workflows/06-alerter.json`)
5. **Housekeeping (Sunday midnight)** — Housekeeper batches three queries: archive stale Low-Fit (>7d), close ghosted Applied (>30d no response), alert stuck New (>3d). Updates each batch in Airtable (`workflows/04-housekeeper.json`)

### State Management

- **Persistence**: All state is in Airtable's Pipeline table — job lifecycle is tracked via Status field (New → Evaluated → Applied → Interview → Offer → Rejected → Archived)
- **Deduplication**: FNV-1a hash of title+company+apply link computed in Code nodes
- **Concurrency**: No locking mechanism — n8n's sequential processing and staggered schedules prevent races. The Evaluator processes jobs one-at-a-time via `splitInBatches` with a batch size of 5
- **Cost tracking**: Every AI call logs exact token cost to Pipeline record fields (AI Evaluation Cost, CV Tailoring Cost, Interview Prep Cost)

## Key Abstractions

**Pipeline Record (Job):**
- Purpose: Represents a single job listing at any stage of the pipeline lifecycle
- Schema: Defined in `airtable/AIRTABLE-SCHEMA.md` (Pipeline table, 27 fields)
- Key fields: Job ID (FNV-1a hash), Status, Fit Score, Fit Tier, Tailored CV Text, Interview Questions, STAR Responses
- Pattern: State machine (Status transitions: New → Evaluated → Applied → Interview → Offer/Rejected/Archived)

**Flow Control (splitInBatches):**
- Purpose: n8n's loop construct — iterates over items from the previous node
- Location: All scanner workflows, Evaluator, Tailor
- Pattern: Used to process one company or job at a time (avoiding Airtable rate limits)
- Safety: Results capped at 100-200 items per loop iteration

**FNV-1a Deduplication Hash:**
- Purpose: Pure-JS hash to detect duplicate job listings across multiple scanners
- Location: Code nodes in `workflows/01a-scanner-greenhouse.json` and each scanner (line ~150 onward)
- Pattern: `hash('fnv1a', title + company + applyLink.toLowerCase())` — n8n's `require('crypto')` is blocked in Code nodes
- Use case: Same job posted on Greenhouse and Ashby should produce one Pipeline record

**Scoring Prompt (System Prompt + Job Injection):**
- Purpose: Dynamic AI scoring prompt built from Profile data + job listing
- Location: Code node "Build Scoring Prompt" in `workflows/02-evaluator.json`
- Pattern: Constructs a system prompt with candidate profile fields, scoring rubric (5 weighted criteria), and negative filter instructions. Each job's title/company/location/description is appended to the user message

## Entry Points

**Schedule Triggers:**
- Location: Every workflow JSON has a `ScheduleTrigger` node
- Triggers: Cron-like schedule (daily at specific hours, weekly on Sunday)
- Responsibilities: Start each workflow at its designated time

**Manual Triggers:**
- Location: Every workflow JSON has a `ManualTrigger` node
- Triggers: User clicks "Execute Workflow" in n8n UI
- Responsibilities: Allow on-demand execution for testing

**HTTP Endpoints (Sidecars):**
- Location: `scripts/cv_service.py` (port 3456), `scripts/jobspy_service.py` (port 3457)
- Endpoints: POST `/render` (CV), POST `/scan` (JobSpy), POST `/batch` (JobSpy batch), GET `/health` (both)
- Responsibilities: Convert markdown to DOCX, execute job scraping queries

## Architectural Constraints

- **Threading:** Single-threaded per n8n workflow execution — n8n's event loop processes nodes sequentially. SplitInBatches provides pseudo-looping. Python sidecars are single-threaded Flask/HTTP servers
- **Global state:** Airtable is the only shared state — no in-memory caching, no shared variables across workflows. Each workflow re-fetches Profile and Pipeline data on every run
- **Circular imports:** None — the architecture is strictly DAG-like (scanners → evaluator → tailor → alerter, with housekeeper as a parallel maintenance path). No cycles
- **API rate limits:** AI provider rate limits constrain batch sizes (Evaluator cap: 5 jobs/run, Scanner loop cap: 100-200 results, JobSpy batch cap: 10 queries). Retry logic (3 attempts, 5s intervals) on all Airtable writes
- **Sidecar availability:** Self-hosted only — n8n Cloud cannot reach Docker sidecars. CV tailoring on cloud falls back to text-only (no DOCX)
- **FNV-1a collisions:** Pure-JS hash used because `require('crypto')` is blocked in n8n Code nodes. Low collision probability but no collision handling

## Anti-Patterns

### Pipeline Clock Drift

**What happens:** Workflows are scheduled at fixed times (8:00, 9:00, 9:30) with no explicit completion dependency. If the scanner workflows run long, the Evaluator may start before new jobs are inserted.
**Why it's wrong:** Creates race conditions where jobs from one scanner are missed for a day.
**Do this instead:** Add a 15-minute buffer between dependent schedules (already partially mitigated — scanners finish by 8:15, evaluator starts at 9:00). Consider using n8n workflow-to-workflow linking or a "ready" flag in Airtable.

### Sequential Airtable Queries Instead of Parallel

**What happens:** The Housekeeper runs three sequential Airtable queries (stale low-fit, ghosted applications, stuck new) rather than fanning out. This is by design per known n8n limitation (`"node hasn't been executed"` error when fanning into a single Code node).
**Why it's wrong:** Slower execution time for maintenance tasks.
**Do this instead:** Acceptable trade-off given n8n's constraint. Documented in README gotchas section (`workflows/04-housekeeper.json`).

### Profile Re-fetch Per Workflow Run

**What happens:** Every workflow fetches the Profile row from Airtable even when running multiple jobs. Only the Evaluator reuses the fetched Profile across a batch.
**Why it's wrong:** Unnecessary Airtable API calls for workflows that could cache the Profile.
**Do this instead:** Acceptable for a single-row query — Profile is fetched once per workflow run, not per job. Airtable free tier handles this without issue.

## Error Handling

**Strategy:** Defensive with retries — each Airtable write node has 3 retry attempts at 5-second intervals. Code nodes validate AI response structure before writing. Scanners cap results to prevent runaway execution.

**Patterns:**
- **JSON extraction from AI responses**: Code nodes strip `<thought>` tags, markdown fences, and preamble text before JSON parsing (handles both OpenAI and open-source model quirks)
- **Graceful degradation**: CV generation failure never blocks job scoring (Tailor polls separately from Evaluator). Notification failure never blocks job processing
- **Safety brakes**: Scanner loops cap at 100-200 results. JobSpy batch capped at 10 queries. Airtable writes use `splitInBatches` to avoid rate limits
- **Empty state handling**: Code nodes check for empty Airtable results and return early with no-ops rather than throwing errors

## Cross-Cutting Concerns

**Logging:** Each workflow execution is logged in n8n's execution history. Python sidecars use Python's `logging` module with INFO level. Error logs include traceback for debugging. No centralized log aggregation.
**Validation:** Airtable fields provide basic type validation (Number, Date, Single select). Workflows validate AI response structure in Code nodes (required fields like `score`, fit validation). Scanner workflows validate API response structure.
**Authentication:** n8n stores credentials (Airtable PAT, OpenAI API key) in its internal database. No additional auth layer between workflows and sidecars (internal Docker network). Sidecars have no auth on their HTTP endpoints.

---

*Architecture analysis: 2026-06-09*
