---
phase: 03-scanner-workflows-migration
verified: 2026-06-10T18:30:00Z
status: passed
score: 16/16 must-haves verified
overrides_applied: 0
gaps: []
deferred:
  - truth: "All 4 scanners produce identical output to pre-migration Airtable-based runs"
    addressed_in: "Phase 8"
    evidence: "VER-01: All 8 workflows execute end-to-end against NocoDB with identical output"
---

# Phase 3: Scanner Workflows Migration Verification Report

**Phase Goal:** All 4 scanner workflows (Greenhouse, Ashby, Lever, JobSpy) read/write to NocoDB instead of Airtable, producing identical results

**Verified:** 2026-06-10T18:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

The phase goal is structurally achieved. All Airtable nodes in all 4 scanner workflows have been replaced with n8n HTTP Request nodes targeting NocoDB Data API v3. The supporting NOCODB_* environment variables and credential documentation are in place. Three critical runtime bugs found during code review (CR-01, CR-02, CR-03) have been verified as fixed — all Code nodes and Set nodes reference the Unwrap transform nodes instead of the raw HTTP response nodes.

The runtime output equivalence ("identical results" per ROADMAP success criteria) is deferred to Phase 8 (VER-01), which will execute all 8 workflows end-to-end.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | D-01: All scanner workflows use n8n HTTP Request nodes (NOT native NocoDB v2 node) | ✓ VERIFIED | All 4 workflows: Get Profile, Get Tracked Companies/Get Search Queries, Get Existing Job IDs, Create Pipeline Records all use `n8n-nodes-base.httpRequest`. Zero `n8n-nodes-base.airtable` nodes remain |
| 2 | D-02: Auth via HTTP Header Auth credential 'NocoDB API' with xc-token header | ✓ VERIFIED | Every HTTP Request node has `"httpHeaderAuth"` credential type referencing `"NocoDB API"` with `"id": "TO_BE_CREATED"` (user creates credential before running) |
| 3 | D-04: NOCODB_* env vars defined in docker-compose | ✓ VERIFIED | All 6 vars present: NOCODB_URL, NOCODB_BASE_ID, NOCODB_TABLE_PROFILE, NOCODB_TABLE_COMPANIES, NOCODB_TABLE_PIPELINE, NOCODB_TABLE_QUERIES |
| 4 | Existing NOCDB_HOST and NOCDB_API_TOKEN preserved unchanged | ✓ VERIFIED | Lines 56-57: `NOCDB_API_TOKEN=REPLACE_WITH_TOKEN`, `NOCDB_HOST=http://nocodb:8080` — both unmodified |
| 5 | docker-compose credential setup documentation | ✓ VERIFIED | Comment block (lines 58-62) documents all 4 steps for creating the HTTP Header Auth credential |
| 6 | D-06: Unwrap transform nodes key on response.records (NOT response.list) | ✓ VERIFIED | All 11 Unwrap Code nodes across 4 workflows use `const records = response.records || []` |
| 7 | D-07: Column names use Title Case matching Airtable fields | ✓ VERIFIED | POST bodies use "Job ID", "Job Title", "Company", "Location", "Apply Link", "Job Description", "Source", "Source Query", "Source Tag", "Discovery Date", "Status" — all Title Case |
| 8 | D-08: Has own 'Get Profile' HTTP Request node (every scanner) | ✓ VERIFIED | Greenhouse (line 239), Ashby (line 204), Lever (line 204), JobSpy (line 166) — all have Get Profile HTTP Request node |
| 9 | D-10: Uses field projection (?fields=Job+ID) for dedup queries | ✓ VERIFIED | All 4 workflows: `Get Existing Job IDs` URL contains `?fields=Job+ID` |
| 10 | D-11: JobSpy scanner gains Get Profile + geography filtering | ✓ VERIFIED | JobSpy has new Get Profile HTTP Request (line 166) + Unwrap Profile (line 189); Parse & Filter Jobs reads `$('Unwrap Profile').first().json` with `profileData['Target Geography']` |
| 11 | Code nodes reference Unwrap nodes (not raw HTTP nodes) — REVIEW.md fix | ✓ VERIFIED | Parse & Filter Jobs → `$('Unwrap Profile')`; Deduplicate vs Pipeline → `$('Unwrap Existing Job IDs')`; Prepare Company Data + Fetch API URL → `$('Unwrap Tracked Companies')` |
| 12 | POST body uses { "fields": { ... } } wrapper | ✓ VERIFIED | All 4 Create Pipeline Records POST nodes have `jsonBody` starting with `={\n  \"fields\": {` |
| 13 | Greenhouse scanner correct where filter | ✓ VERIFIED | Get Tracked Companies URL: `where=(Enabled,is,true)~and(\"Scan Method\",eq,\"Greenhouse API\")` |
| 14 | Ashby scanner correct where filter | ✓ VERIFIED | Get Tracked Companies URL: `where=(Enabled,is,true)~and(\"Scan Method\",eq,\"Ashby API\")` |
| 15 | Lever scanner correct where filter | ✓ VERIFIED | Get Tracked Companies URL: `where=(Enabled,is,true)~and(\"Scan Method\",eq,\"Lever API\")` |
| 16 | JobSpy scanner uses Search Queries + Salary Info | ✓ VERIFIED | Get Search Queries reads from `NOCODB_TABLE_QUERIES` with `where=(Enabled,is,true)~and(\"Source Type\",eq,\"JobSpy\")`. POST body includes "Salary Info" field |

