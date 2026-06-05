# Coding Conventions

**Analysis Date:** 2026-06-05

JobSignal Engine is mostly **n8n workflow JSON** (`workflows/*.json`) with **three Python sidecars** (`scripts/`). There is no monorepo TypeScript app, no shared lint config committed to the repo, and no formatter enforced in CI. Conventions are consistent within each layer but differ between Python and n8n Code nodes.

---

## Naming Patterns

**Workflow export files (`workflows/`):**
- Pattern: `{NN}{optional-letter}-{kebab-role}.json`
- Examples: `01a-scanner-greenhouse.json`, `02-evaluator.json`, `06-alerter.json`
- Internal workflow `name` field: `JobSignal - Workflow {id} - {Human Title}` (see `workflows/01a-scanner-greenhouse.json`)

**Python (`scripts/`):**
- Files: `snake_case.py` — `jobspy_service.py`, `cv_service.py`, `render_cv.py`
- Functions: `snake_case` — `run_single_query`, `build_docx`, `_safe_number`
- Private helpers: leading underscore — `_build_location_string`, `_respond`
- Docker images built from `scripts/Dockerfile.jobspy`, `scripts/Dockerfile.cv-renderer`

**n8n node names:**
- Title Case with spaces — `Get Profile`, `Parse & Filter Jobs`, `Loop Over Jobs`
- Match the `name` field when referencing other nodes: `$('Get Profile').first().json`

**JSON payloads produced by scanners (Code nodes):**
- camelCase keys — `jobId`, `jobTitle`, `applyLink`, `discoveryDate`, `sourceTag`
- Sentinel fields prefixed with underscore — `_empty`, `_error`, `_message`, `_company`

**Airtable field names (in expressions and Code nodes):**
- Title Case with spaces, matching the base schema — `'Target Geography'`, `'Job ID'`, `'CV Markdown'`, `'Notification Email'`
- Always use the exact string from `airtable/AIRTABLE-SCHEMA.md` and `docs/AIRTABLE-SCHEMA.md`

**Documentation (`docs/`):**
- UPPERCASE kebab filenames — `SETUP.md`, `AI-PROVIDERS.md`, `NOTIFICATION-SETUP.md`

**Data files:**
- `companies-default.csv` — header row `Company Name,API Endpoint,Scan Method,Category` (see `docs/CUSTOMIZATION.md`)

---

## Code Style

**Formatting (Python):**
- 4-space indentation
- Single-quoted strings common in logging and dict keys in `scripts/jobspy_service.py`
- Module-level docstring at top describing purpose, endpoints, and port
- No `pyproject.toml`, `ruff.toml`, `setup.cfg`, or `.prettierrc` in the repo
- `.gitignore` lists `.ruff_cache/` — Ruff may be used locally but is **not** configured or run in automation

**Formatting (n8n Code nodes):**
- JavaScript embedded in JSON `jsCode` strings
- 2-space indentation inside pasted code (inconsistent with Python)
- Line comments with `//` describing node purpose at the top of each block
- Semicolons used inconsistently; follow the surrounding node when editing

**Linting:**
- **Not detected** — no ESLint, Biome, Ruff config, or GitHub Actions lint job
- Prescriptive rule for contributors: match existing style in the file you touch; do not introduce a new formatter config unless the project adds CI

**Runtime versions (Docker):**
- JobSpy sidecar: `python:3.12-slim` (`scripts/Dockerfile.jobspy`)
- CV renderer: `python:3.12-alpine` (`scripts/Dockerfile.cv-renderer`)

---

## Import Organization

**Python (`scripts/jobspy_service.py`, `scripts/cv_service.py`):**
1. Standard library — `json`, `logging`, `traceback`, `http.server`, `os`, `sys`
2. Third party — `flask`, `docx` (via `render_cv`)
3. Lazy import inside function where expensive — `from jobspy import scrape_jobs` inside `run_single_query()` in `scripts/jobspy_service.py`
4. Local path hack in `cv_service.py`: `sys.path.insert(0, '/opt/jobsignal')` then `from render_cv import parse_markdown, build_docx`

**n8n Code nodes:**
- Do **not** use `require('crypto')` or other blocked Node modules — use inline pure-JS helpers instead (documented in `README.md` Gotchas)
- No ES module `import`/`export`; all logic is inline in `jsCode`

---

## Error Handling

**Python Flask (`scripts/jobspy_service.py`):**
- Validate input early; return `400` with `{'success': False, 'error': '...'}`
- Wrap route handlers in `try/except`; log `traceback.format_exc()`; return `500` with `error` and `traceback` keys on failure
- Per-query failures in `/batch` append `{ error, jobs: [] }` for that query instead of failing the whole batch

**Python stdlib HTTP (`scripts/cv_service.py`):**
- `400` for short/missing markdown
- `500` with `{'error': str(e)}` on render failures
- Override `log_message` to only surface 500s to stderr

**n8n Code nodes:**
- `throw new Error('...')` for missing required context (e.g. company name in `workflows/01a-scanner-greenhouse.json` Parse node)
- Safety brakes via thrown errors — e.g. dedupe cap: `throw new Error(\`Safety brake: ${netNew.length} net-new jobs exceeds 100 limit...\`)` in scanner workflows
- Empty-run sentinels instead of throwing when no jobs match filters — return `[{ json: { _empty: true, ... } }]`

**Airtable / HTTP nodes:**
- `retryOnFail: true`, `maxTries: 2`, `waitBetweenTries: 5000` on external HTTP fetches (pattern in `workflows/01a-scanner-greenhouse.json`)
- `continueOnFail: true` on some HTTP nodes so one company failure does not stop the loop

