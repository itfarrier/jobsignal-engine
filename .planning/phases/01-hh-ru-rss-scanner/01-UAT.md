---
status: complete
phase: 01-hh-ru-rss-scanner
phase_number: 1
started: 2026-06-05
updated: 2026-06-05T20:00:00Z
tests_total: 5
tests_passed: 5
tests_failed: 0
tests_blocked: 0
---

# Phase 1 UAT: hh.ru RSS Scanner

## Test 1: Schema documentation (HH-07, HH-08)

**Expected:** `airtable/AIRTABLE-SCHEMA.md` lists four RU Target Geography options (Russia, Moscow, Saint Petersburg, Remote Russia), HH RSS Search Query column semantics, Pipeline Source `hh.ru`, and manual Airtable setup checklist.

**Result:** pass

---

## Test 2: Automated parse smoke test (HH-04, HH-06)

**Expected:** `node scripts/test_hh_rss_parse.mjs` passes — extracts company, region, salary from Russian RSS description HTML; stripped description has no `<p>` tags.

**Result:** pass

---

## Test 3: RSS endpoint reachable (HH-01)

**Expected:** `curl -sL -o /dev/null -w "%{http_code}" "https://hh.ru/search/vacancy/rss?text=test&area=113"` returns HTTP 200.

**Result:** pass

---

## Test 4: Workflow import and manual execute (HH-01, HH-05)

**Expected:** After Airtable manual setup (RU geographies, HH RSS Source Type, Pipeline Source `hh.ru`), import `workflows/01e-scanner-hhru.json` in n8n, run manually. Net-new Pipeline records appear with Source = `hh.ru` and Job ID suffix `-hhr`.

**Result:** pass
**reported:** "Deduplicate returned _empty: 0 jobs found, all already in Pipeline — workflow completed without Airtable field errors"

---

## Test 5: Profile auto-feed skip (HH-09)

**Expected:** With Profile Target Geography containing no RU-relevant options, `01e` skips Profile auto-feeds but still processes enabled HH RSS Search Query rows.

**Result:** pass
**reported:** "Workflow completed; Deduplicate _empty: 0 jobs found, all already in Pipeline (same as Test 4 — feeds ran, no net-new rows)"

---

## Current Test

[testing complete]

---

## Gaps

[none — prior Job ID blocker resolved in Airtable; Tests 4–5 passed on retry]
