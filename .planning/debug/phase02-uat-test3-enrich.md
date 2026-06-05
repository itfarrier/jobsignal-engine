---
status: diagnosed
trigger: "Diagnose UAT gap for Phase 02 test 3 (blocker). Create Pipeline Records input had thin RSS jobDescription, _descriptionSource=rss. Airtable output shows Source=LinkedIn, only Status/Fit Tier populated."
created: 2026-06-06T00:00:00Z
updated: 2026-06-06T00:05:00Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: (A) Fetch Vacancy Page returned empty/error body in n8n so Merge fell back to RSS; (B) Airtable Pipeline.Source missing hh.ru option and/or stale n8n field schema caused partial write with Source=LinkedIn
test: curl live vacancy HTML + run extractVacancyDescriptionHtml; compare AIRTABLE-SCHEMA setup steps vs Create node mapping
expecting: Parse works on live HTML; Airtable setup gap explains Source=LinkedIn and empty row
next_action: document dual root cause

## Symptoms

expected: Live n8n run should enrich Job Description from vacancy page (~500+ chars), write Source=hh.ru to Airtable Pipeline with all job fields populated
actual: Create Pipeline Records input had thin RSS jobDescription, _descriptionSource=rss. Airtable output shows Source=LinkedIn, only Status/Fit Tier populated — Pipeline row essentially empty
errors: []
reproduction: Re-import workflows/01e-scanner-hhru.json in n8n and execute manually against enabled HH RSS feeds
started: Phase 02 UAT test 3

## Evidence

- timestamp: 2026-06-06
  checked: curl https://hh.ru/vacancy/133845957 with workflow User-Agent
  found: HTTP 200, 657KB HTML with JobPosting JSON-LD description (4295 chars extracted, 3639 stripped)
  implication: hh.ru serves parseable content; parse logic is correct — enrichment failure is upstream in n8n Fetch/Merge data path

- timestamp: 2026-06-06
  checked: Merge Descriptions jsCode in workflows/01e-scanner-hhru.json
  found: rawHtml = fetchResult.data || fetchResult.body || ''; empty → _descriptionSource='rss'
  implication: Fetch Vacancy Page likely returned empty/error item (onError: continueRegularOutput) without data/body — user should inspect Fetch node output in execution

- timestamp: 2026-06-06
  checked: airtable/AIRTABLE-SCHEMA.md lines 174-175, Create Pipeline Records node
  found: Schema doc requires manual "Pipeline → Source: add hh.ru"; workflow maps Source={{$json.source}} but user output shows Source=LinkedIn
  implication: User's Airtable base likely missing hh.ru single-select option OR n8n node schema cache is stale — invalid select coerced/defaulted

- timestamp: 2026-06-06
  checked: Create Pipeline Records output vs input
  found: Input had all job fields; output only Source/Status/Fit Tier — Fit Tier not in 01e create mapping
  implication: Partial Airtable write + possible schema mismatch between n8n cached field list and user's base column names/types

## Resolution

root_cause: Dual failure — (1) Fetch Vacancy Page in n8n returned no parseable HTML body (empty data/body on error-continue path), so Merge Descriptions correctly fell back to RSS (_descriptionSource=rss); (2) Airtable Create wrote partial record because Pipeline.Source likely lacks hh.ru option in user's base and/or n8n Airtable node field schema is out of sync with the user's table, causing Source=LinkedIn coercion and missing text field writes.
fix:
verification:
files_changed: []
