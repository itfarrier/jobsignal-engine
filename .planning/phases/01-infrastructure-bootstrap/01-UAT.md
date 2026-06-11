---
status: diagnosed
phase: 01-infrastructure-bootstrap
source: 01-01-SUMMARY.md, 01-02-SUMMARY.md
started: 2026-06-09T11:39:00Z
updated: 2026-06-09T11:55:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Infrastructure — Docker Compose NocoDB services
expected: docker-compose.example.yml defines nocodb and nocodb-postgres services. Running `docker compose up -d` starts both containers. NocoDB UI is accessible at http://localhost:8080.
result: pass

### 2. Bootstrap — Full table creation
expected: `python3 scripts/nocodb_bootstrap.py --email admin@verify.local --password verify-test-123` exits 0 and creates all 4 tables (Profile, Tracked Companies, Pipeline, Search Queries) with correct field types.
result: pass

### 3. Bootstrap — Single table mode (--table flag)
expected: `python3 scripts/nocodb_bootstrap.py --table Pipeline --force` recreates only the Pipeline table without affecting other 3 tables. Exit code 0.
result: pass

### 4. Bootstrap — Idempotency (re-running is safe)
expected: Running bootstrap a second time detects tables already exist and skips creation. Does not create duplicate workspace/base. Exit code 0.
result: issue
reported: "Running bootstrap a second time must detect tables already exist and skip creation. Must not create duplicate workspace/base. Must exit code 0 in this case."
severity: major

### 5. Bootstrap -- --token-only flag
expected: `NOCDB_API_TOKEN=test-test python3 scripts/nocodb_bootstrap.py --token-only` prints "test-test". Exit code 0.
result: pass

### 6. NocoDB Schema — Table field types (UI verification)
expected: Human opens NocoDB UI, signs in, and confirms all 4 tables have correct field types (text, select with options, decimal, checkbox, attachment, date) matching nocodb-schema.json.
result: pass

### 7. NocoDB Schema — Select option values (UI verification)
expected: Human confirms SingleSelect and MultiSelect fields have correct option values (Seniority Level, Scan Method, Source, Status, Fit Tier, Target Geography).
result: pass

### 8. Bootstrap -- Destructive mode (--force all tables)
expected: `python3 scripts/nocodb_bootstrap.py --force` drops and recreates all 4 tables. Previous table data is gone. Exit code 0.
result: issue
reported: "Same root cause as test 4 -- script creates new workspace every run, hitting CE workspace limit"
severity: major

## Summary

total: 8
passed: 6
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Running bootstrap a second time detects tables already exist and skips creation. Does not create duplicate workspace/base. Exit code 0."
  status: failed
  reason: "User confirmed: Running bootstrap a second time must detect tables already exist and skip creation. Script creates new workspace+base every run, hits CE workspace limit on subsequent runs."
  severity: major
  test: 4
  root_cause: "get_or_create_workspace() tries POST to create workspace unconditionally instead of listing first. create_base() is always called after workspace is obtained, creating a new base each run. NocoDB CE has 1-workspace limit, so subsequent runs fail with 'Maximum workspace limit reached'."
  artifacts:
    - path: "scripts/nocodb_bootstrap.py"
      issue: "get_or_create_workspace() line 245-321: tries POST create first, lists only on failure. Should invert the order — list first, create if empty."
    - path: "scripts/nocodb_bootstrap.py"
      issue: "main() line 781-785: calls get_or_create_workspace + create_base every run (not --skip-setup), guaranteeing new workspace+base on each invocation."
  missing:
    - "In get_or_create_workspace(): list existing workspaces before attempting creation"
    - "Add get_or_create_base(): check for existing bases in workspace before creating new one"
    - "Default mode should be idempotent: no new workspace+base created if they already exist"
  debug_session: ""

- truth: "python scripts/nocodb_bootstrap.py --force drops and recreates all 4 tables"
  status: failed
  reason: "Same root cause as test 4 -- script creates new workspace every run, hitting CE workspace limit"
  severity: major
  test: 8
  root_cause: "Same root cause as test 4: unconditional workspace+base creation on each run. --force cannot function because workspace creation fails before table operations begin."
  artifacts:
    - path: "scripts/nocodb_bootstrap.py"
      issue: "Same fix as test 4 — idempotent workspace/base lookup required before --force table operations"
  missing:
    - "Same fix as test 4"
  debug_session: ""
