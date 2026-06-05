---
phase: 01-hh-ru-rss-scanner
plan: 01
subsystem: database
tags: [airtable, hh.ru, schema, geography]

requires: []
provides:
  - RU Target Geography options documented with hh area IDs and GEO_MAP substrings
  - HH RSS Search Queries column semantics and example row
  - Pipeline Source hh.ru option and manual Airtable setup checklist
affects: [01-02]

tech-stack:
  added: []
  patterns: [GEO_MAP RU extensions, HH RSS dual-use Search Queries table]

key-files:
  created: []
  modified: [airtable/AIRTABLE-SCHEMA.md]

key-decisions:
  - "Document area=113 fetch + post-filter pattern per D-08 through D-11"
  - "Location field for HH RSS stores area ID plain text, not city name (D-14)"

patterns-established:
  - "Search Queries table serves both JobSpy and HH RSS with JobSpy-only columns marked"

requirements-completed: [HH-07, HH-08]

duration: 10min
completed: 2026-06-05
---

# Phase 1 Plan 01: Airtable Schema Docs Summary

**AIRTABLE-SCHEMA.md extended with RU geographies, HH RSS Search Query semantics, Pipeline Source hh.ru, and operator setup checklist**

## Performance

- **Duration:** ~10 min
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added four RU Target Geography options with area ID reference table and GEO_MAP substring arrays
- Retitled Search Queries section for JobSpy + HH RSS dual use; documented column reuse and JobSpy-only ignores
- Added Pipeline Source `hh.ru` and manual Airtable option-add checklist

## Files Created/Modified

- `airtable/AIRTABLE-SCHEMA.md` — RU geography docs, HH RSS subsection, manual setup checklist

## Decisions Made

None — followed plan as specified; locked CONTEXT decisions D-08 through D-17 cited in prose.

## Deviations from Plan

None - plan executed exactly as written

## Issues Encountered

None

## User Setup Required

Operators must manually add four Profile geography options, HH RSS Source Type, and Pipeline Source `hh.ru` in Airtable UI before first `01e` run (documented in schema).

## Next Phase Readiness

Schema contract ready for `01-02` workflow implementation (`workflows/01e-scanner-hhru.json`).

---
*Phase: 01-hh-ru-rss-scanner*
*Completed: 2026-06-05*
