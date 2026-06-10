---
phase: 03-scanner-workflows-migration
plan: 04
status: complete
tasks: 2/2
wave: 2
auto_mode: inherit
---

# Summary — Plan 03-04: Lever Scanner Migration

## What Was Built

Replaced all 4 Airtable nodes in `workflows/01c-scanner-lever.json` with NocoDB Data API v3 HTTP Request nodes + 3 Unwrap Code nodes. Identical to Greenhouse reference pattern with "Lever API" where filter.

- **Get Profile** → HTTP GET + **Unwrap Profile**
- **Get Tracked Companies** → HTTP GET with `where=(Enabled,is,true)~and("Scan Method",eq,"Lever API")` + **Unwrap Tracked Companies**
- **Get Existing Job IDs** → HTTP GET with `?fields=Job+ID` + **Unwrap Existing Job IDs**
- **Create Pipeline Records** → HTTP POST with `{ "fields": { ... } }` body

## Deviations

None.

## Self-Check: PASSED