**Score:** 16/16 truths verified

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | All 4 scanners produce identical output to pre-migration Airtable-based runs | Phase 8 | VER-01: All 8 workflows execute end-to-end against NocoDB with identical output |
| 2 | Spot-check of scanner output (record counts, field values) | Phase 8 | VER-01 covers all 8 workflows; functional parity testing |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `docker-compose.example.yml` | All 6 NOCODB_* env vars + credential docs | ✓ VERIFIED | 119 lines (≥108 min), all vars present, NOCDB_* vars preserved |
| `workflows/01a-scanner-greenhouse.json` | 4 HTTP Request nodes + 3 Unwrap Code nodes, 0 Airtable | ✓ VERIFIED | 19 nodes, 0 Airtable. All REVIEW.md fixes applied |
| `workflows/01b-scanner-ashby.json` | Same pattern with Ashby API filter | ✓ VERIFIED | 17 nodes, 0 Airtable. "Ashby API" where filter. Fixes applied |
| `workflows/01c-scanner-lever.json` | Same pattern with Lever API filter | ✓ VERIFIED | 17 nodes, 0 Airtable. "Lever API" where filter. Fixes applied |
| `workflows/01d-scanner-jobspy.json` | 3 Airtable replaced + Get Profile + code edit | ✓ VERIFIED | 15 nodes, 0 Airtable. New Get Profile node. Dynamic geography. Salary Info in POST |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Triggers | Get Profile | HTTP Request output | ✓ WIRED | Manual + Schedule triggers connect to Get Profile in all 4 workflows |
| Get Profile (HTTP) | Unwrap Profile (Code) | output connection | ✓ WIRED | Verified in all 4 workflows |
| Unwrap Profile | Get Tracked Companies / Get Search Queries | output connection | ✓ WIRED | Greenhouse/Ashby/Lever connect to Get Tracked Companies; JobSpy to Get Search Queries |
| Get Tracked Companies / Get Search Queries | Unwrap Tracked Companies / Unwrap Search Queries | output connection | ✓ WIRED | Verified |
| Unwrap Tracked Companies / Unwrap Search Queries | Loop Companies / Build Batch Payload | output connection | ✓ WIRED | Verified |
| Unwrap Profile | Parse & Filter Jobs | `$('Unwrap Profile')` reference | ✓ WIRED | All 4 workflows read `$('Unwrap Profile').first().json` |
| Aggregate All Jobs | Get Existing Job IDs | output connection | ✓ WIRED | Verified |
| Get Existing Job IDs | Unwrap Existing Job IDs | output connection | ✓ WIRED | Verified |
| Unwrap Existing Job IDs | Deduplicate vs Pipeline | `$('Unwrap Existing Job IDs')` reference | ✓ WIRED | All 4 workflows read `$('Unwrap Existing Job IDs').all()` |
| If (true branch) | Create Pipeline Records | output connection | ✓ WIRED | Verified |
| $env.NOCODB_* vars | All HTTP Request nodes | expression reference | ✓ WIRED | 16 references across 4 workflows, all using `$env.NOCODB_*` pattern |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| Parse & Filter Jobs | `profileData['Target Geography']` | `$('Unwrap Profile')` → HTTP GET Profile → NocoDB | ✓ FLOWING | Unwrap Profile flattens `record.fields`; dynamic geography reads Target Geography correctly |
| Prepare Company Data | `apiEndpoint` | `$('Unwrap Tracked Companies')` → HTTP GET Companies → NocoDB | ✓ FLOWING | Flat items from Unwrap provide `['API Endpoint']` directly |
| Deduplicate vs Pipeline | `existingRecords['Job ID']` | `$('Unwrap Existing Job IDs')` → HTTP GET Pipeline → NocoDB | ✓ FLOWING | Unwrap flattens `record.fields['Job ID']` into `json['Job ID']` |
| Create Pipeline Records | POST body fields | Code node output → NocoDB | ✓ FLOWING | `{ "fields": { ... } }` format with 11+ columns sourced from Code node `$json.*` |

