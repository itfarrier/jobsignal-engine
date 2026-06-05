# Testing Patterns

**Analysis Date:** 2026-06-05

JobSignal Engine has **no automated test suite**. There are no `test_*.py` files, no `*.spec.*` files, no `pytest`/`unittest`/`jest` configuration, and no `.github/workflows` CI pipeline. Validation is **manual**, driven by n8n workflow execution and operator checklists in `docs/`. Be explicit about this when planning changes: regressions are caught by re-running workflows and inspecting Airtable and email output.

---

## Test Framework

**Runner:**
- **Not applicable** — no test runner configured

**Assertion library:**
- **Not applicable**

**Lint/format gates in CI:**
- **Not detected** — `.github/` contains only `.github/ISSUE_TEMPLATE/bug_report.md`

**Run commands (what exists instead):**
```bash
# Sidecar health (self-hosted)
curl -s http://localhost:3457/health   # JobSpy — scripts/jobspy_service.py
curl -s http://localhost:3456/health   # CV renderer — scripts/cv_service.py

# ATS endpoint smoke test (before adding a company)
curl -s "https://boards-api.greenhouse.io/v1/boards/{slug}/jobs" | head -c 200
# See docs/CUSTOMIZATION.md for Ashby and Lever variants

# Build/run sidecars locally (from docs/SETUP.md)
docker build -f scripts/Dockerfile.jobspy -t jobspy-scanner .
docker run -d -p 3457:3457 jobspy-scanner
docker build -f scripts/Dockerfile.cv-renderer -t cv-renderer .
docker run -d -p 3456:3456 cv-renderer

# CV CLI (offline render check)
python3 scripts/render_cv.py input.md output.docx
```

---

## Test File Organization

**Location:**
- **No test directory** — nothing under `tests/`, `__tests__/`, or co-located `*_test.py`

**Naming:**
- **Not applicable**

**Structure:**
```
jobsignal-engine/
├── workflows/          # Exported n8n graphs — tested by manual Execute Workflow
├── scripts/            # Sidecars — tested via curl / docker / CLI
├── docs/SETUP.md       # Primary verification checklist
└── docs/NOTIFICATION-SETUP.md  # Email-specific manual test
```

---

## Test Structure

**Suite organization:**
- N/A — use n8n’s per-workflow execution history as the “test report”

**Patterns operators follow (`docs/SETUP.md` §2.8, “Verifying Your Setup”):**

1. Import workflows in order (`01a` → `01b` → `01c` → `02` → `03` → `04` → `06`; `01d` self-hosted only).
2. Configure Airtable + AI + email credentials.
3. **Before activating schedules**, click **Execute Workflow** on each workflow once.
4. Confirm outcomes in Airtable Pipeline and inbox.

**Documented manual sequence:**

| Step | Action | Expected result |
|------|--------|-----------------|
| Scanner | Execute `01a-scanner-greenhouse.json` | New rows in Pipeline, Status `New` |
| Evaluator | Execute `02-evaluator.json` | Scores, fit tiers, reasoning on `New` jobs |
| Alert | High Fit job exists | Email from evaluator path |
| Digest | Execute `06-alerter.json` | Daily digest email |
| Tailor | Execute `03-tailor.json` (self-hosted) | DOCX in Tailored CV field |
| Housekeeper | Execute `04-housekeeper.json` | Stale-job report / housekeeping actions |

Source: `docs/SETUP.md` (§2.8, §“Verifying Your Setup”), summarized in `README.md` Quickstart (“trigger any workflow manually to test”).

**Email-only test (`docs/NOTIFICATION-SETUP.md`):**
- Execute Workflow **06** (Alerter) after configuring Resend or Gmail
- Expect digest within seconds; check spam on first send

---

## Mocking

**Framework:** None in repo

**Patterns:** N/A

**What to mock (if adding automated tests later):**
- External HTTP: Greenhouse/Ashby/Lever APIs, JobSpy scrape, OpenAI-compatible LLM endpoints, Resend/Gmail
- Airtable REST API

**What NOT to mock (high value integration targets):**
- FNV-1a `jobId` generation and dedupe logic in Code nodes
- AI JSON parse/strip logic in `workflows/02-evaluator.json`
- `scripts/render_cv.py` markdown → DOCX layout (pure Python, good unit-test candidate)

---

## Fixtures and Factories

**Test data:**
- Airtable CSV templates: `airtable/templates/*.csv` — use to bootstrap a test base
- Default companies: `companies-default.csv` — 139 pre-verified endpoints
- Example compose stack: `docker-compose.example.yml` (not a test fixture; deployment template)

**Location:**
- No `fixtures/` or `factories/` directory

**Sample JobSpy request body** (manual POST to `/scan`):
```json
{
  "search_term": "AI engineer",
  "location": "Toronto, Canada",
  "sites": ["indeed", "linkedin"],
  "country_indeed": "Canada",
  "hours_old": 72,
  "results_wanted": 50,
  "source_tag": "Test"
}
```
Documented in `scripts/jobspy_service.py` route docstring.

