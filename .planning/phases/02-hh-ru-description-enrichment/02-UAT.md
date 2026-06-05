---
status: complete
phase: 02-hh-ru-description-enrichment
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-VERIFICATION.md]
started: 2026-06-05T22:00:00Z
updated: 2026-06-05T22:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Offline Vacancy Parse Tests
expected: Run `node scripts/test_hh_vacancy_parse.mjs` from repo root. Exits 0 with `OK: hh.ru vacancy page parse fixture passed`.
result: pass

### 2. RSS Parse Regression
expected: Run `node scripts/test_hh_rss_parse.mjs` from repo root. Exits 0 with `OK: hh.ru RSS parse fixture passed`. Phase 1 RSS parsing still works after enrichment changes.
result: issue
reported: "I see OK: hh.ru RSS parse fixture passed plus extra JSON object (company, region, salaryInfo) instead of only the OK line"
severity: minor

### 3. Live n8n Enrichment Smoke Test
expected: Re-import `workflows/01e-scanner-hhru.json` in n8n and execute manually against enabled HH RSS feeds. New Pipeline rows with Source=hh.ru have Job Description substantially longer than RSS summary (~500+ chars for typical vacancies), readable plain text with no HTML tags.
result: issue
reported: "Create Pipeline Records received enriched-path input but jobDescription is thin RSS text (~200 chars), _descriptionSource=rss. Airtable output shows Source=LinkedIn (not hh.ru), only Status/Fit Tier populated — Pipeline row is essentially empty."
severity: blocker

### 4. RSS Fallback on Fetch Failure
expected: Inspect n8n execution for a job where vacancy page fetch fails or returns empty/unparseable HTML. Job still reaches Create Pipeline Records with RSS-stripped jobDescription; no silent drop.
result: pass

## Summary

total: 4
passed: 2
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Run `node scripts/test_hh_rss_parse.mjs` from repo root. Exits 0 with `OK: hh.ru RSS parse fixture passed`. Phase 1 RSS parsing still works after enrichment changes."
  status: failed
  reason: "User reported: I see OK: hh.ru RSS parse fixture passed plus extra JSON object (company, region, salaryInfo) instead of only the OK line"
  severity: minor
  test: 2
  artifacts: []
  missing: []

- truth: "Re-import workflows/01e-scanner-hhru.json in n8n and execute manually against enabled HH RSS feeds. New Pipeline rows with Source=hh.ru have Job Description substantially longer than RSS summary (~500+ chars for typical vacancies), readable plain text with no HTML tags."
  status: failed
  reason: "User reported: Create Pipeline Records received input with thin RSS jobDescription and _descriptionSource=rss; Airtable output shows Source=LinkedIn with only Status/Fit Tier — Pipeline row essentially empty"
  severity: blocker
  test: 3
  artifacts: []
  missing: []
