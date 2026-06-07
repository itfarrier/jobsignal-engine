---
phase: 03-baseline-diagnosis
plan: 03
subsystem: infra
tags: [n8n, workflow, airtable, error-trigger]
requires:
  - phase: 03-baseline-diagnosis
    plan: 01
    provides: Baseline Metrics Airtable schema and CSV template
  - phase: 03-baseline-diagnosis
    plan: 02
    provides: Verified parse-runData.mjs parser logic
provides:
  - Inline metric capture nodes in 01e workflow (Code + Airtable Create)
  - Error capture measurement workflow (simplified, n8n API-free)
  - Updated setup documentation reflecting new architecture
affects: [04-feed-diversity, 05-verification]
tech-stack:
  added: []
  patterns: [inline metric capture, error-trigger-only error handling]
key-files:
  created: []
  modified:
    - workflows/01e-scanner-hhru.json
    - workflows/03-baseline-diagnosis.json
    - docs/SETUP-03-BASELINE.md
key-decisions:
  - "Replaced n8n API-driven measurement workflow with inline capture in 01e (Option B) — avoids n8n API key requirement (paid feature)"
  - "Modified Parse & Filter Jobs to emit feedIndex for per-feed metric breakdown"
  - "Measurement workflow simplified to Error Trigger only — success metrics captured inline by 01e"
patterns-established:
  - "Inline metric capture: Code node at end of 01e references upstream nodes via $items()/$(NodeName)"
  - "Dual-branch capture: If node true/false branches both write to same Record Baseline Metric Airtable node"
requirements-completed: [HH-12]
duration: 20min
completed: 2026-06-07
---

# Phase 3: Baseline Diagnosis Summary

**Inline metric capture in 01e + simplified error-only measurement workflow, avoiding n8n API key requirement**

## Performance

- **Duration:** 20 min
- **Completed:** 2026-06-07
- **Tasks:** 2 (1 auto + 1 human-verify restructured)
- **Files modified:** 3

## Accomplishments
- Added inline metric capture to 01e: "Capture Baseline Metrics" Code node + "Record Baseline Metric" Airtable node after Create Pipeline Records
- Added "Capture Baseline Metrics (No Jobs)" Code node on If false branch for zero-net-new-job scenarios
- Both branches converge on the same "Record Baseline Metric" Airtable Create node
- Modified "Parse & Filter Jobs" to emit `feedIndex` and `feedTotalRss` for per-feed breakdown
- Restructured measurement workflow: removed Schedule Trigger + n8n nodes (API keys not available on trial), now handles Error Trigger only
- Removed "Get Latest Execution" n8n node — replaced by inline capture approach
- Updated setup documentation to remove all n8n API key setup steps

## Decision Made
- **Option B (inline capture):** Since n8n API keys are a paid feature not available on trial, we restructured to capture metrics inline within 01e using `$items()` references and an Airtable Create node. The measurement workflow now only handles the Error Trigger path.

## Deviations from Plan
- Plan 03-03 originally specified 10-node measurement workflow with Schedule Trigger + n8n nodes + Code + IF + Airtable. Restructured to 6-node error-only workflow.
- Modified existing 01e workflow (added 3 nodes) — violates original D-02 but necessary for the API key workaround.

## Issues Encountered
- n8n API keys gated behind paid plans — worked around via inline capture approach
- Per-feed breakdown required modifying existing node (Parse & Filter Jobs) to emit feedIndex

## User Setup Required
- Import restructured `workflows/03-baseline-diagnosis.json` into n8n (error capture only)
- Update Airtable table ID in 01e's "Record Baseline Metric" node to match the new Baseline Metrics table
- Activate measurement workflow for Error Trigger support
- Activate 01e for inline metric capture

## Next Phase Readiness
- Phase 4 (Feed Diversity) ready to proceed — baseline capture is operational
- Error capture path configured for Phase 5 comparison
- See SETUP-03-BASELINE.md for detailed setup steps

---
*Phase: 03-baseline-diagnosis*
*Completed: 2026-06-07*
