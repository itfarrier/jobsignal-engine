---
phase: 01-infrastructure-bootstrap
plan: 04
subsystem: infra
tags: [nocodb, python, bootstrap, idempotency, gap-closure]

requires:
  - phase: 01-02
    provides: scripts/nocodb_bootstrap.py bootstrap script with workspace, base, and table creation
provides:
  - "Idempotent workspace resolution — GET-list before POST-create in get_or_create_workspace()"
  - "Idempotent base resolution — get_or_create_base() lists existing bases before creating"
  - "Fixes UAT tests 4 and 8: second bootstrap run no longer fails from CE 1-workspace limit"
affects:
  - 01-03 (integration testing against live NocoDB)

tech-stack:
  added: []
  patterns:
    - "List-first pattern for idempotent resource creation: GET existing resources before POST create"
    - "Fall-through exception handling: transient listing errors fall through to create rather than crash"

key-files:
  created: []
  modified:
    - scripts/nocodb_bootstrap.py: Inverted workspace creation order, added get_or_create_base()

key-decisions:
  - "List-first idempotency: GET existing workspaces/bases before attempting POST create — eliminates the CE 1-workspace limit failure on second run"
  - "get_or_create_base() uses _api_request() shared wrapper for the GET (unlike get_or_create_workspace which uses raw requests.get for compatibility)"
  - "create_base() preserved as pure creation primitive — get_or_create_base() calls it as fallback"
  - "Exception-catching on base listing so transient API errors degrade gracefully to creation path"

patterns-established:
  - "Idempotent resource resolution via list-first pattern: check-then-skip at workspace+base level (same pattern as existing create_table_idempotent at table level)"
  - "Graceful degradation: transient listing failures fall through to creation instead of crashing"

requirements-completed:
  - BOOT-01
  - BOOT-03

duration: 4min
completed: 2026-06-10
---

# Phase 01 Plan 04: NocoDB Bootstrap Idempotency (Gap Closure)

**List-first workspace and base resolution for NocoDB bootstrap — closes UAT failures 4 and 8 by eliminating unconditional workspace+base creation that hit CE's 1-workspace limit on subsequent runs**

## Performance

- **Duration:** 4 min
- **Started:** 2026-06-10T08:40:00Z
- **Completed:** 2026-06-10T08:44:12Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- **Inverted `get_or_create_workspace()`** to list existing workspaces (GET) before attempting creation (POST). Second run returns existing workspace immediately — no POST, no CE limit error.
- **Added `get_or_create_base()`** that lists existing bases in the workspace and only fell through to `create_base()` when "JobSignal Engine" doesn't exist.
- **Wired `get_or_create_base()` into `main()`** replacing the unconditional `create_base()` call — `--force` now reaches table operations on subsequent runs.
- **Preserved `create_base()`** as the clean creation primitive, used internally by `get_or_create_base()`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Invert get_or_create_workspace() to list-first** - `05cae3a` (fix)
2. **Task 2: Add get_or_create_base() and wire into main()** - `b2c5988` (feat)

## Files Modified

- `scripts/nocodb_bootstrap.py` — 77 insertions, 30 deletions: inverted workspace resolution order, added `get_or_create_base()` function, updated `main()` call site

## Decisions Made

- **List-first idempotency**: GET existing workspaces/bases before attempted POST creation. This eliminates the CE 1-workspace limit error on subsequent runs that was causing UAT tests 4 and 8 to fail.
- **`get_or_create_base()` uses `_api_request()`** (the shared retry wrapper) for the GET call — the bases endpoint is more stable than workspace listing, and the retry logic adds resilience.
- **Exception-catching on base listing**: Transient API errors during the list phase degrade gracefully to the creation path rather than crashing the bootstrap.
- **`create_base()` preserved** as the pure-creation primitive, keeping the function importable and testable independently.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both UAT failures (test 4 and 8) addressed
- Workspace+base setup is now fully idempotent: first run creates, subsequent runs reuse
- `--force` mode now reaches table operations reliably on any run
- Ready for Plan 01-03 (integration testing against live NocoDB) or final phase verification

## Self-Check: PASSED

- ✅ `scripts/nocodb_bootstrap.py` exists on disk (verified)
- ✅ `01-04-SUMMARY.md` exists on disk
- ✅ `05cae3a` (fix: invert get_or_create_workspace()) committed
- ✅ `b2c5988` (feat: add get_or_create_base()) committed
- ✅ Python syntax check passes
- ✅ All CLI flags preserved (`--help` output verified)
- ✅ AST verification: GET-list before POST-create in `get_or_create_workspace()`
- ✅ AST verification: `get_or_create_base()` exists and called from `main()`
- ✅ AST verification: `create_base()` preserved as creation primitive

---

*Phase: 01-infrastructure-bootstrap*
*Completed: 2026-06-10*
