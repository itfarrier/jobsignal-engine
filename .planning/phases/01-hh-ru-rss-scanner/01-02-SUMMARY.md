---
phase: 01-hh-ru-rss-scanner
plan: 02
subsystem: workflows
tags: [n8n, hh.ru, rss, airtable, scanner]

requires:
  - phase: 01-hh-ru-rss-scanner
    plan: 01
    provides: AIRTABLE-SCHEMA RU geographies and HH RSS column docs
provides:
  - Importable workflows/01e-scanner-hhru.json hh.ru RSS scanner
  - Parse fixture and automated test script
  - SETUP.md import, schedule, and verification steps
affects: [02-evaluator]

tech-stack:
  added: []
  patterns:
    - "hh.ru RSS feed URL template with encodeURIComponent and area whitelist {1,2,113}"
    - "Profile-driven GEO_MAP with RU substring extensions and dynamic Target Geography"
    - "FNV-1a jobId suffix -hhr and Pipeline Source hh.ru"

key-files:
  created:
    - workflows/01e-scanner-hhru.json
    - fixtures/hh-rss-sample.xml
    - scripts/test_hh_rss_parse.mjs
  modified:
    - docs/SETUP.md

key-decisions:
  - "Sequential Airtable reads: Get Profile then Get Search Queries then Build Feed List"
  - "Manual HH RSS Search Queries run even when Profile has no RU geography (HH-09)"

patterns-established:
  - "01e mirrors 01d dedupe/create tail and 01a loop/aggregate/stripHtml patterns"

requirements-completed: [HH-01, HH-02, HH-03, HH-04, HH-05, HH-06, HH-09]

duration: 25min
completed: 2026-06-05
---

# Phase 1 Plan 02: hh.ru RSS Scanner Workflow Summary

**Importable n8n workflow 01e fetches hh.ru public RSS at 8:20, parses Russian-labeled fields, deduplicates, and creates Pipeline rows with Source hh.ru and -hhr job IDs**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3
- **Files created/modified:** 4

## Accomplishments

- Created `workflows/01e-scanner-hhru.json` (15 nodes, ~887 lines) with full trigger-to-create graph
- Build Feed List: RU auto-feeds (8 role cap), HH RSS query merge, SSRF-safe URL template, area whitelist
- Parse & Filter: stripHtml, parseHhDescription, extended GEO_MAP, title keywords, -hhr IDs
- Added fixture + `scripts/test_hh_rss_parse.mjs` for Nyquist parse verification
- Updated SETUP.md import list, 8:20 schedule row, Cloud note, curl/manual verification

## Task Commits

1. **Task 1–3: Workflow** - `81b3ba7` feat(01-02): add hh.ru RSS scanner workflow 01e
2. **Task 2: Fixture + script** - `82d53ad` feat(01-02): add hh.ru RSS parse fixture and test script
3. **Task 3: SETUP** - `b031774` docs(01-02): document 01e import, schedule, and RSS verification

## Files Created/Modified

- `workflows/01e-scanner-hhru.json` — Full hh.ru RSS scanner (schedule 8:20, loop batch 1, dedupe, create)
- `fixtures/hh-rss-sample.xml` — One live RSS item excerpt (Russian HTML description)
- `scripts/test_hh_rss_parse.mjs` — stripHtml + parseHhDescription assertions
- `docs/SETUP.md` — Import, schedule, verification bullets

## Decisions Made

- Search Query rows without Query String use Query label as `text=` fallback (documented in feedMeta)
- Invalid Location area IDs log warning and fall back to `113`

## Deviations from Plan

None - plan executed as written.

## User Setup Required

- Complete Airtable manual options from 01-01 checklist (RU geographies, HH RSS Source Type, Pipeline Source `hh.ru`)
- Import `01e-scanner-hhru.json` in n8n; reuse Airtable PAT credential from 01a–01d

## Verification Results

| Check | Result |
|-------|--------|
| `node scripts/test_hh_rss_parse.mjs` | PASS |
| `python3 -m json.tool workflows/01e-scanner-hhru.json` | PASS |
| curl RSS `?text=test&area=113` | HTTP 200 |
| Manual n8n execute | Operator — import workflow and run |

## Self-Check: PASSED

- FOUND: workflows/01e-scanner-hhru.json
- FOUND: fixtures/hh-rss-sample.xml
- FOUND: scripts/test_hh_rss_parse.mjs
- FOUND: docs/SETUP.md updates

---
*Phase: 01-hh-ru-rss-scanner*
*Completed: 2026-06-05*