### Behavioral Spot-Checks

No runnable behavioral checks — these are n8n workflow JSON files requiring a live n8n instance. Runtime verification deferred to Phase 8.

Step 7b: SKIPPED (no runnable entry points — n8n workflows require the n8n runtime)

### Probe Execution

No probes were declared for this phase. Phase 3 is a workflow JSON migration phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SCAN-01 | 03-02 | Replace Airtable nodes in Greenhouse scanner (1a) | ✓ SATISFIED | 0 Airtable nodes; 4 HTTP Request + 3 Unwrap Code nodes; where filter with Greenhouse API |
| SCAN-02 | 03-03 | Same replacement for Ashby scanner (1b) | ✓ SATISFIED | 0 Airtable nodes; Ashby API where filter; same pattern |
| SCAN-03 | 03-04 | Same replacement for Lever scanner (1c) | ✓ SATISFIED | 0 Airtable nodes; Lever API where filter; same pattern |
| SCAN-04 | 03-05 | Same replacement for JobSpy scanner (1d) including Search Queries | ✓ SATISFIED | 0 Airtable nodes; Get Search Queries from `NOCODB_TABLE_QUERIES` with `Source Type=JobSpy` filter; Salary Info in POST |

All 4 requirement IDs accounted for. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `workflows/01d-scanner-jobspy.json` | 75 | Stale TODO comment (`// TODO: Read from Profile.Target Geography in v1.1`) | ⚠️ Warning | Code below this comment already implements the TODO (reads geography dynamically from Profile). The TODO is stale and misleading. REVIEW.md explicitly asked for its removal but it was left in. Not a functional blocker — code works correctly. |
| All workflows | - | `TO_BE_CREATED` credential IDs | ℹ️ Info | Intentional placeholder — user creates the "NocoDB API" credential in n8n UI before running. Same pattern as all HTTP Header Auth credentials in n8n. |
| All workflows | - | `[Description not available]` in Merge Descriptions / Parse code | ℹ️ Info | Legitimate fallback text for missing job descriptions, not a stub. Pre-existing behavior preserved. |

**Debt marker gate:** No `TBD`, `FIXME`, or `XXX` markers found. The one `TODO` is a warning-level cleanup, not a blocker.

### Human Verification Required

None for this phase. All structural verifications are complete via code inspection. Runtime behavioral verification (identical output) is deferred to Phase 8.

### Gaps Summary

**No blocking gaps found.** All 16 must-have truths are verified against the actual codebase.

**Minor issue (not a blocker):** A stale TODO comment remains in `workflows/01d-scanner-jobspy.json` line 75 (`// TODO: Read from Profile.Target Geography in v1.1`). The code below it correctly reads geography from Profile — the TODO is left over from pre-migration and should have been removed during the REVIEW.md fix. It does not affect functionality.

### Summary of Key Verification Points

- **0 Airtable nodes remaining** across all 4 scanner workflows ✓
- **16 HTTP Request nodes** (4 per workflow) all using correct NocoDB Data API v3 endpoints ✓
- **11 Unwrap Code nodes** across all workflows, all using `response.records` ✓
- **3 critical bugs** from code review (CR-01, CR-02, CR-03) **verified as fixed** — all Code nodes and Set nodes reference Unwrap nodes ✓
- **6 NOCODB_* env vars** in docker-compose with credential docs, NOCDB_* vars preserved ✓
- **All connection chains verified** end-to-end for all 4 workflows ✓
- **4 requirement IDs** (SCAN-01, SCAN-02, SCAN-03, SCAN-04) all satisfied ✓
- **1 warning:** stale TODO comment in JobSpy (non-blocking)

---

_Verified: 2026-06-10T18:30:00Z_
_Verifier: the agent (gsd-verifier)_
