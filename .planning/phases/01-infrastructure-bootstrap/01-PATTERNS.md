# Phase 1: Infrastructure & Bootstrap — Pattern Map

**Mapped:** 2026-06-09
**Files analyzed:** 3 (1 modify + 2 create)
**Analogs found:** 2 with matches / 3 total

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `docker-compose.example.yml` | config | — (infra) | `docker-compose.example.yml` (itself) | exact |
| `scripts/nocodb_bootstrap.py` | utility | request-response (HTTP API) | `scripts/render_cv.py` (CLI main pattern) + `scripts/jobspy_service.py` (logging/HTTP/error pattern) | role-match |
| `scripts/nocodb-schema.json` | config | — (static) | No existing JSON schema file in codebase | no analog |

---

## Pattern Assignments

### `docker-compose.example.yml` (config, modify in-place)

**Analog:** `docker-compose.example.yml` (existing file — same conventions)

**Service definition pattern** (lines 15-23 — existing Postgres for n8n):
```yaml
  db:
    image: postgres:16-alpine
    restart: always
    environment:
      - POSTGRES_USER=n8n
      - POSTGRES_PASSWORD=REPLACE_WITH_YOUR_PASSWORD
      - POSTGRES_DB=n8n
    volumes:
      - db_storage:/var/lib/postgresql/data
```

**Follow for:** `nocodb-postgres` service — same image, same env var structure, same volume pattern, plus a healthcheck per RESEARCH.md.

**n8n service environment variable pattern** (lines 30-44 — env vars + depends_on):
```yaml
    environment:
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=db
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=n8n
      - DB_POSTGRESDB_USER=n8n
      - DB_POSTGRESDB_PASSWORD=REPLACE_WITH_YOUR_PASSWORD
      # Replace with your domain, or remove if running locally
      - WEBHOOK_URL=https://your-domain.com/
    volumes:
      - n8n_storage:/home/node/.n8n
    depends_on:
      - db
```

**Follow for:** Adding `NOCDB_API_TOKEN` and `NOCDB_HOST` env vars to this n8n service section. Also follow for the new `nocodb` service definition.

**Volume declaration pattern** (lines 67-72):
```yaml
volumes:
  db_storage:
  n8n_storage:
  caddy_data:
  caddy_config:
  shared_tmp:
```

**Follow for:** Adding `nocodb_db_storage` and `nocodb_data` volumes in the same anonymous style (no driver/options specified — defaults).

**Dockerfile sidecar service pattern** (lines 47-65 — cv-renderer and jobspy-scanner):
```yaml
  cv-renderer:
    build:
      context: .
      dockerfile: scripts/Dockerfile.cv-renderer
    restart: always
    volumes:
      - shared_tmp:/tmp/jobsignal
      - ./scripts:/opt/jobsignal
    expose:
      - "3456"
```

**Follow for:** This is a reference for how sidecar services are declared (build vs image). The nocodb service will use `image:` (not `build:`) following the same pattern as the `db:` service.

**HEALTHCHECK pattern** (from RESEARCH.md — no existing healthcheck in docker-compose):
The existing `db:` service has no healthcheck. The new `nocodb-postgres` service will be the first to use one. Pattern from RESEARCH.md lines 123-128:
```yaml
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U nocodb_user -d nocodb_db"]
    interval: 10s
    timeout: 5s
    retries: 10
```

**depends_on with condition pattern** (from RESEARCH.md lines 135-137):
```yaml
  depends_on:
    nocodb-postgres:
      condition: service_healthy
```

This is a new pattern — existing services use simple `depends_on: - db` without condition.

---

### `scripts/nocodb_bootstrap.py` (utility, request-response)

**Analog (CLI pattern):** `scripts/render_cv.py`

**Module docstring pattern** (lines 1-16):
```python
"""
render_cv.py — Convert tailored CV markdown to formatted DOCX
Usage: python3 render_cv.py <input_markdown.md> <output.docx>

Designed for JobSignal Engine Workflow 3 (The Tailor).
Called by n8n Execute Command node after AI tailoring.
...
"""
```

**Follow for:** The bootstrap script starts with an analogous docstring describing its purpose, usage examples (all 4 flags), and CLI invocation.

**main() + `if __name__` entry point pattern** (lines 344-361):
```python
def main():
    if len(sys.argv) < 3:
        print("Usage: python3 render_cv.py <input.md> <output.docx>")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    with open(input_path, 'r', encoding='utf-8') as f:
        md_text = f.read()

    lines = parse_markdown(md_text)
    build_docx(lines, output_path)
    print(f"CV generated: {output_path}")


if __name__ == '__main__':
    main()
```

