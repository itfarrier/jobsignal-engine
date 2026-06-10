---
phase: 03-scanner-workflows-migration
reviewed: 2026-06-10T18:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - docker-compose.example.yml
  - workflows/01a-scanner-greenhouse.json
  - workflows/01b-scanner-ashby.json
  - workflows/01c-scanner-lever.json
  - workflows/01d-scanner-jobspy.json
findings:
  critical: 3
  warning: 0
  info: 0
  total: 3
status: issues_found
---

# Phase 03: Code Review Report — Scanner Workflows Migration

**Reviewed:** 2026-06-10T18:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Reviewed all 4 scanner workflow JSON files (01a Greenhouse, 01b Ashby, 01c Lever, 01d JobSpy) and the docker-compose.example.yml. The NocoDB HTTP Request nodes, Unwrap Code nodes, POST body format, `where` clause syntax, credential references, and environment variable bindings are all structurally correct.

However, **3 critical runtime bugs** were found affecting all 4 scanner workflows. The root cause is the same pattern across all issues: existing Code nodes and Set node expressions reference Airtable nodes (`$('Get Profile')`, `$('Get Tracked Companies')`, `$('Get Existing Job IDs')`) which returned record data directly. After replacing these Airtable nodes with NocoDB HTTP GET + Unwrap Code node pairs, these references now return the **raw HTTP response body** (`{ records: [...], next, prev }`) instead of the flattened record items. The Unwrap nodes produce the correct flattened format, but the consuming Code nodes were never updated to read from them.

Every single scanner workflow is non-functional at runtime due to these bugs. Self-checks only validated JSON structure (node existence, connections) — not runtime behavior.

---

## Critical Issues

### CR-01: Dynamic geography reads from raw HTTP response — all 4 scanners ignore user's Target Geography

**File:** `workflows/01a-scanner-greenhouse.json:51`, `workflows/01b-scanner-ashby.json:30`, `workflows/01c-scanner-lever.json:30`, `workflows/01d-scanner-jobspy.json:75`

**Issue:** The `Parse & Filter Jobs` Code node in all 4 scanners reads Profile data via `$('Get Profile').first().json`. After migration, `$('Get Profile')` now returns the raw NocoDB HTTP response `{ records: [...], next, prev }` instead of the flattened record items that the Airtable node previously returned. Looking for `Target Geography` on the response object always returns `undefined`, so `userGeographies` always falls through to the default `['Remote Global']`. The user's geography preferences are silently ignored.

**Impact:**
- User sets `Target Geography = ['Canada', 'USA']` → geography filter uses `['Remote Global']` instead → only remote jobs pass through → in-country jobs are incorrectly filtered OUT
- For JobSpy (01d), this is a **regression**: the original code had `const userGeographies = ['Canada', 'Remote Global', 'Remote North America']` (3 geographies). After the "fix" with this bug, only `['Remote Global']` is used — Canada and Remote North America are dropped, jobs the user previously saw are now hidden.

**Root cause:** The `Parse & Filter Jobs` Code node references `$('Get Profile')` (the HTTP GET node), but should reference `$('Unwrap Profile')` (the Code node that flattens the response). The Unwrap Profile node produces `{ json: { 'Target Geography': 'Canada', ... } }` which would make `profileData['Target Geography']` work correctly.

**Fix — change all 4 scanner workflows:**

In `Parse & Filter Jobs`, change:
```javascript
// BEFORE (broken — reads raw HTTP response):
const profileData = $('Get Profile').first().json;

// AFTER (reads unwrapped fields):
const profileData = $('Unwrap Profile').first().json;
```

And update the defensive accessor (in 01a/01b/01c) from:
```javascript
const geoField = profileData.fields
  ? profileData.fields['Target Geography']
  : profileData['Target Geography'];
```
to the simpler form (already used in 01d):
```javascript
const geoField = profileData['Target Geography'];
```
(since Unwrap Profile always produces flat items, the `fields` wrapper check is unnecessary/confusing).

For 01d (JobSpy), also remove the stale TODO comment on line 75:
```
// TODO: Read from Profile.Target Geography in v1.1
```

---

### CR-02: Deduplication reads from raw HTTP response — every run re-inserts ALL jobs as duplicates

**File:** `workflows/01a-scanner-greenhouse.json:91`, `workflows/01b-scanner-ashby.json:70`, `workflows/01c-scanner-lever.json:70`, `workflows/01d-scanner-jobspy.json:88`

**Issue:** The `Deduplicate vs Pipeline` Code node in all 4 scanners reads existing Pipeline Job IDs via `$('Get Existing Job IDs').all()`. After migration, this HTTP GET node now returns `[{ json: { records: [...], next, prev } }]` — a single item wrapping the full response. The loop iterating over `existingRecords` tries `record.json.fields['Job ID']` (undefined) and `record.json['Job ID']` (undefined on the response object). No Job IDs are ever extracted, so `existingIds` is always empty. **Every single job is treated as net-new on every run.**

**Impact:** Duplicate Pipeline records accumulate rapidly. Each scanner run re-inserts up to 100 jobs (the safety brake cap). This causes downstream cascading failures:
- Duplicate AI scoring calls → wasted API costs (potentially $0.50–$2.00 per duplicate batch)
- Duplicate CV generation → wasted sidecar processing
- Duplicate email alerts → user confusion
- Pipeline table fills with duplicate records → operational chaos

**Root cause:** The Deduplicate node references `$('Get Existing Job IDs')` (HTTP GET) but should reference `$('Unwrap Existing Job IDs')` (the Code node that flattens the `records` array into individual items with `json['Job ID']`).

