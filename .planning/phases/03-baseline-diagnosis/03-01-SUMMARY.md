---
phase: 03-baseline-diagnosis
plan: 01
subsystem: documentation
tags: airtable, n8n, csv, setup, baseline-metrics
requires: []
provides:
  - Baseline Metrics table schema in AIRTABLE-SCHEMA.md
  - Importable CSV template for Baseline Metrics table
  - Complete setup documentation covering import, credentials, Error Trigger, two-run protocol, and debugging
affects:
  - Phase 3 Plan 02 (measurement workflow build)
  - Phase 5 (Verification baseline comparison)
tech-stack:
  added: []
  patterns:
    - CSV template naming: `{Table Name}-Grid view.csv`
    - Setup doc tone aligned with existing SETUP.md
key-files:
  created:
    - airtable/templates/Baseline Metrics-Grid view.csv
    - docs/SETUP-03-BASELINE.md
  modified:
    - airtable/AIRTABLE-SCHEMA.md
key-decisions:
  - "Used existing CSV naming convention `{Table Name}-Grid view.csv` for Baseline Metrics template"
  - "Documented Error Trigger linking as post-import manual UI step per RESEARCH Pitfall 4"
  - "Documented Schedule Trigger timing (5-min buffer after 01e) per RESEARCH Pitfall 5"
  - "Documented workflow ID verification (A7) — n8n assigns numeric IDs on import, user must update filter"
requirements-completed: [HH-12]
duration: 3 min
completed: 2026-06-06
---

# Phase 3 Plan 1: Baseline Metrics Schema & Setup Summary

**AIRTABLE-SCHEMA.md updated with Baseline Metrics table definition, importable CSV template created, and setup documentation covering Error Trigger linking, two-run protocol, and debugging**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-06T22:53:50Z
- **Completed:** 2026-06-06T22:56:56Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Added Baseline Metrics table (15 fields) to AIRTABLE-SCHEMA.md with field types, auto-population flags, and descriptions
- Created importable CSV template matching the 15-field schema, following existing naming conventions
- Created SETUP-03-BASELINE.md with 9 sections covering: workflow import, Airtable setup with field type conversion, n8n credentials (API key + Header Auth), Error Trigger manual linking (RESEARCH Pitfall 4), 01e Workflow ID verification (A7), two-run protocol (D-08), comprehensive debugging (D-09), and post-baseline scraping

## Task Commits

1. **Task 1: Add Baseline Metrics table schema** - `05c8f30` (feat)
2. **Task 2: Create Baseline Metrics CSV template** - `cc90179` (feat)
3. **Task 3: Create SETUP-03-BASELINE.md** - `18922b3` (feat)

## Files Created/Modified

- `airtable/AIRTABLE-SCHEMA.md` - Added Baseline Metrics row to Tables Overview, added 15-field table definition
- `airtable/templates/Baseline Metrics-Grid view.csv` - Importable CSV template with all 15 field headers and one empty data row
- `docs/SETUP-03-BASELINE.md` - 293-line setup guide with 9 sections, referencing CONTEXT.md decisions D-01 through D-09

## Decisions Made

- Used existing CSV naming pattern `{Table Name}-Grid view.csv` for consistency with existing templates
- Documented Error Trigger linking as a manual post-import UI step (per RESEARCH Pitfall 4 — cannot be configured in JSON)
- Documented Schedule Trigger timing with 5-minute buffer after 01e (per RESEARCH Pitfall 5 — 01e may take >5 min)
- Documented workflow ID verification (per RESEARCH A7 — n8n assigns numeric IDs on import that differ from JSON)
- Chose to embed all user setup tasks directly in SETUP-03-BASELINE.md rather than creating a separate USER-SETUP.md, since the setup doc covers all dashboard configuration steps comprehensively

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

**External services require manual configuration.** See [`docs/SETUP-03-BASELINE.md`](../../docs/SETUP-03-BASELINE.md) for:

1. **Airtable Setup** (Section 3):
   - Import Baseline Metrics CSV template via Airtable UI
   - Update field types from plain text to correct types (Single select, Number, Date, Long text)
   - Verify `airtableTokenApi` credential has write access to new table

2. **n8n Credential Setup** (Section 4):
   - Generate n8n API key from n8n Settings → API Keys
   - Create Header Auth credential "n8n API Key" with `X-N8N-API-KEY` header

3. **Error Trigger Linking** (Section 5):
   - Open 01e workflow Settings → Error Workflow dropdown → select measurement workflow
   - Save explicitly (Pitfall 4 mitigation)

4. **Workflow ID Verification** (Section 6):
   - Note 01e's numeric workflow ID from URL
   - Update the n8n node's Workflow filter

5. **Two-Run Protocol** (Section 7):
   - Run 01e twice back-to-back
   - Compare metrics for stability

## Next Phase Readiness

- Baseline Metrics table is defined and ready for data writes by Plan 02 (measurement workflow)
- CSV template can be imported immediately to create the target table
- Setup documentation covers all manual configuration steps needed before Plan 02 execution
- Ready for Phase 3 Plan 02 (build measurement workflow JSON)

## Self-Check: PASSED

- [x] airtable/AIRTABLE-SCHEMA.md: FOUND
- [x] airtable/templates/Baseline Metrics-Grid view.csv: FOUND
- [x] docs/SETUP-03-BASELINE.md: FOUND
- [x] .planning/phases/03-baseline-diagnosis/03-01-SUMMARY.md: FOUND
- [x] Commit 05c8f30 (Task 1): FOUND
- [x] Commit cc90179 (Task 2): FOUND
- [x] Commit 18922b3 (Task 3): FOUND
- [x] Commit e8b7c50 (Summary): FOUND

---

*Phase: 03-baseline-diagnosis*
*Completed: 2026-06-06*
