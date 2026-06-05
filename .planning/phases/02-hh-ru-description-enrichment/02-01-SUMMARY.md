---
phase: 02-hh-ru-description-enrichment
plan: 01
subsystem: testing
tags: [hh.ru, html-extraction, json-ld, stripHtml, tdd, node]

# Dependency graph
requires:
  - phase: 01-hh-ru-rss-scanner
    provides: stripHtml pattern in test_hh_rss_parse.mjs and 01e Parse node
provides:
  - fixtures/hh-vacancy-page-sample.html anonymized vacancy page excerpt
  - scripts/test_hh_vacancy_parse.mjs with extractVacancyDescriptionHtml, stripHtml, mergeVacancyDescription
affects: [02-02 workflow port, HH-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JSON-LD JobPosting.description primary, data-qa vacancy-description fallback"
    - "mergeVacancyDescription: extract → stripHtml → 50k cap → RSS fallback"

key-files:
  created:
    - fixtures/hh-vacancy-page-sample.html
    - scripts/test_hh_vacancy_parse.mjs
  modified: []

key-decisions:
  - "JSON-LD JobPosting.description is primary extraction path; data-qa block is fallback"
  - "stripHtml copied verbatim from test_hh_rss_parse.mjs (entity decode with &amp; last)"
  - "50,000 char cap applied after stripHtml with [Description truncated] suffix"

patterns-established:
  - "Vacancy page parse logic isolated in test script before n8n workflow port (02-02)"
  - "Offline fixture-based assertions mirroring Phase 1 RSS test pattern"

requirements-completed: [HH-10]

# Metrics
duration: 8min
completed: 2026-06-05
---

# Phase 02 Plan 01: Vacancy Page Parse Tests Summary

**JSON-LD JobPosting extraction with data-qa fallback, stripHtml sanitization, and 50k merge cap — TDD-isolated from n8n workflow**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-05T20:30:00Z
- **Completed:** 2026-06-05T20:38:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Anonymized vacancy page fixture with JSON-LD JobPosting and `data-qa="vacancy-description"` blocks
- Exported `extractVacancyDescriptionHtml`, `stripHtml`, `mergeVacancyDescription` with full assertion suite
- All vacancy parse tests pass; RSS parse regression test still passes

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Fixture and failing vacancy parse tests** - `10dcf98` (test)
2. **Task 2 (GREEN): Implement extraction and merge functions** - `1225f43` (feat)

**Plan metadata:** `427fc67` (docs: complete plan)

## Files Created/Modified

- `fixtures/hh-vacancy-page-sample.html` — Anonymized hh.ru page excerpt for offline extraction tests
- `scripts/test_hh_vacancy_parse.mjs` — Extraction/strip/merge functions + 6 assertion cases

## Decisions Made

- JSON-LD `JobPosting.description` tried first via script block iteration with per-block try/catch
- `data-qa="vacancy-description"` regex fallback when JSON-LD absent or unparseable
- RSS fallback used only when extraction yields empty string (not when stripHtml returns empty from valid HTML)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed truncation test HTML structure**
- **Found during:** Task 2 (GREEN)
- **Issue:** Test 5 used bare `<p>` tags without JSON-LD or data-qa markers, so extraction returned empty and merge fell back to RSS instead of testing truncation
- **Fix:** Updated test to use `data-qa="vacancy-description"` wrapper with 50,001-char content
- **Files modified:** scripts/test_hh_vacancy_parse.mjs
- **Verification:** `node scripts/test_hh_vacancy_parse.mjs` exits 0
- **Committed in:** 1225f43 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** Test fix required for truncation assertion to validate actual merge path; no scope change.

## Issues Encountered

None beyond the truncation test structure fix documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Parse functions exported and tested; ready for port into `workflows/01e-scanner-hhru.json` Merge Descriptions node (02-02)
- No blockers

## Self-Check: PASSED

- FOUND: fixtures/hh-vacancy-page-sample.html
- FOUND: scripts/test_hh_vacancy_parse.mjs
- FOUND: .planning/phases/02-hh-ru-description-enrichment/02-01-SUMMARY.md
- FOUND: commit 10dcf98
- FOUND: commit 1225f43

---
*Phase: 02-hh-ru-description-enrichment*
*Completed: 2026-06-05*
