<!-- GSD:project-start source:PROJECT.md -->

## Project

**JobSignal Engine**

An autonomous job search pipeline that scans 139+ company career pages daily, AI-scores every role against your profile (1-10), generates tailored CVs as DOCX files, preps interview questions and STAR responses, and emails you daily digests — all running unattended on a schedule via n8n workflows with Airtable as the source of truth.

Currently being migrated from Airtable to NocoDB as the backend database, eliminating the external dependency on Airtable's free-tier record limits and enabling fully self-hosted operation.

**Core Value:** Discover, score, and prep every relevant job opportunity without manual effort — so the user only needs to review and apply.

### Constraints

- **Backend**: NocoDB will run alongside existing Docker Compose stack with its own PostgreSQL database (separate from n8n's Postgres)
- **Attachments**: Use NocoDB's native storage (local Docker volume) — no MinIO/S3 required for single-node deployment
- **Migration**: Cutover approach — set up NocoDB, import data, update workflows, remove Airtable
- **Compatibility**: All 8 workflows must produce identical output after migration (same job scoring, same CV generation, same alerts)

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- JavaScript (ES2020+) — Used in n8n Code nodes for all workflow logic: job parsing, deduplication (FNV-1a hashing), prompt building, Airtable data transformation, AI response parsing, cost calculation. See `workflows/*.json` for all Code node implementations.
- Python 3.12 — Used for Docker sidecar services: CV rendering (`scripts/cv_service.py`, `scripts/render_cv.py`) and JobSpy scraping (`scripts/jobspy_service.py`).

## Runtime

- n8n (self-hosted via Docker, or n8n Cloud, or n8n Desktop) — The workflow orchestration engine. All business logic lives in n8n workflow JSON files under `workflows/`. No separate application server.
- Python 3.12-alpine (CV renderer sidecar) — `scripts/Dockerfile.cv-renderer`
- Python 3.12-slim (JobSpy scanner sidecar) — `scripts/Dockerfile.jobspy`
- pip — Python dependencies for sidecars
- Lockfile: Not detected (no `requirements.lock` or similar)
- No Node.js package manager — n8n is the runtime; no `package.json` in this repo

## Frameworks

- [n8n](https://n8n.io) (self-hosted or cloud) — Workflow automation engine. All 8 workflows (scanners, evaluator, tailor, housekeeper, alerter) are n8n-native JSON definitions. Runtime provided by the `docker.n8n.io/n8nio/n8n` Docker image.
- Model used: `n8nio/n8n` (latest) — configured in `docker-compose.example.yml`
- Not detected — No test framework, test files, or test configurations found
- Docker / Docker Compose — Local development and deployment via `docker-compose.example.yml`

## Key Dependencies

- `python-jobspy` — Scrapes LinkedIn and Indeed. Used by `scripts/jobspy_service.py`. Only relevant for self-hosted deployments with the JobSpy sidecar. Upstream stability depends on LinkedIn/Indeed HTML structure.
- `python-docx` — Generates DOCX files from markdown CVs. Used by `scripts/render_cv.py` and `cv_service.py`. Self-hosted sidecar.
- `flask` — HTTP server for jobspy_service.py CV rendering and scanning endpoints.
- `Caddy` (latest) — Reverse proxy (TLS termination, domain routing). Configured in `docker-compose.example.yml` but `Caddyfile` is in `.gitignore` / not in repo.
- `postgres:16-alpine` — n8n persistence database. Not used by JobSignal business logic — n8n stores its own workflow state here.
- Resend (HTTP API) — Email sending. Pre-wired in n8n nodes. Free tier: 100 emails/day.
- Airtable (Personal Access Token auth) — Source of truth database. All 8 workflows read/write Airtable.

## Configuration

- No `.env` file detected — configuration is managed through n8n credential store and Docker Compose environment variables.
- `docker-compose.example.yml` defines required environment variables for n8n:
- `docker-compose.example.yml` — Full stack definition (Caddy, n8n, PostgreSQL, CV renderer, JobSpy scanner)
- `scripts/Dockerfile.cv-renderer` — Python 3.12-alpine image, installs python-docx
- `scripts/Dockerfile.jobspy` — Python 3.12-slim image, installs flask + python-jobspy

## Platform Requirements

- Docker Desktop or Docker Engine
- An Airtable account (free tier)
- An n8n instance (self-hosted Docker, n8n Cloud, or n8n Desktop)
- An AI provider API key (Google AI Studio for free tier, or OpenAI/OpenRouter/LM Studio/Ollama)
- 16GB RAM recommended if running local AI (LM Studio with 8B+ models)
- VPS with 2GB+ RAM for self-hosted full stack (recommended: DigitalOcean $12/mo droplet)
- 1GB minimum for core stack without sidecars
- Ports: 80/443 (Caddy), 5678 (n8n), 3456 (CV renderer), 3457 (JobSpy scanner)
- SMTP ports (465, 587) blocked on DigitalOcean by default — must use Resend or request SMTP unblock
- No CI pipeline detected — `.github/` only contains an issue template

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Overview

## Naming Patterns

- Pattern: `{NN}{letter}-{name}.json` (e.g., `01a-scanner-greenhouse.json`, `02-evaluator.json`)
- Files are zero-padded numbers for ordering by execution sequence
- Letter suffix denotes parallel variants (1a, 1b, 1c, 1d = parallel scanners)
- Pattern: `JobSignal - Workflow {N} - {Name}` (e.g., `"JobSignal - Workflow 1a - Scanner (Greenhouse)"`)
- Consistent prefix `JobSignal - Workflow {N}` across all 8 workflows
- PascalCase with spaces, descriptive: `Parse & Filter Jobs`, `Build Scoring Prompt`, `Deduplicate vs Pipeline`
- Nodes doing the same function across different scan workflows use identical names (e.g., `Parse & Filter Jobs` appears in all 4 scanner workflows)
- `snake_case` for function names (e.g., `parse_markdown`, `run_single_query`, `is_section_header`)
- Private/helper functions prefixed with `_` (e.g., `_respond`, `_build_location_string`, `_safe_number`)
- Verb-noun pattern: `build_docx`, `get_bullet_text`, `parse_markdown`
- `snake_case` for local variables (e.g., `search_term`, `results_wanted`, `tmp_path`)
- Descriptive, not abbreviated (e.g., `linkedin_fetch_description`, not `lkd_fetch_desc`)
- `camelCase` for variables (e.g., `const apiResponse`, `const userGeographies`, `const recordId`)
- Single-letter variables limited to loop counters (`i`) and map callbacks
- `PascalCase` (e.g., `CVHandler(BaseHTTPRequestHandler)`)

## Code Style

- No automated formatter detected — no `.prettierrc`, `ruff.toml`, `biome.json`, or `setup.cfg` found
- Python: 4-space indentation (PEP 8 convention, implicit)
- n8n JavaScript: 2-space indentation inside Code node `"jsCode"` strings in JSON
- Maximum line length of ~100 characters in Python scripts, unbounded in n8n JSON (some lines exceed 2000 chars)
- No linter detected — no `.eslintrc`, `ruff.toml`, `pylintrc`, or `flake8` configuration
- `.gitignore` has `.ruff_cache/` entry, suggesting Ruff was used historically but no config is committed
- Module-level docstrings with triple quotes describing purpose, usage, and endpoints
- Imports at top: standard library first, then third-party packages
- Constants (or near-constants) declared as module-level variables
- JavaScript code is embedded as JSON string values under the `"jsCode"` key in each Code node
- Uses `const` exclusively for variable declarations (no `let` or `var`)
- Arrow functions for array methods: `.filter()`, `.map()`, `.forEach()`
- Template literals (backtick strings) for building prompts with interpolation
- Comments use `//` single-line style at top of the code block

## Import Organization

- No import/export system — n8n Code nodes run in an isolated sandbox
- Access other nodes' data via `$('NodeName')` API: `$('Get Profile').first().json`, `$('Loop Over Jobs').item.json`

## Error Handling

- HTTP status codes used correctly (200 success, 400 bad request, 404 not found, 500 server error)
- Input validation: check for `Content-Length`, validate markdown length ≥ 50 chars
- Errors caught broadly (`except Exception`) but return meaningful messages
- Cleanup is handled (files deleted with `os.remove()` in `finally`-like pattern)
- Consistent response pattern: `{'success': bool, ...}` with HTTP status codes
- Input validation before processing
- Logging errors before returning
- Traceback included in error responses for debugging
- Safety brakes: `results_wanted = min(results_wanted, 100)`, batch size ≤ 10
- Early validation with descriptive `throw new Error()` messages
- JSON parse errors caught with descriptive content preview:
- n8n AI nodes configured with `retryOnFail: true`, `maxTries: 3`, `waitBetweenTries: 5000`
- Safety brake pattern for anomaly detection:
- Graceful degradation: interview prep failures store error message instead of crashing:

## Logging

- Standard `logging` module with timestamped format
- INFO level for operational messages (scan progress, result counts)
- ERROR level for failures (with traceback)
- Minimal logging: overrides `log_message()` to only log 500 errors:
- No additional logging framework used
- No explicit logging within Code nodes — n8n handles execution logging natively via its UI
- AirTable writes serve as the persistence/log of all actions

## Comments

- Every n8n Code node starts with a `//` comment explaining what it does (one line)
- Every Python script has a module-level docstring explaining purpose, usage, and API
- Every Python function has a docstring explaining intent
- Complex regex patterns have inline comments
- Markdown formatting pipelines have comments explaining each step
- Not used (no TypeScript in the codebase)
- Triple-quoted strings, sentence case, first line is a summary
- Multi-line docstrings used on module level and complex functions

## Function Design

- Python functions range from ~15 lines (helpers) to ~340 lines (`build_docx` in `render_cv.py`)
- n8n Code node functions range from ~30 lines (simple transforms) to ~200+ lines (complex prompt builders)
- `build_docx()` at 341 lines is the largest single function — it manages a state-machine-driven DOCX generator
- Python: typed but not with full type hints — e.g., `def is_section_header(line):` (no `-> bool`)
- n8n JavaScript: no parameter passing between Code nodes — data flows via `$json`, `$('NodeName').item.json`, `$input.first().json`
- Python: consistent return types (lists return `[]` for empty, dicts for single results)
- n8n JavaScript: returns an array of `{ json: {...} }` objects (n8n item format)
- Error responses return structured JSON with `error` key and HTTP status codes

## Module Design

- Python: no explicit `__all__` exports. Modules expose functions that are imported directly: `from render_cv import parse_markdown, build_docx`
- n8n: no module system — each Code node is self-contained
- Not used (only 3 Python scripts, no packages)
- `render_cv.py` — pure CV markdown parsing and DOCX generation (importable library)
- `cv_service.py` — HTTP wrapper around `render_cv.py` (server layer)
- `jobspy_service.py` — HTTP service for JobSpy job scraping (self-contained, Flask)

## Dockerfile Conventions

- `python:3.12-alpine` for CV renderer (smaller image, runs `python-docx`)
- `python:3.12-slim` for JobSpy scanner (needs more compat for scraping dependencies)
- `postgres:16-alpine` for n8n database
- `caddy:latest` for reverse proxy
- Single-stage builds (no multi-stage)
- Consistent `WORKDIR /opt/jobsignal`
- Port 3456 for CV, 3457 for JobSpy
- `--no-cache-dir` for pip installs

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

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

- **Database-as-integration-layer**: All workflows read/write through Airtable; no direct workflow-to-workflow calls
- **Scheduled sequential timing**: Workflows run at staggered times (8:00, 8:05, 8:10, 8:15 → 9:00 → 9:30 → 18:00) rather than being event-chained
- **Polling-based triggers**: Each workflow polls Airtable for records matching its stage criteria (e.g., Status='New', Status='Evaluated')
- **Docker sidecar pattern**: Python services run as isolated containers alongside n8n, called via HTTP
- **Provider-agnostic AI**: All AI nodes use the OpenAI-compatible API format — switching providers means changing one credential
- **Graceful degradation**: Failures in downstream stages (CV generation, notifications) never block upstream stages (scoring)

## Layers

- Purpose: Single source of truth for all pipeline state, profile data, and job records
- Location: `airtable/` directory (schema docs and CSV templates)
- Contains: Schema definitions (`AIRTABLE-SCHEMA.md`), CSV import templates (`airtable/templates/`)
- Depends on: Nothing
- Used by: All 7 workflows, user manual operations
- Purpose: Scheduled pipeline execution — scanning, evaluation, tailoring, housekeeping, alerting
- Location: `workflows/`
- Contains: 8 n8n workflow JSON files (numbered 01a through 06)
- Depends on: Airtable (read/write), AI provider (HTTP), Python sidecars (HTTP)
- Used by: The end user (receives email alerts and digests)
- Purpose: Job scoring, interview question generation, STAR response generation, CV tailoring
- Location: Embedded in workflow JSON nodes (`workflows/02-evaluator.json`, `workflows/03-tailor.json`)
- Contains: LangChain OpenAI nodes with scoring/interview/tailoring prompts
- Depends on: Profile data from Airtable (injected into prompts)
- Used by: Workflow 2 (Evaluator), Workflow 3 (Tailor)
- Purpose: CV rendering (markdown → DOCX) and job scraping (LinkedIn/Indeed via JobSpy)
- Location: `scripts/`
- Contains: Flask/HTTP services (`cv_service.py`, `jobspy_service.py`), DOCX builder (`render_cv.py`), Dockerfiles
- Depends on: n8n HTTP requests (caller)
- Used by: Workflow 3 (Tailor for CV render), Workflow 1d (Scanner for JobSpy)
- Purpose: Container orchestration, persistence, reverse proxy
- Location: `docker-compose.example.yml`
- Contains: n8n, PostgreSQL, Caddy, cv-renderer, jobspy-scanner
- Depends on: Host system (VPS, local machine, or cloud)

## Data Flow

### Primary Request Path — A job's journey through the pipeline

### State Management

- **Persistence**: All state is in Airtable's Pipeline table — job lifecycle is tracked via Status field (New → Evaluated → Applied → Interview → Offer → Rejected → Archived)
- **Deduplication**: FNV-1a hash of title+company+apply link computed in Code nodes
- **Concurrency**: No locking mechanism — n8n's sequential processing and staggered schedules prevent races. The Evaluator processes jobs one-at-a-time via `splitInBatches` with a batch size of 5
- **Cost tracking**: Every AI call logs exact token cost to Pipeline record fields (AI Evaluation Cost, CV Tailoring Cost, Interview Prep Cost)

## Key Abstractions

- Purpose: Represents a single job listing at any stage of the pipeline lifecycle
- Schema: Defined in `airtable/AIRTABLE-SCHEMA.md` (Pipeline table, 27 fields)
- Key fields: Job ID (FNV-1a hash), Status, Fit Score, Fit Tier, Tailored CV Text, Interview Questions, STAR Responses
- Pattern: State machine (Status transitions: New → Evaluated → Applied → Interview → Offer/Rejected/Archived)
- Purpose: n8n's loop construct — iterates over items from the previous node
- Location: All scanner workflows, Evaluator, Tailor
- Pattern: Used to process one company or job at a time (avoiding Airtable rate limits)
- Safety: Results capped at 100-200 items per loop iteration
- Purpose: Pure-JS hash to detect duplicate job listings across multiple scanners
- Location: Code nodes in `workflows/01a-scanner-greenhouse.json` and each scanner (line ~150 onward)
- Pattern: `hash('fnv1a', title + company + applyLink.toLowerCase())` — n8n's `require('crypto')` is blocked in Code nodes
- Use case: Same job posted on Greenhouse and Ashby should produce one Pipeline record
- Purpose: Dynamic AI scoring prompt built from Profile data + job listing
- Location: Code node "Build Scoring Prompt" in `workflows/02-evaluator.json`
- Pattern: Constructs a system prompt with candidate profile fields, scoring rubric (5 weighted criteria), and negative filter instructions. Each job's title/company/location/description is appended to the user message

## Entry Points

- Location: Every workflow JSON has a `ScheduleTrigger` node
- Triggers: Cron-like schedule (daily at specific hours, weekly on Sunday)
- Responsibilities: Start each workflow at its designated time
- Location: Every workflow JSON has a `ManualTrigger` node
- Triggers: User clicks "Execute Workflow" in n8n UI
- Responsibilities: Allow on-demand execution for testing
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

### Sequential Airtable Queries Instead of Parallel

### Profile Re-fetch Per Workflow Run

## Error Handling

- **JSON extraction from AI responses**: Code nodes strip `<thought>` tags, markdown fences, and preamble text before JSON parsing (handles both OpenAI and open-source model quirks)
- **Graceful degradation**: CV generation failure never blocks job scoring (Tailor polls separately from Evaluator). Notification failure never blocks job processing
- **Safety brakes**: Scanner loops cap at 100-200 results. JobSpy batch capped at 10 queries. Airtable writes use `splitInBatches` to avoid rate limits
- **Empty state handling**: Code nodes check for empty Airtable results and return early with no-ops rather than throwing errors

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
