# Testing Patterns

**Analysis Date:** 2026-06-09

## Test Framework

**Status: No testing framework detected.**

- No `pytest.ini`, `jest.config.*`, `vitest.config.*`, or any test configuration file found
- No `conftest.py`, `__init__.py`, or test utility modules
- No `Makefile`, `tox.ini`, `setup.cfg`, or `pyproject.toml` with test configuration
- No `.github/workflows/` directory (no CI pipeline)
- No pre-commit hooks (no `.pre-commit-config.yaml`)
- No linting configuration (no `.eslintrc`, `ruff.toml`, `.prettierrc`, `biome.json`, `flake8`, `pylintrc`)

## Run Commands

**No test commands available.** No test scripts defined in any project configuration file.

The codebase has no `package.json`, `requirements-dev.txt`, or CI configuration that defines test execution.

## Test File Organization

**No test files exist.** The repository has zero files matching these patterns:
- `test_*.py`
- `*_test.py`
- `*.test.*`
- `*.spec.*`
- `__init__.py`
- `conftest.py`

## Test Structure

Not applicable — no test suites exist.

## Mocking

**No mocking framework detected.** No `unittest.mock`, `pytest-mock`, `jest.mock`, or `vi.mock` usage.

**What would need mocking:**
- For `render_cv.py`: the `python-docx` library (`Document`, `Pt`, `Inches`) would need to be mocked or use in-memory file output
- For `cv_service.py`: the HTTP request/response cycle and file I/O
- For `jobspy_service.py`: the `jobspy.scrape_jobs()` call (external API), HTTP requests/responses
- For n8n workflows: the `$input`, `$('NodeName')`, `$json` n8n runtime API, Airtable HTTP calls, OpenAI API calls

## Fixtures and Factories

Not applicable — no test fixtures exist.

**Input data that would benefit from fixtures:**
- CV markdown samples (various formats) for `render_cv.py` parsing tests
- JobSpy DataFrame outputs (mocked) for JSON serialization tests
- Sample Airtable record structures for n8n Code node testing
- AI response JSON samples (valid, malformed, with thinking tags)

## Coverage

**No coverage enforced or measured.** No `.coveragerc`, `coverage.py`, `nyc`, or `istanbul` configuration found.

**Areas most critical to cover:**
| Component | File(s) | Why |
|-----------|---------|-----|
| CV markdown parser | `scripts/render_cv.py` | Complex regex and state-machine logic; section detection, bullet parsing, skill line detection |
| DOCX builder | `scripts/render_cv.py` `build_docx()` | 341-line state machine; governs CV output quality |
| Job deduplication | All scanner workflows | FNV-1a hashing, set-based dedup; data integrity critical |
| AI response parsing | `workflows/02-evaluator.json` | Handles multiple AI response formats, thinking-tag stripping, JSON extraction |
| Scoring prompt builder | `workflows/02-evaluator.json` | Template injection safety, field formatting |
| Safety brakes | All scanner workflows | Capacity caps (100 jobs/run, 10 queries/batch); correctness of limit enforcement |

## Test Types

### Unit Tests: Not implemented

**Worth adding for:**
- `scripts/render_cv.py` — `parse_markdown()`, `is_section_header()`, `is_bullet()`, `get_bullet_text()`, `is_skill_line()`, `is_job_title_line()`, `is_project_header()` — all pure functions
- `scripts/jobspy_service.py` — `_build_location_string()`, `_safe_number()`, `run_single_query()` validation
- n8n Code node JavaScript — each Code node's logic could be extracted into testable pure functions

### Integration Tests: Not implemented

**Worth adding for:**
- `cv_service.py` — full HTTP request → DOCX generation → base64 response round-trip
- `jobspy_service.py` — `/scan` and `/batch` endpoint validation (correct status codes, error responses, safety brakes)
- End-to-end workflow tests using n8n's test execution feature

### E2E Tests: Not applicable

n8n provides built-in execution UI for manual testing. There is no automated E2E testing.

## Common Patterns

### Existing Manual Verification Patterns

**n8n Workflow Execution:**
- Workflows are tested by manually triggering them in the n8n UI and inspecting execution logs
- Each workflow has a `Manual Trigger` node for ad-hoc execution
- Node `"retryOnFail": true` with `"maxTries": 3` provides built-in resilience during testing

**Graceful Degradation as Testing Strategy:**
```javascript
// If AI response parsing fails, record error instead of crashing the pipeline
catch (err) {
  return [{ json: {
    recordId: recordId,
    interviewQuestions: '(Interview prep generation failed: ' + err.message + ')',
    starResponses: '',
    interviewPrepCost: interviewPrepCost
  }}];
}
```
This pattern means failures are captured in Airtable records rather than causing silent data loss — the data itself serves as a verification trail.

**Cost Tracking as Observability:**
Every AI call logs exact token cost, enabling verification that models and pricing are correct.

## What Would Need Testing Infrastructure

### Python Scripts
- `pytest` (test runner)
- `pytest-cov` (coverage)
- `ruff` (linter)
- `responses` or `pytest-mock` (HTTP mocking for Flask service)
- `python-docx` in-memory testing (uses `BytesIO` for output)

### n8n Workflows
- n8n provides no official testing framework for exported workflows
- Each Code node's JavaScript could be extracted and tested independently with `vitest` or `jest`
- Key testing patterns needed:
  - `$input` / `$('NodeName')` mocking
  - Template expression evaluation (`={{ $json.field }}`)
  - AI response format variation coverage (with tags, without, malformed JSON)

## Recommended Test Prioritization

1. **Immediate (critical path):** Unit tests for `render_cv.py` — pure functions, no mocking needed
2. **Immediate (data integrity):** Extraction + tests for deduplication and safety brake logic in scanner Code nodes
3. **Short-term:** API contract tests for `cv_service.py` and `jobspy_service.py` endpoints
4. **Medium-term:** AI response parsing tests with variety of model outputs (Gemma 4 thinking tags, GPT-5 mini clean JSON, malformed responses, empty responses)
5. **Long-term:** Full integration test harness with local Airtable mock or test base

---

*Testing analysis: 2026-06-09*
