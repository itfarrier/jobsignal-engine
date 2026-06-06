---
status: diagnosed
trigger: "Diagnose UAT gap for Phase 02 test 2 (minor issue). Run node scripts/test_hh_rss_parse.mjs should exit 0 with only OK message but user sees extra JSON."
created: 2026-06-06T00:00:00Z
updated: 2026-06-06T00:00:00Z
goal: find_root_cause_only
---

## Current Focus

hypothesis: test_hh_rss_parse.mjs main() unconditionally logs parsed result via JSON.stringify after OK line
test: read script main() and run script to observe stdout
expecting: stdout contains OK line plus JSON with company/region/salaryInfo
next_action: compare with test_hh_vacancy_parse.mjs pattern and confirm root cause

## Symptoms

expected: Run `node scripts/test_hh_rss_parse.mjs` exits 0 with only `OK: hh.ru RSS parse fixture passed` message
actual: User sees OK message PLUS extra JSON object (company, region, salaryInfo)
errors: none (exit 0)
reproduction: Run `node scripts/test_hh_rss_parse.mjs` from repo root
started: Phase 02 UAT test 2

## Eliminated

## Evidence

- timestamp: 2026-06-06
  checked: scripts/test_hh_rss_parse.mjs lines 102-103
  found: main() calls console.log('OK...') then console.log(JSON.stringify(parsed, null, 2))
  implication: extra JSON is intentional script output, not parser bug or stderr leak

- timestamp: 2026-06-06
  checked: node scripts/test_hh_rss_parse.mjs
  found: stdout is OK line followed by {"company":"Визионеро","region":"Санкт-Петербург","salaryInfo":"до 140 000 ₽"}; exit 0
  implication: reproduces user report exactly

- timestamp: 2026-06-06
  checked: scripts/test_hh_vacancy_parse.mjs line 161
  found: success path logs only OK line, no JSON dump
  implication: UAT contract matches vacancy test; RSS test diverges

## Resolution

root_cause: scripts/test_hh_rss_parse.mjs main() unconditionally logs the parsed fixture result as formatted JSON after the success message (line 103: console.log(JSON.stringify(parsed, null, 2))), while UAT test 2 expects stdout to contain only the single OK line (matching test_hh_vacancy_parse.mjs behavior).
fix: 
verification: 
files_changed: []
