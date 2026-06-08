# Coding Conventions

**Analysis Date:** 2026-06-09

## Overview

This codebase is an n8n-based automation pipeline (JobSignal Engine) with Python sidecar services. The primary "code" is embedded JavaScript inside n8n workflow JSON files (`workflows/*.json`), with supporting Python scripts in `scripts/`. There is no TypeScript, no React, no traditional web application code.

---

## Naming Patterns

**Workflow Files:**
- Pattern: `{NN}{letter}-{name}.json` (e.g., `01a-scanner-greenhouse.json`, `02-evaluator.json`)
- Files are zero-padded numbers for ordering by execution sequence
- Letter suffix denotes parallel variants (1a, 1b, 1c, 1d = parallel scanners)

**Workflow Names (inside JSON):**
- Pattern: `JobSignal - Workflow {N} - {Name}` (e.g., `"JobSignal - Workflow 1a - Scanner (Greenhouse)"`)
- Consistent prefix `JobSignal - Workflow {N}` across all 8 workflows

**n8n Node Names:**
- PascalCase with spaces, descriptive: `Parse & Filter Jobs`, `Build Scoring Prompt`, `Deduplicate vs Pipeline`
- Nodes doing the same function across different scan workflows use identical names (e.g., `Parse & Filter Jobs` appears in all 4 scanner workflows)

**Python Functions:**
- `snake_case` for function names (e.g., `parse_markdown`, `run_single_query`, `is_section_header`)
- Private/helper functions prefixed with `_` (e.g., `_respond`, `_build_location_string`, `_safe_number`)
- Verb-noun pattern: `build_docx`, `get_bullet_text`, `parse_markdown`

**Python Variables:**
- `snake_case` for local variables (e.g., `search_term`, `results_wanted`, `tmp_path`)
- Descriptive, not abbreviated (e.g., `linkedin_fetch_description`, not `lkd_fetch_desc`)

**n8n JavaScript Variables (inside Code nodes):**
- `camelCase` for variables (e.g., `const apiResponse`, `const userGeographies`, `const recordId`)
- Single-letter variables limited to loop counters (`i`) and map callbacks

**Python Classes:**
- `PascalCase` (e.g., `CVHandler(BaseHTTPRequestHandler)`)

---

## Code Style

**Formatting:**
- No automated formatter detected — no `.prettierrc`, `ruff.toml`, `biome.json`, or `setup.cfg` found
- Python: 4-space indentation (PEP 8 convention, implicit)
- n8n JavaScript: 2-space indentation inside Code node `"jsCode"` strings in JSON
- Maximum line length of ~100 characters in Python scripts, unbounded in n8n JSON (some lines exceed 2000 chars)

**Linting:**
- No linter detected — no `.eslintrc`, `ruff.toml`, `pylintrc`, or `flake8` configuration
- `.gitignore` has `.ruff_cache/` entry, suggesting Ruff was used historically but no config is committed

**Python Style Guide:**
- Module-level docstrings with triple quotes describing purpose, usage, and endpoints
- Imports at top: standard library first, then third-party packages
- Constants (or near-constants) declared as module-level variables

**n8n JavaScript Style Guide:**
- JavaScript code is embedded as JSON string values under the `"jsCode"` key in each Code node
- Uses `const` exclusively for variable declarations (no `let` or `var`)
- Arrow functions for array methods: `.filter()`, `.map()`, `.forEach()`
- Template literals (backtick strings) for building prompts with interpolation
- Comments use `//` single-line style at top of the code block

---

## Import Organization

**Python:**
1. Standard library imports first (e.g., `json`, `sys`, `re`, `os`, `logging`, `traceback`, `base64`, `http.server`)
2. Third-party imports second (e.g., `from flask import Flask`, `from docx import Document`)
3. Local module imports third (e.g., `from render_cv import parse_markdown, build_docx`)
4. Groups separated by blank lines

**n8n JavaScript:**
- No import/export system — n8n Code nodes run in an isolated sandbox
- Access other nodes' data via `$('NodeName')` API: `$('Get Profile').first().json`, `$('Loop Over Jobs').item.json`

---

## Error Handling

**Python (cv_service.py — http.server):**
```python
try:
    # operation
    self._respond(200, {'status': 'ok', ...})
except Exception as e:
    self._respond(500, {'error': str(e)})
```
- HTTP status codes used correctly (200 success, 400 bad request, 404 not found, 500 server error)
- Input validation: check for `Content-Length`, validate markdown length ≥ 50 chars
- Errors caught broadly (`except Exception`) but return meaningful messages
- Cleanup is handled (files deleted with `os.remove()` in `finally`-like pattern)

**Python (jobspy_service.py — Flask):**
```python
try:
    query = request.get_json(force=True)
    if not query:
        return jsonify({'success': False, 'error': 'No JSON body provided'}), 400
except Exception as e:
    logger.error(f"Scan failed: {e}\n{traceback.format_exc()}")
    return jsonify({'success': False, 'error': str(e)}), 500
```
- Consistent response pattern: `{'success': bool, ...}` with HTTP status codes
- Input validation before processing
- Logging errors before returning
- Traceback included in error responses for debugging
- Safety brakes: `results_wanted = min(results_wanted, 100)`, batch size ≤ 10

