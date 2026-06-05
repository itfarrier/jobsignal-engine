---
phase: 02-hh-ru-description-enrichment
reviewed: 2026-06-05T21:00:00Z
depth: deep
files_reviewed: 4
files_reviewed_list:
  - fixtures/hh-vacancy-page-sample.html
  - scripts/test_hh_vacancy_parse.mjs
  - workflows/01e-scanner-hhru.json
  - docs/SETUP.md
findings:
  critical: 1
  warning: 5
  info: 2
  total: 8
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-06-05T21:00:00Z  
**Depth:** deep  
**Files Reviewed:** 4  
**Status:** issues_found

## Summary

Phase 02 adds vacancy-page description enrichment via offline parse tests (`test_hh_vacancy_parse.mjs`), a representative HTML fixture, and a per-job fetch loop in `01e-scanner-hhru.json`. Extraction logic (JSON-LD → `data-qa` → RSS fallback), `stripHtml` sanitization, and the 50k cap are implemented consistently between the test script and the Merge Descriptions node. Both parse test scripts pass.

The primary defect is **incomplete SSRF mitigation (T-02-02)**: the URL whitelist runs in Merge Descriptions *after* Fetch Vacancy Page has already issued the HTTP request to `$json.applyLink`. A tampered RSS `link` can still trigger outbound requests to non-whitelisted hosts before the guard discards the response. Secondary concerns include empty-description edge cases when extraction succeeds but `stripHtml` yields no text, brittle JSON-LD/`data-qa` matching, and logic duplication across three Code nodes.

Threat-model items T-02-01 (stripHtml + cap), T-02-03 (pacing/timeout), and T-02-04 (log disclosure, accepted) are otherwise addressed as designed.

## Critical Issues

### CR-01: SSRF guard runs after HTTP fetch (T-02-02)

**File:** `workflows/01e-scanner-hhru.json:179-213` (Fetch Vacancy Page), `workflows/01e-scanner-hhru.json:212-213` (Merge Descriptions guard)

**Issue:** Fetch Vacancy Page uses `url: "={{ $json.applyLink }}"` with no validation. The whitelist `^https://hh.ru/vacancy/\d+` is checked only inside Merge Descriptions, after the request completes. Research Pitfall 4 and Plan 02-02 Task 2 both require validating the URL **before** fetch. A malicious or tampered RSS `link` (e.g. `https://169.254.169.254/`, `https://internal.service/`) is still requested by n8n; the guard only prevents using the response body.

**Fix:** Gate the fetch with an IF node (or equivalent) on `applyLink` before Fetch Vacancy Page, and wire the false branch directly to Merge Descriptions with RSS fallback:

```javascript
// IF node condition (expression):
{{ /^https:\/\/hh\.ru\/vacancy\/\d+(?:\?.*)?$/.test($json.applyLink || '') }}

// True branch  → Fetch Vacancy Page → Merge Descriptions
// False branch → Merge Descriptions (skip fetch; Merge already handles rssFallback)
```

Tighten the regex with a `$` end anchor to reject path-suffix tricks like `https://hh.ru/vacancy/123/evil`.

## Warnings

### WR-01: Empty stripped page text discards RSS fallback

**File:** `scripts/test_hh_vacancy_parse.mjs:76-78`, `workflows/01e-scanner-hhru.json` (Merge Descriptions jsCode, merge branch)

**Issue:** Merge uses `extractedHtml ? stripHtml(extractedHtml) : rssFallback`. When extraction returns markup that strips to an empty string (e.g. `<p></p>`, whitespace-only JSON-LD), the job is written with an empty `jobDescription` and `_descriptionSource: 'page'` even though a usable RSS summary exists. Verified: `mergeVacancyDescription('<div data-qa="vacancy-description"><div><p></p></div></div>', 'rss fb')` returns `""`.

**Fix:** Fall back when stripped text is empty:

```javascript
const extractedHtml = extractVacancyDescriptionHtml(rawHtml);
const stripped = extractedHtml ? stripHtml(extractedHtml) : '';
let jobDescription = stripped || rssFallback;
let _descriptionSource = stripped ? 'page' : 'rss';
```

Mirror the same change in `mergeVacancyDescription` and add a test case.