**AI response parsing (`workflows/02-evaluator.json`, `workflows/03-tailor.json`):**
- `try/catch` around JSON extraction
- Normalize multiple provider shapes (`choices[0].message.content`, `message.content`, `content`, `text`)
- Strip preamble: find first `{` before `JSON.parse`
- Handle thinking tags / markdown fences (see README Gotchas)

---

## Logging

**Python:**
- `logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')` in `scripts/jobspy_service.py`
- `logger.info` for scan parameters and result counts; `logger.error` with stack traces on failures
- `cv_service.py`: minimal logging — `print` on startup; errors via HTTP 500 only

**n8n:**
- No structured logging framework — rely on n8n execution UI (clock icon per workflow)
- Document operational debugging in `docs/SETUP.md` (“check the workflow's execution log”)

---

## Comments

**When to comment (observed practice):**
- First line of each Code node: what the node does in the workflow graph
- Non-obvious business rules: geography maps, FNV-1a dedupe, safety caps
- TODOs for known gaps — e.g. `// TODO: Read from Profile.Target Geography in v1.1` in `workflows/01d-scanner-jobspy.json`

**Python module docstrings:**
- Required at file top — purpose, usage, endpoints, ports (`scripts/jobspy_service.py`, `scripts/render_cv.py`, `scripts/cv_service.py`)

**JSDoc/TSDoc:**
- Not used

---

## Function Design

**Python:**
- Small helpers for repeated transforms — `_build_location_string`, `_safe_number` in `scripts/jobspy_service.py`
- `render_cv.py` uses many `is_*` predicates (`is_section_header`, `is_bullet`) before `build_docx` layout loop
- CLI entry: `if __name__ == '__main__'` runs Flask/HTTPServer or `main()` with `sys.argv` check in `render_cv.py`

**n8n Code nodes:**
- Inline `const fnv1aHash = (str) => { ... }` duplicated across scanner workflows — **copy the existing implementation** when adding a scanner; do not switch to `crypto`
- Shared patterns: `GEO_MAP` + `matchesGeography`, keyword split on comma, `profileData.fields ? profileData.fields['X'] : profileData['X']` for Airtable v1/v2 shape
- Return shape: array of `{ json: { ... } }` items for downstream nodes

**Parameters:**
- HTTP sidecars accept JSON bodies documented in route docstrings (`/scan`, `/batch`, `/render`, `/health`)
- Cap untrusted numeric input — `results_wanted = min(results_wanted, 100)`; max 10 queries per batch in `scripts/jobspy_service.py`

---

## Module Design

**Exports:**
- Python scripts are runnable services or CLI — no package `__init__.py`; not installed as a library
- Workflow JSON is the “module” boundary — import via n8n UI, not code

**Barrel files:**
- None

**Configuration vs code:**
- User-facing behavior is intended to live in **Airtable** (Profile, Tracked Companies, Search Queries) per `docs/CUSTOMIZATION.md` — avoid workflow edits for personalization
- Workflow edits reserved for new scanners, prompt changes, safety limits, and provider quirks

---

## Workflow & Sidecar Conventions

**Scanner family (`01a`–`01d`):**
- Triggers: Manual + Schedule (staggered morning times documented in `docs/SETUP.md`)
- Flow pattern: Get Profile → fetch sources → parse/filter → aggregate → dedupe against Pipeline → create records
- Job ID: FNV-1a hash of `title|company|applyLink` plus short company suffix (see `workflows/01a-scanner-greenhouse.json`)
- Geography: read `Target Geography` from Profile where implemented; JobSpy scanner still has hardcoded geographies with a TODO

**Ports:**
- CV renderer: `3456` (`scripts/cv_service.py`, `PORT` env override)
- JobSpy: `3457` (`scripts/jobspy_service.py`)
- n8n calls sidecars via HTTP Request nodes (self-hosted only)

**Email HTML (workflows `02`, `04`, `06`):**
- Table-based layout, inline styles — Gmail-safe (see `docs/NOTIFICATION-SETUP.md`)

---

## Documentation Conventions

**Setup and verification:**
- Primary operator guide: `docs/SETUP.md`
- Manual test checklist: `docs/SETUP.md` §2.8, §“Verifying Your Setup”
- API probe examples: `curl` one-liners in `docs/CUSTOMIZATION.md`

**GitHub:**
- Single issue template: `.github/ISSUE_TEMPLATE/bug_report.md` — asks deployment mode, workflow id, AI provider, n8n logs

**Contributing data:**
- New companies: PR to `companies-default.csv` with verified endpoint (`docs/CUSTOMIZATION.md`)

---

## Prescriptive Rules for Future Changes

1. **New scanner workflow:** Copy `workflows/01a-scanner-greenhouse.json` structure; keep node naming, `_empty` sentinel, FNV-1a, and dedupe safety brake patterns.
2. **New Python endpoint:** Follow Flask patterns in `scripts/jobspy_service.py` (`success` boolean, `count`, structured errors).
3. **Airtable writes:** Use field names exactly as in schema docs; prefer long text over multi-select for AI-generated lists (README Gotchas).
4. **Do not add `require('crypto')`** in Code nodes.
5. **Do not parallelize multiple branches into one Code node** that reads `$('Node')` — chain sequentially (Housekeeper lesson in README).
6. **Personalization:** Document Airtable field changes in `docs/CUSTOMIZATION.md` rather than hardcoding in Code when possible.

---

*Convention analysis: 2026-06-05*
