---
status: diagnosed
phase: 02-hh-ru-description-enrichment
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-VERIFICATION.md]
started: 2026-06-05T22:00:00Z
updated: 2026-06-05T22:25:00Z
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
  root_cause: "scripts/test_hh_rss_parse.mjs line 103 unconditionally logs JSON.stringify(parsed) on success path"
  artifacts:
    - path: "scripts/test_hh_rss_parse.mjs"
      issue: "Debug console.log(JSON.stringify(parsed, null, 2)) after OK line"
  missing:
    - "Remove success-path JSON dump to match test_hh_vacancy_parse.mjs contract"
  debug_session: ".planning/debug/hh-rss-extra-json-output.md"

- truth: "Re-import workflows/01e-scanner-hhru.json in n8n and execute manually against enabled HH RSS feeds. New Pipeline rows with Source=hh.ru have Job Description substantially longer than RSS summary (~500+ chars for typical vacancies), readable plain text with no HTML tags."
  status: failed
  reason: "User reported: Create Pipeline Records received input with thin RSS jobDescription and _descriptionSource=rss; Airtable output shows Source=LinkedIn with only Status/Fit Tier — Pipeline row essentially empty"
  severity: blocker
  test: 3
  root_cause: "Confirmed: Fetch Vacancy Page swallows HTTP errors (continueRegularOutput) — error objects lack data/body so Merge falls back to RSS (_descriptionSource=rss). Parse logic works (3639 chars via curl). Source=LinkedIn + Fit Tier likely a pre-existing JobSpy row evaluated by WF02, not a successful 01e create — re-verify rows with Job ID suffix -hhr and Source=hh.ru. Still add hh.ru to Pipeline.Source per schema pre-flight (02-05)."
  artifacts:
    - path: "workflows/01e-scanner-hhru.json"
      issue: "Merge reads fetchResult.data||body — empty on fetch error-continue; needs fetch diagnostics and possibly browser-like headers/redirect handling"
    - path: "airtable/AIRTABLE-SCHEMA.md"
      issue: "Requires manual Pipeline.Source hh.ru option — user base likely not configured"
    - path: "docs/SETUP.md"
      issue: "Missing explicit pre-flight check for hh.ru Source option and n8n schema refresh before first 01e run"
  missing:
    - "Inspect Fetch Vacancy Page node output in n8n execution to confirm empty body vs parse miss"
    - "Add hh.ru to Pipeline.Source in user's Airtable base"
    - "Refresh Create Pipeline Records field schema in n8n after Airtable changes"
    - "Harden Fetch node (redirects, response property, error logging) so enrichment succeeds when HTML is available"
  debug_session: ".planning/debug/phase02-uat-test3-enrich.md"