### WR-02: URL whitelist lacks strict end anchor

**File:** `workflows/01e-scanner-hhru.json` (Merge Descriptions jsCode)

**Issue:** Pattern `^https://hh.ru/vacancy/\d+` matches prefixes only. URLs such as `https://hh.ru/vacancy/123/unexpected-path` pass the guard. While hh.ru RSS links are canonical, defense-in-depth should reject non-canonical paths.

**Fix:** Use `^https://hh\.ru/vacancy/\d+(?:\?[^#]*)?(?:#.*)?$` or, minimally, append `$` after the vacancy ID: `^https:\/\/hh\.ru\/vacancy\/\d+$`.

### WR-03: `_empty` sentinel items still hit Fetch Vacancy Page

**File:** `workflows/01e-scanner-hhru.json:891-908` (Loop Over Jobs → Fetch connection)

**Issue:** When Parse & Filter Jobs returns `{ _empty: true }`, the job loop still routes the item to Fetch Vacancy Page with an undefined `applyLink`, causing a pointless (and potentially noisy) HTTP error before Merge passes the item through.

**Fix:** Add an IF node after Loop Over Jobs batch output: `{{ !$json._empty && $json.applyLink }}` → true to Fetch, false directly to Merge Descriptions or loop continue.

### WR-04: JSON-LD extractor misses common schema.org variants

**File:** `scripts/test_hh_vacancy_parse.mjs:57-62`, `workflows/01e-scanner-hhru.json` (Merge Descriptions, mirrored logic)

**Issue:** Extraction only matches `item['@type'] === 'JobPosting'`. It fails for `@graph` wrappers, `@type: ["JobPosting"]`, and `@type: "https://schema.org/JobPosting"` (all verified empty in offline probes). Live hh.ru pages currently use flat `"@type":"JobPosting"` (verified 2026-06-05 on vacancy 133572268), so this is not breaking today but is fragile if hh.ru changes JSON-LD shape.

**Fix:** Normalize type and walk `@graph`:

```javascript
const isJobPosting = (item) => {
  if (!item) return false;
  const t = item['@type'];
  const types = Array.isArray(t) ? t : [t];
  return types.some((x) => x === 'JobPosting' || x === 'https://schema.org/JobPosting');
};
// After JSON.parse, also flatten: const items = data['@graph'] ? data['@graph'] : postings;
```

### WR-05: `stripHtml` duplicated in three Code nodes — drift risk

**File:** `workflows/01e-scanner-hhru.json` (Parse & Filter Jobs, Merge Descriptions), `scripts/test_hh_vacancy_parse.mjs:18-48`

**Issue:** Identical `stripHtml` is inlined in Parse & Filter Jobs, Merge Descriptions, and the test script (plus `test_hh_rss_parse.mjs`). Future fixes to entity decoding or tag stripping must be applied in four places; any miss causes RSS parse and page enrichment to diverge.

**Fix:** Document a single canonical source (`scripts/test_hh_vacancy_parse.mjs`) in a workflow comment and add a CI grep/assertion that Merge and Parse `stripHtml` bodies match the test export (or extract shared logic when n8n supports it).

## Info

### IN-01: `data-qa` fallback regex assumes fixed two-level `</div>` nesting

**File:** `scripts/test_hh_vacancy_parse.mjs:69-71`

**Issue:** Pattern `data-qa="vacancy-description"[^>]*>([\s\S]*?)</div>\s*</div>` can truncate early or miss content when the live page adds extra wrapper divs inside the description block. JSON-LD is primary on current hh.ru pages, so impact is limited to fallback-only scenarios.

**Fix:** Prefer a more tolerant extractor (e.g. match until the closing tag of the `data-qa` element via a balanced-div walk, or anchor on a secondary `data-qa` child marker).

### IN-02: Test harness collapses all assertion failures into one error

**File:** `scripts/test_hh_vacancy_parse.mjs:97-154`

**Issue:** A single `try/catch` around all six tests reports only the first failure. This slows diagnosis when multiple regressions occur.

**Fix:** Run each test in its own try/catch and collect all error messages before exiting.

---

_Reviewed: 2026-06-05T21:00:00Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: deep_
