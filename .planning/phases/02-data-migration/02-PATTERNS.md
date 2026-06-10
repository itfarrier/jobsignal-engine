# Phase 2: Data Migration - Pattern Map

**Mapped:** 2026-06-10
**Files analyzed:** 5 (1 to modify, 1 may-need-minor-update, 2 already created, 1 reference-only)
**Analogs found:** 2 / 2 (for files needing changes)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `scripts/nocodb_bootstrap.py` | utility (CLI) | CRUD (workspace/base lifecycle) | itself (existing `--token-only`, `--skip-setup` flags) | exact — same file |
| `docker-compose.example.yml` | config | N/A | itself (Phase 1 already added NocoDB service) | exact — same file |
| `airtable/AIRTABLE-SCHEMA.md` | reference | N/A | N/A — reference only, no changes needed | N/A |
| `.planning/phases/02-data-migration/02-RESEARCH.md` | research | N/A | `.planning/phases/01-infrastructure-bootstrap/01-RESEARCH.md` | already created externally |
| `.planning/phases/02-data-migration/02-VALIDATION.md` | validation | N/A | `.planning/phases/01-infrastructure-bootstrap/01-VALIDATION.md` | already created externally |

## Pattern Assignments

### `scripts/nocodb_bootstrap.py` (utility, CRUD)

**Analog:** itself — the existing flag patterns are the exact template for the `--workspace-only` addition.

**No new files created. Single modification to existing file:** add `--workspace-only` CLI flag following the exact pattern established by `--token-only`, `--skip-setup`, and `--import-data`.

#### Imports pattern (lines 1-36) — No changes needed

```python
#!/usr/bin/env python3
"""
nocodb_bootstrap.py — Bootstrap NocoDB tables for JobSignal Engine.
...
"""

import argparse
import csv
import json
import logging
import os
import sys
import time
import traceback
from urllib.parse import urljoin

import requests

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)
```

#### CLI flag pattern — ADD `--workspace-only` following these existing patterns

**Existing `--skip-setup` flag** (lines 761-765) — use as template for `--workspace-only`:
```python
parser.add_argument(
    "--skip-setup",
    action="store_true",
    help="Skip workspace/base creation (use existing)",
)
```

**Existing `--token-only` flag** (lines 766-770) — use as template (same `action="store_true"` pattern):
```python
parser.add_argument(
    "--token-only",
    action="store_true",
    help="Only output the API token from NOCDB_API_TOKEN env var and exit",
)
```

**Existing `--import-data` flag** (lines 756-759) — `--workspace-only` will need to log a warning when this is combined:
```python
parser.add_argument(
    "--import-data",
    metavar="CSV_DIR",
    help="Seed tables from CSV files in directory",
)
```

**New flag to add** — insert after `--token-only` (line 770), following the same pattern:
```python
parser.add_argument(
    "--workspace-only",
    action="store_true",
    help="Create workspace + base only (skip table creation — import from Airtable creates tables)",
)
```

#### Early-exit pattern (lines 780-788) — `--token-only` pattern to follow for `--workspace-only` early logic

```python
# --- --token-only mode ---
if args.token_only:
    token = os.getenv("NOCDB_API_TOKEN")
    if token:
        print(token)
    else:
        logger.error("No API token found in NOCDB_API_TOKEN env var")
        sys.exit(1)
    return
```

**For `--workspace-only`**, insert equivalent skip logic after the `--token-only` block (around line 788). Pattern to follow:
```python
# --- --workspace-only mode ---
if args.workspace_only:
    if args.import_data:
        logger.warning("--import-data is ignored when --workspace-only is set")
    if args.table:
        logger.error("--table is meaningless without table creation; use without --workspace-only")
        sys.exit(1)
```

#### Skip-step pattern (lines 819-862) — `--skip-setup` guard to follow for the tables loop skip

**Existing `--skip-setup` guard** (lines 820-824):
```python
if not args.skip_setup:
    logger.info("Setting up workspace and base...")
    workspace_id = get_or_create_workspace(base_url, jwt_token)
    base_id = get_or_create_base(base_url, jwt_token, workspace_id)
    api_token = create_api_token(base_url, jwt_token, base_id)
else:
    # ... find existing base
```

**For `--workspace-only`**, wrap the table creation block (lines 886-913) in an `if not args.workspace_only:` guard:
```python
# Step 7: Create tables (idempotent) — skipped in --workspace-only mode
if not args.workspace_only:
    logger.info(f"Creating {len(tables_to_create)} table(s)...")
    for table_def in tables_to_create:
        table_id = create_table_idempotent(
            base_url, internal_token, base_id, table_def, force=args.force
        )
        created_tables[table_def["title"]] = table_id
    # Step 8: Import CSV data if requested (also skipped)
    if args.import_data:
        ...
```

#### Error handling pattern (lines 918-925) — No changes needed, but reference for placement

```python
except RuntimeError as e:
    logger.error(f"Bootstrap failed: {e}")
    logger.debug(traceback.format_exc())
    sys.exit(1)
except Exception as e:
    logger.error(f"Unexpected error: {e}")
    logger.debug(traceback.format_exc())
    sys.exit(1)
```

#### Final output — adapt existing log pattern (lines 915-916) to account for `--workspace-only`

```python
# Existing bootstrap complete output
logger.info("Bootstrap complete.")
logger.info(f"Tables created: {', '.join(created_tables.keys())}")
```

