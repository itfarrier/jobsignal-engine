---
phase: 03-scanner-workflows-migration
plan: 02
status: complete
tasks: 2/2
wave: 2
auto_mode: inherit
---

# Summary — Plan 03-02: Greenhouse Scanner (Reference Pattern)

## What Was Built

Replaced all 4 Airtable nodes in `workflows/01a-scanner-greenhouse.json` with NocoDB Data API v3 HTTP Request nodes + 3 Unwrap Code nodes.

### Task 1: Get Profile & Get Tracked Companies

- **Get Profile** (Airtable → HTTP GET) + new **Unwrap Profile** Code node
- **Get Tracked Companies** (Airtable → HTTP GET) with `where=(Enabled,is,true)~and("Scan Method",eq,"Greenhouse API")` + new **Unwrap Tracked Companies** Code node
- Connection: Trigger → Get Profile → Unwrap Profile → Get Tracked Companies → Unwrap Tracked Companies → Loop Companies

### Task 2: Get Existing Job IDs & Create Pipeline Records

- **Get Existing Job IDs** (Airtable → HTTP GET) with `?fields=Job+ID` projection + new **Unwrap Existing Job IDs** Code node
- **Create Pipeline Records** (Airtable → HTTP POST) with `{ "fields": { ... } }` body (11 columns)
- Connection: Aggregate → Get Existing Job IDs → Unwrap Existing Job IDs → Deduplicate → If → Create Records

## Deviations

None.

## Verification Results

| Check | Result |
|-------|--------|
| All 4 Airtable nodes replaced | ✓ (0 remaining) |
| 3 Unwrap Code nodes created | ✓ |
| `response.records` used in all unwraps | ✓ |
| Correct where filter (Greenhouse API) | ✓ |
| `?fields=Job+ID` projection | ✓ |
| POST `{ "fields": { ... } }` body | ✓ |
| Connection chains correct | ✓ |
| retryOnFail/maxTries/waitBetweenTries on GETs | ✓ |
| continueOnFail on POST only | ✓ |

## Key Files

created:
  - workflows/01a-scanner-greenhouse.json (modified — reference pattern for all scanners)

## Self-Check: PASSED