---

## Coverage

**Requirements:** None enforced

**View coverage:** N/A

**Honest assessment:**
- Python sidecars (`scripts/*.py`): **0%** automated coverage
- n8n workflow logic (embedded JavaScript): **0%** automated coverage
- Documentation checklists: **primary** regression surface for releases

---

## Test Types

**Unit tests:**
- **Not used.** Closest manual unit check: `python3 scripts/render_cv.py <sample.md> <out.docx>` and inspect DOCX.

**Integration tests:**
- **Manual only** — full path is n8n → Airtable → AI provider → optional sidecar HTTP → email
- n8n Cloud path skips `01d` and DOCX upload; test matrix must include deployment mode (see `.github/ISSUE_TEMPLATE/bug_report.md`)

**E2E tests:**
- **Not used** (no Playwright/Cypress, no n8n test harness in repo)
- Production validation described in `README.md` (“Does It Actually Work?”) is anecdotal, not automated

**Workflow JSON “testing”:**
- Workflows are versioned JSON under `workflows/` — changes are validated by importing into n8n and executing
- No snapshot tests for `jsCode` strings

---

## Common Patterns

**Async testing:**
- N/A in code; n8n handles async HTTP/AI nodes — wait for execution status **Success** in UI

**Error testing:**
- Intentional failure paths: run scanner with invalid company endpoint (expect empty or node error in log)
- Safety brake: misconfigure broad keywords to exceed 100 net-new jobs — expect `Safety brake` error in Code node (see scanner dedupe nodes in `workflows/01a-scanner-greenhouse.json`)
- JobSpy batch: POST more than 10 queries — expect `400` from `scripts/jobspy_service.py`

**AI provider testing:**
- `docs/AI-PROVIDERS.md` — provider-specific setup; free-tier rate limits called out in README
- Toggle “Output Content as JSON” per provider quirks (README Gotchas; Gemma/off → prompt-enforced JSON)

**Sidecar testing:**
```bash
curl -s -X POST http://localhost:3457/scan \
  -H 'Content-Type: application/json' \
  -d '{"search_term":"engineer","location":"Remote","sites":["indeed"],"results_wanted":5}'
```
Expect `success: true` and `jobs` array (may be empty depending on live scrape).

```bash
curl -s -X POST http://localhost:3456/render \
  -H 'Content-Type: application/json' \
  -d '{"markdown":"...(50+ chars of CV markdown)...","filename":"test_cv"}'
```
Expect `status: ok` and `docx_base64` (`scripts/cv_service.py`).

---

## CI/CD Testing

**GitHub Actions:**
- **Not detected** — no `.github/workflows/*.yml`

**Pre-commit hooks:**
- **Not detected**

**Release verification (de facto):**
1. Operator runs `docs/SETUP.md` checklist on their deployment
2. Bug reports supply n8n execution logs via `.github/ISSUE_TEMPLATE/bug_report.md`

---

## Deployment-Mode Test Matrix

Use the right subset when validating changes:

| Capability | Self-hosted Docker | n8n Cloud | n8n Desktop |
|------------|-------------------|-----------|-------------|
| `01a`–`01c` scanners | Yes | Yes | Yes |
| `01d` JobSpy | Yes (sidecar) | No | Optional local Docker |
| `03` DOCX tailor | Yes (cv-renderer) | Text only | Optional local Docker |
| Scheduled runs | 24/7 if VPS up | 24/7 | Only while machine awake |

Source: `docs/SETUP.md`, `README.md` Honest Limitations.

---

## Gaps and Recommended Additions (not present today)

If introducing automated tests, highest leverage first:

1. **`scripts/render_cv.py`** — pure functions `parse_markdown`, `is_section_header`, `build_docx` with fixture markdown files
2. **FNV-1a + dedupe** — extract or snapshot-test the inline JS from one scanner workflow
3. **AI JSON parse** — golden-file tests for `Parse AI Response` stripping logic with sample provider payloads
4. **Minimal CI** — `pytest` on `scripts/` only; workflow JSON still manual unless n8n test tooling is adopted

Until then, **always** re-run the `docs/SETUP.md` verification checklist after changing `workflows/` or `scripts/`.

---

## Related Documentation

| Doc | Testing relevance |
|-----|-------------------|
| `docs/SETUP.md` | Main manual test plan, schedule activation |
| `docs/NOTIFICATION-SETUP.md` | Email provider test (Workflow 06) |
| `docs/CUSTOMIZATION.md` | `curl` ATS endpoint verification before adding companies |
| `docs/AI-PROVIDERS.md` | Provider swap regression |
| `README.md` § Gotchas | Known n8n/Airtable failure modes to watch during manual runs |

---

*Testing analysis: 2026-06-05*