For `--workspace-only`, change to something like:
```python
logger.info("Bootstrap complete (workspace-only mode).")
logger.info("Base is ready for importing from Airtable via NocoDB UI.")
```

---

### `docker-compose.example.yml` (config)

**Analog:** itself — the NocoDB service and all supporting services were already defined in Phase 1.

**No changes expected** for Phase 2. The existing `nocodb` service (lines 64-79), `nocodb-postgres` database (lines 25-38), and `nocodb_data` volume (line 108) are all in place. The native import operates through the NocoDB UI, which is already running at port 8080.

#### Existing named volume pattern (lines 101-108) — reference only

```yaml
volumes:
  db_storage:
  n8n_storage:
  caddy_data:
  caddy_config:
  shared_tmp:
  nocodb_db_storage:
  nocodb_data:
```

#### Existing NocoDB service pattern (lines 64-79) — reference only

```yaml
  nocodb:
    image: nocodb/nocodb:latest
    restart: always
    depends_on:
      nocodb-postgres:
        condition: service_healthy
    environment:
      - NC_DB=pg://nocodb-postgres:5432?u=nocodb_user&p=REPLACE_WITH_YOUR_PASSWORD&d=nocodb_db
      - NC_AUTH_JWT_SECRET=REPLACE_WITH_YOUR_JWT_SECRET
      - NC_PUBLIC_URL=https://nocodb.yourdomain.com
      - NC_ATTACHMENT_FIELD_SIZE=20971520
      - NC_DISABLE_TELE=true
    ports:
      - "8080:8080"
    volumes:
      - nocodb_data:/usr/app/data
```

#### Existing health check pattern (lines 34-38) — reference for postgres service

```yaml
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nocodb_user -d nocodb_db"]
      interval: 10s
      timeout: 5s
      retries: 10
```

---

### `airtable/AIRTABLE-SCHEMA.md` (reference)

**No changes.** Used as a reference document for verifying import completeness (confirming all field types, select options, and attachment columns were carried over).

---

### `.planning/phases/02-data-migration/02-RESEARCH.md` (research)

**Already created.** Contains all research needed: NocoDB native import flow, `--workspace-only` flag design, verification approach, pitfalls, security analysis.

### `.planning/phases/02-data-migration/02-VALIDATION.md` (validation)

**Already created.** Contains task-level verification map, manual test instructions, and Wave 0 requirements.

---

## Shared Patterns

### CLI Flag Convention — `scripts/` directory

**Source:** `scripts/nocodb_bootstrap.py` (lines 735-771)
**Apply to:** The `--workspace-only` addition

| Pattern Element | Convention | Example |
|-----------------|------------|---------|
| `action="store_true"` | Boolean flags use store_true | `--force`, `--skip-setup`, `--token-only` |
| `metavar=` | Flags requiring values | `--import-data CSV_DIR` |
| `default=os.getenv(...)` | Fallback to environment variable | `--email`, `--password` |
| `help=` | Description with env var hint | `"Admin email (env: NOCODB_ADMIN_EMAIL)"` |
| Docstring update | Sync `Usage:` section in module docstring | Lines 8-14 |

### Early Exit Pattern

**Source:** `scripts/nocodb_bootstrap.py` (lines 780-788)
**Apply to:** `--workspace-only` path

```python
if args.some_mode:
    # Validate preconditions
    # Log, print, or act
    # return (not sys.exit for normal exits in main)
```

### Skip Logic Guard Pattern

**Source:** `scripts/nocodb_bootstrap.py` (lines 820, 897)
**Apply to:** Wrapping the table creation loop with `if not args.workspace_only:`

```python
if not args.skip_feature:
    # ... do the work
else:
    logger.info("Skipping X...")
```

### Incompatible Flag Warning Pattern

**Source:** `scripts/nocodb_bootstrap.py` (lines 791-808 — `--force` warning)
**Pattern:** When a flag combination is invalid or overridden, log at `logger.warning` level and continue unless it's a hard error.

For `--workspace-only` + `--table`: hard error (logical contradiction)
For `--workspace-only` + `--import-data`: warning only (`--import-data` silently ignored)

---

## No Analog Found

All files requiring changes have exact analogs (the files themselves). No new files are being created in Phase 2.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | | | All files with changes are modifications to existing files |

---

## Implementation Summary for `scripts/nocodb_bootstrap.py`

The modification is a minor 3-part change:

1. **Add `--workspace-only` argparse flag** (insert after line 770, following `--token-only` pattern)
2. **Add early validation** (after line 788, following `--token-only` early-exit pattern):
   - If `--workspace-only` + `--table`: `logger.error` + `sys.exit(1)`
   - If `--workspace-only` + `--import-data`: `logger.warning("ignored")` (continue)
3. **Wrap Step 7 + Step 8** (lines 886-913) in `if not args.workspace_only:` guard

No changes to: docker-compose.example.yml, airtable/AIRTABLE-SCHEMA.md, nocodb-schema.json, error handling, or any other file.

---

## Metadata

**Analog search scope:** `scripts/`, `docker-compose.example.yml`, `.planning/phases/`
**Files scanned:** 6 (nocodb_bootstrap.py, docker-compose.example.yml, cv_service.py, render_cv.py, AIRTABLE-SCHEMA.md, 02-VALIDATION.md)
**Pattern extraction date:** 2026-06-10