**Fix — change all 4 scanner workflows:**

In `Deduplicate vs Pipeline`, change:
```javascript
// BEFORE (broken — reads raw HTTP response):
const existingRecords = $('Get Existing Job IDs').all();

// AFTER (reads unwrapped items with 'Job ID' at top level):
const existingRecords = $('Unwrap Existing Job IDs').all();
```

---

### CR-03: Company data reads from raw HTTP response — scanners 1a/1b/1c completely fail in the loop

**File:** 
- `workflows/01a-scanner-greenhouse.json:30,110,116,122`
- `workflows/01b-scanner-ashby.json:89,95,101,119`
- `workflows/01c-scanner-lever.json:89,95,101,139`

**Issue:** The `Prepare Company Data` Set node (3 property expressions) and the external API fetch URL (1 URL expression) in scanners 1a, 1b, 1c all reference `$('Get Tracked Companies').item.json`. After migration, this HTTP GET node returns the raw NocoDB response `{ records: [...], next, prev }`. All field lookups (`API Endpoint`, `Company Name`, `Title Keywords`) evaluate to `undefined` on this response object.

The Set node assignments and the fetch URL all use the same defensive pattern:
```javascript
={{ $('Get Tracked Companies').item.json.fields
    ? $('Get Tracked Companies').item.json.fields['API Endpoint']
    : $('Get Tracked Companies').item.json['API Endpoint'] }}
```
The `.fields` check is `undefined` (raw response has no `fields` key), and `['API Endpoint']` is also `undefined` at the response's top level. All evaluated values are `undefined`.

**Impact:** The scanner loop breaks for EVERY company:
1. `apiEndpoint = undefined` → Fetch API URL becomes `undefined` → HTTP request fails
2. `companyName = undefined` → Parse & Filter Jobs throws `Error: Company Name missing from Prepare Company Data node.`
3. `titleKeywords = undefined` → no keyword filtering applied (though this is secondary since the task fails before reaching it)

Scanners 01a, 01b, and 01c produce zero jobs. (01d JobSpy is unaffected — it uses a different architecture without this Set node.)

**Root cause:** All expressions reference `$('Get Tracked Companies')` (HTTP GET) but should reference `$('Unwrap Tracked Companies')` (the Code node that flattens `record.fields` into top-level properties).

**Fix — change all 8 expressions in 3 workflows:**

Change every instance of:
```javascript
={{ $('Get Tracked Companies').item.json...
```
to:
```javascript
={{ $('Unwrap Tracked Companies').item.json...
```

Affected locations:

**01a-scanner-greenhouse.json:**
- Line 30: Fetch Greenhouse API URL
- Line 110: Prepare Company Data → `apiEndpoint`
- Line 116: Prepare Company Data → `companyName`
- Line 122: Prepare Company Data → `titleKeywords`

**01b-scanner-ashby.json:**
- Line 89: Prepare Company Data → `apiEndpoint`
- Line 95: Prepare Company Data → `companyName`
- Line 101: Prepare Company Data → `titleKeywords`
- Line 119: Fetch Ashby API URL

**01c-scanner-lever.json:**
- Line 89: Prepare Company Data → `apiEndpoint`
- Line 95: Prepare Company Data → `companyName`
- Line 101: Prepare Company Data → `titleKeywords`
- Line 139: Fetch Lever API URL

---

## Good: What Was Done Correctly

For completeness, the following were reviewed and found correct:

| Check | Result |
|-------|--------|
| HTTP Request node structure (method, URL, headers, auth) | ✓ Correct across all 4 workflows |
| NocoDB Data API v3 endpoint paths (`/api/v3/data/.../records`) | ✓ Matches research spec |
| `where` clause syntax (`("Field",eq,"value")~and(...)`) | ✓ Correct quoting for space-containing fields |
| POST body format (`{ "fields": { ... } }`) | ✓ Correct NocoDB v3 format |
| `TO_BE_CREATED` credential placeholders | ✓ Consistent — all nodes reference `"NocoDB API"` by name |
| `$env.NOCODB_*` references | ✓ Match docker-compose env var names |
| `?fields=Job+ID` field projection | ✓ Correct query parameter |
| `response.records` in Unwrap nodes | ✓ Matches NocoDB API v3 response format per research |
| Retry config on NocoDB GET nodes | ✓ `retryOnFail: true`, `maxTries: 3`, `waitBetweenTries: 5000` |
| `continueOnFail` on POST only | ✓ Follows research recommendation |
| No dangling references to removed Airtable nodes in connections | ✓ All connection entries reference existing nodes |
| Unwrap Code node patterns (`records.map(record => ({ json: { ...record.fields, id: record.id } }))`) | ✓ Consistent across all workflows |
| Empty state handling (`_empty` sentinel) | ✓ Present in all Unwrap nodes |
| Connection chains end-to-end | ✓ All connections verified between node pairs |
| docker-compose env var completeness (6 new `NOCODB_*` vars) | ✓ Present in n8n service environment block |
| NocoDB `xc-token` credential documentation | ✓ Clear 4-step setup instructions in comments |

---

**Note on Root Cause Pattern:** All 3 critical bugs share a single root cause: the migration replaced Airtable nodes (which output record data as individual n8n items) with HTTP GET + Unwrap Code node pairs, but did not update existing `$('NodeName')` references in Code nodes and Set node expressions. These references now point at the raw HTTP response instead of the unwrapped data. The fix pattern is the same in all cases: change the node name from the HTTP GET node to the corresponding Unwrap Code node.

---

_Reviewed: 2026-06-10T18:00:00Z_
_Reviewer: gsd-code-reviewer (standard depth)_
