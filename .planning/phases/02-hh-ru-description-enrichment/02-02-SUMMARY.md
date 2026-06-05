---
phase: 02-hh-ru-description-enrichment
plan: 02
subsystem: workflows
tags: [hh.ru, n8n, httpRequest, splitInBatches, html-extraction, SSRF]

# Dependency graph
requires:
  - phase: 02-hh-ru-description-enrichment
    provides: test_hh_vacancy_parse.mjs extraction functions from 02-01
provides:
  - 01e per-job vacancy page fetch loop with 1s pacing
  - Merge Descriptions node with JSON-LD extraction, SSRF guard, RSS fallback
  - SETUP.md enrichment verification steps
affects: [evaluator, HH-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Loop Over Jobs (splitInBatches batch=1) inside feed loop for per-vacancy pacing"
    - "Fetch Vacancy Page mirrors 01a with alwaysOutputData + continueRegularOutput"
    - "Merge Descriptions: JSON-LD → data-qa → RSS fallback with 50k cap"

key-files:
  created: []
  modified:
    - workflows/01e-scanner-hhru.json
    - docs/SETUP.md

key-decisions:
  - "_descriptionSource internal marker (page|rss) omitted from Airtable Create mapping"
  - "SSRF whitelist ^https://hh.ru/vacancy/\\d+ applied in Merge node before using fetch result"
  - "stripHtml ported verbatim from test_hh_vacancy_parse.mjs (Phase 1 RSS variant)"

patterns-established:
  - "Per-job fetch loop nested inside feed loop with separate Wait 1s Vacancy pacing"
  - "Vacancy page parse logic inlined in n8n Code node from offline test script"

requirements-completed: [HH-10]

# Metrics
duration: 15min
completed: 2026-06-05
---

# Phase 02 Plan 02: Workflow Vacancy Enrichment Summary

**Per-job vacancy page fetch with JSON-LD extraction, SSRF guard, and RSS fallback wired into 01e-scanner-hhru.json**

## Performance

- **Duration:** 15 min
- **Started:** 2026-06-05T20:10:00Z
- **Completed:** 2026-06-05T20:25:38Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Added Loop Over Jobs, Fetch Vacancy Page, Merge Descriptions, and Wait 1s Vacancy nodes to 01e workflow
- Ported extractVacancyDescriptionHtml, stripHtml, and 50k merge cap into Merge Descriptions with hh.ru URL whitelist
- Updated SETUP.md with enrichment verification steps and test_hh_vacancy_parse.mjs command

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Loop Over Jobs, Fetch Vacancy Page, Wait 1s Vacancy nodes** - `23d5e56` (feat)
2. **Task 2: Implement Merge Descriptions and port parse logic** - `5dc6bba` (feat)
3. **Task 3: Update SETUP.md verification for description enrichment** - `151e841` (docs)

**Plan metadata:** `c753241` (docs: complete plan)

## Files Created/Modified

- `workflows/01e-scanner-hhru.json` — Per-job fetch loop, HTTP GET applyLink, merge/strip node, vacancy wait
- `docs/SETUP.md` — Enrichment behavior notes and offline parse test commands

## Decisions Made

- `_descriptionSource` marker kept internal (not mapped to Airtable) for debugging only
- SSRF guard rejects non-hh.ru/vacancy URLs before using fetch HTML
- Fetch node uses text response format with `data` output property per RESEARCH Pattern 1

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Re-import `01e-scanner-hhru.json` in n8n after pulling changes.

## Next Phase Readiness

- HH-10 satisfied: 01e enriches Job Description from vacancy page HTML with RSS fallback
- Milestone v2.0 deliverable complete; ready for manual n8n verification and milestone audit

## Self-Check: PASSED

- FOUND: workflows/01e-scanner-hhru.json
- FOUND: docs/SETUP.md
- FOUND: .planning/phases/02-hh-ru-description-enrichment/02-02-SUMMARY.md
- FOUND: commit 23d5e56
- FOUND: commit 5dc6bba
- FOUND: commit 151e841

---
*Phase: 02-hh-ru-description-enrichment*
*Completed: 2026-06-05*