**Follow for:** The bootstrap script will use argparse (not sys.argv) for richer CLI parsing, but the `main()` + `if __name__ == '__main__': main()` entry point pattern is identical. The bootstrap script returns proper exit codes via `sys.exit(1)` on error.

---

**Analog (logging + HTTP + error handling):** `scripts/jobspy_service.py`

**Logging setup pattern** (lines 14-21):
```python
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)
```

**Follow for:** The bootstrap script uses the exact same logging setup. This is the project's standard Python logging convention.

**Input validation pattern** (lines 52-57):
```python
    # Validate
    if not search_term:
        return [], 'search_term is required'

    # Cap results_wanted to prevent runaway scrapes
    results_wanted = min(results_wanted, 100)
```

**Follow for:** The bootstrap script validates CLI args early (e.g., `--password` must be set if not `--skip-setup`), and applies safety brakes (cap batch sizes, prevent runaway operations).

**Error handling with traceback pattern** (lines 192-198):
```python
    except Exception as e:
        logger.error(f"Scan failed: {e}\n{traceback.format_exc()}")
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500
```

**Follow for:** The bootstrap script wraps API calls in try/except, logs errors with logger.error(), and raises informative RuntimeError messages for non-recoverable failures. Since this is a CLI script (not HTTP), errors raise exceptions or `sys.exit(1)` rather than returning HTTP responses.

**JSON response parsing pattern** (implicit in jobspy_service.py — used by Flask, but the pattern applies):
```python
query = request.get_json(force=True)
```

**Follow for:** The bootstrap script uses `requests` library:
```python
import requests
r = requests.post(url, json=payload, headers=headers)
r.raise_for_status()  # or check r.status_code
data = r.json()
```

**Safety brake pattern** (lines 235-240):
```python
        # Safety brake: cap at 10 queries per batch
        if len(queries) > 10:
            return jsonify({
                'success': False,
                'error': f'Too many queries ({len(queries)}). Max 10 per batch.'
            }), 400
```

**Follow for:** The bootstrap script uses safety brakes:
- Rate limit: 100ms delay between API calls
- Max CSV batch size: 10 records per POST request
- Retry: 3 attempts with 5s intervals on transient failures (429, 503)
- `--force` safety: Print DESTRUCTIVE ACTION warning; require confirmation if TTY

**JSON response processing pattern** (lines 88-109 — converting DataFrame to dict):
```python
    results = []
    for _, row in jobs_df.iterrows():
        job = {
            'title': row.get('title'),
            'company': row.get('company'),
            ...
        }
        results.append(job)
```

**Follow for:** The bootstrap script processes NocoDB API JSON responses similarly — extracting `id`, `token`, `list` arrays from response dicts with `.get()`.

---

**Analog (CLI with argparse):** No existing codebase file uses argparse. The RESEARCH.md provides the authoritative pattern (lines 636-843). Key imports excerpt for planner:

**argparse + imports pattern** (from RESEARCH.md lines 671-685):
```python
import argparse
import json
import logging
import os
import sys
import time
import csv
from urllib.parse import urljoin

import requests

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)
```

**argparse CLI pattern** (from RESEARCH.md lines 750-762):
```python
def main():
    parser = argparse.ArgumentParser(
        description="Bootstrap NocoDB tables for JobSignal Engine"
    )
    parser.add_argument("--nocodb-url", default="http://localhost:8080")
    parser.add_argument("--email", default=os.getenv("NOCODB_ADMIN_EMAIL", "admin@jobsignal.local"))
    parser.add_argument("--password", default=os.getenv("NOCODB_ADMIN_PASSWORD"))
    parser.add_argument("--table", help="Create only this table (e.g., 'Pipeline')")
    parser.add_argument("--force", action="store_true", help="Drop and recreate tables")
    parser.add_argument("--import-data", metavar="CSV_DIR", help="Seed tables from CSV files")
    parser.add_argument("--skip-setup", action="store_true", help="Skip workspace/base creation")
    parser.add_argument("--token-only", action="store_true", help="Only output the API token")
    args = parser.parse_args()
```

---

### `scripts/nocodb-schema.json` (config, static)

**Analog:** No existing JSON schema file exists in the codebase. No analog to excerpt.

**Reference pattern:** RESEARCH.md defines the canonical structure (lines 972-1029). The schema is a JSON file with:
- `version` string
- `description` string
- `base_title` string  
- `tables` array, each with `title`, `description`, `fields[]` (each with `title`, `type`, `required`, `description`, `options`)