**n8n JavaScript (Code nodes):**
```javascript
if (!companyName) {
  throw new Error('Company Name missing from Prepare Company Data node.');
}
```
- Early validation with descriptive `throw new Error()` messages
- JSON parse errors caught with descriptive content preview:
  ```javascript
  throw new Error('Failed to parse AI response as JSON: ' + err.message
    + ' | Raw: ' + JSON.stringify(aiResponse).slice(0, 500));
  ```
- n8n AI nodes configured with `retryOnFail: true`, `maxTries: 3`, `waitBetweenTries: 5000`
- Safety brake pattern for anomaly detection:
  ```javascript
  if (netNew.length > 100) {
    throw new Error(`Safety brake: ${netNew.length} net-new jobs exceeds 100 limit.`);
  }
  ```
- Graceful degradation: interview prep failures store error message instead of crashing:
  ```javascript
  return [{ json: {
    recordId: recordId,
    interviewQuestions: '(Interview prep generation failed: ' + err.message + ')',
    ...
  }}];
  ```

---

## Logging

**Python (jobspy_service.py — Flask):**
```python
import logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)
logger.info(f"Scanning: '{search_term}' | location='{location}' | sites={sites}")
logger.error(f"Scan failed: {e}\n{traceback.format_exc()}")
```
- Standard `logging` module with timestamped format
- INFO level for operational messages (scan progress, result counts)
- ERROR level for failures (with traceback)

**Python (cv_service.py — http.server):**
- Minimal logging: overrides `log_message()` to only log 500 errors:
  ```python
  def log_message(self, format, *args):
      if args and '500' in str(args):
          super().log_message(format, *args)
  ```
- No additional logging framework used

**n8n Workflows:**
- No explicit logging within Code nodes — n8n handles execution logging natively via its UI
- AirTable writes serve as the persistence/log of all actions

---

## Comments

**When to Comment:**
- Every n8n Code node starts with a `//` comment explaining what it does (one line)
- Every Python script has a module-level docstring explaining purpose, usage, and API
- Every Python function has a docstring explaining intent
- Complex regex patterns have inline comments
- Markdown formatting pipelines have comments explaining each step

**JSDoc/TSDoc:**
- Not used (no TypeScript in the codebase)

**Python Docstrings:**
```python
def parse_markdown(md_text):
    """Parse the tailored CV markdown into structured sections."""
```
- Triple-quoted strings, sentence case, first line is a summary
- Multi-line docstrings used on module level and complex functions

---

## Function Design

**Size:**
- Python functions range from ~15 lines (helpers) to ~340 lines (`build_docx` in `render_cv.py`)
- n8n Code node functions range from ~30 lines (simple transforms) to ~200+ lines (complex prompt builders)
- `build_docx()` at 341 lines is the largest single function — it manages a state-machine-driven DOCX generator

**Parameters:**
- Python: typed but not with full type hints — e.g., `def is_section_header(line):` (no `-> bool`)
- n8n JavaScript: no parameter passing between Code nodes — data flows via `$json`, `$('NodeName').item.json`, `$input.first().json`

**Return Values:**
- Python: consistent return types (lists return `[]` for empty, dicts for single results)
- n8n JavaScript: returns an array of `{ json: {...} }` objects (n8n item format)
- Error responses return structured JSON with `error` key and HTTP status codes

---

## Module Design

**Exports:**
- Python: no explicit `__all__` exports. Modules expose functions that are imported directly: `from render_cv import parse_markdown, build_docx`
- n8n: no module system — each Code node is self-contained

**Barrel Files:**
- Not used (only 3 Python scripts, no packages)

**Single Responsibility:**
- `render_cv.py` — pure CV markdown parsing and DOCX generation (importable library)
- `cv_service.py` — HTTP wrapper around `render_cv.py` (server layer)
- `jobspy_service.py` — HTTP service for JobSpy job scraping (self-contained, Flask)

---

## Dockerfile Conventions

**Base Images:**
- `python:3.12-alpine` for CV renderer (smaller image, runs `python-docx`)
- `python:3.12-slim` for JobSpy scanner (needs more compat for scraping dependencies)
- `postgres:16-alpine` for n8n database
- `caddy:latest` for reverse proxy

**Pattern:**
```dockerfile
FROM python:3.12-alpine
RUN pip install --no-cache-dir python-docx
WORKDIR /opt/jobsignal
COPY scripts/render_cv.py /opt/jobsignal/render_cv.py
COPY scripts/cv_service.py /opt/jobsignal/cv_service.py
EXPOSE 3456
CMD ["python3", "/opt/jobsignal/cv_service.py"]
```
- Single-stage builds (no multi-stage)
- Consistent `WORKDIR /opt/jobsignal`
- Port 3456 for CV, 3457 for JobSpy
- `--no-cache-dir` for pip installs

---

*Convention analysis: 2026-06-09*