**Field type reference** for the schema (from RESEARCH.md lines 459-484):

| v3 `type` value | Options Key | Use Case |
|---|---|---|
| `SingleLineText` | — | Names, Job IDs, URLs as text |
| `LongText` | `{"rich_text": true}` | Job descriptions, CV markdown |
| `URL` | — | Apply links, career page URLs |
| `Number` | — | Integer fields (counts) |
| `Decimal` | `{"precision": N}` | Fit scores (precision: 1), costs (precision: 6) |
| `Date` | `{"date_format": "YYYY-MM-DD"}` | Discovery dates, applied dates |
| `SingleSelect` | `{"choices": [{"title": "...", "color": "#36BFFF"}]}` | Status, Fit Tier, Source, Seniority Level |
| `MultiSelect` | `{"choices": [{"title": "...", "color": "#36BFFF"}]}` | Core Skills, Target Roles, Target Geography |
| `Checkbox` | — | Enabled flags |
| `Email` | — | Notification email |
| `Attachment` | — | Tailored CV DOCX |

**Select option color convention:** Use `"#36BFFF"` (blue) as the default for all select choices (consistent across NocoDB's default palette).

---

## Shared Patterns

### Python Script Conventions
**Source:** `scripts/render_cv.py` (lines 344-361), `scripts/cv_service.py` (lines 75-79), `scripts/jobspy_service.py` (lines 14-21, 291-293)
**Apply to:** `scripts/nocodb_bootstrap.py`

| Convention | Pattern | Source |
|---|---|---|
| Shebang | `#!/usr/bin/env python3` | cv_service.py:1, render_cv.py:1 |
| Module docstring | Triple-quoted string with purpose, usage, API | All 3 scripts |
| Logging | `logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')` | jobspy_service.py:20 |
| Entry point | `if __name__ == '__main__': main()` | All 3 scripts |
| Exit codes | `sys.exit(1)` on error | render_cv.py:347 |
| Error logging | `logger.error(f"Context: {e}")` with details | jobspy_service.py:193 |

### Docker Compose Conventions
**Source:** `docker-compose.example.yml` (lines 1-72)
**Apply to:** Modified `docker-compose.example.yml`

| Convention | Pattern | Source |
|---|---|---|
| Service naming | Lowercase with hyphens (e.g., `cv-renderer`, `jobspy-scanner`) | Lines 2, 15, 25, 47, 59 |
| Image tagging | Explicit versioned tags (`postgres:16-alpine`), or `:latest` for tools (Caddy, n8n) | Lines 3, 16, 26 |
| Restart policy | `restart: always` for data services, `restart: unless-stopped` for Caddy | Lines 4, 17, 27 |
| Environment format | `- KEY=value` array format (not map format) | Lines 18-21, 31-40 |
| Volume names | `snake_case` naming (e.g., `db_storage`, `n8n_storage`, `shared_tmp`) | Lines 68-72 |
| Port mapping | `"HOST:CONTAINER"` for external access, `expose:` for internal-only | Lines 55-56, 64-65 |
| Comments above section | Description comment before each service block | Line 58 |

### Error Handling Conventions
**Source:** All 3 Python scripts
**Apply to:** `scripts/nocodb_bootstrap.py`

| Scenario | Pattern | Source |
|---|---|---|
| Input validation | Check early, return descriptive error | jobspy_service.py:52-57 |
| API failures | try/except with logger.error(), raise RuntimeError with context | jobspy_service.py:192-198 |
| Resource cleanup | `os.remove()` in finally-like pattern | cv_service.py:52 |
| Graceful degradation | Safety brakes prevent runaway operations | jobspy_service.py:235-240 |

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `scripts/nocodb-schema.json` | config | static | No existing JSON schema definition file exists in the codebase. Planner should use the structure defined in RESEARCH.md (lines 972-1029) and the field type reference (lines 459-484). |
| `scripts/nocodb_bootstrap.py` | utility | request-response | Partial analog only — no existing script uses both `argparse` + `requests`. Combine patterns: CLI from `render_cv.py` main(), logging/HTTP from `jobspy_service.py`, argparse structure from RESEARCH.md (lines 636-843). |

## Metadata

**Analog search scope:** `scripts/`, `airtable/`, `docker-compose.example.yml`
**Files scanned:** 5 (3 Python scripts, 1 Docker Compose, 1 markdown schema doc)
**Pattern extraction date:** 2026-06-09
