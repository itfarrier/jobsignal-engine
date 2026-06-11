---
status: testing
phase: 04-evaluator-workflow-migration
source: [04-01-SUMMARY.md]
started: 2026-06-10T21:51:00Z
updated: 2026-06-10T21:51:00Z
---

## Current Test

number: 1
name: No Airtable Nodes Remain
expected: |
  Workflow 02-evaluator.json contains zero `n8n-nodes-base.airtable` nodes
awaiting: user response

## Tests

### 1. No Airtable Nodes Remain
expected: Workflow 02-evaluator.json contains zero `n8n-nodes-base.airtable` nodes
result: [pending]

### 2. Profile Read from NocoDB
expected: HTTP GET node "Get Profile" reads from NocoDB via `$env.NOCODB_TABLE_PROFILE` URL, followed by "Unwrap Profile" Code node that maps `records[].fields` to flat items
result: [pending]

### 3. Pipeline Read with Status Filter
expected: HTTP GET node "Get New Jobs" reads from NocoDB Pipeline table with `?where=(Status,eq,New)&limit=5`, followed by "Unwrap New Jobs" Code node
result: [pending]

### 4. Code Node References Updated
expected: All Code nodes reference `$('Unwrap Profile')` and `$('Unwrap New Jobs')` instead of old `$('Get Profile')` and `$('Get New Jobs')` — zero old references remain
result: [pending]

### 5. Record ID Uses NocoDB String UUID
expected: Parse AI Response Code node uses `loopItem.id` (NocoDB string UUID) instead of `loopItem._airtableRecordId || loopItem.id`
result: [pending]

### 6. If Condition Uses Parse AI Response
expected: If node condition uses `$('Parse AI Response').item.json.fields['Fit Tier']` instead of `$json.fields['Fit Tier']`
result: [pending]

### 7. Scoring PATCH Writes to Pipeline
expected: "Update Job Record" HTTP PATCH sends `{ id: string, fields: { Status, Fit Score, Fit Tier, ... } }` to NocoDB Pipeline table; has retryOnFail, no continueOnFail
result: [pending]

### 8. Interview Prep PATCH Writes to Pipeline
expected: "Update Interview Prep" HTTP PATCH sends `{ id: string, fields: { Interview Questions, STAR Responses, ... } }` to NocoDB Pipeline table; no retryOnFail (graceful degradation)
result: [pending]

### 9. Resend Email Node Uses Unwrap Variants
expected: Resend email node references `$('Unwrap New Jobs')` for job details and `$('Parse AI Response')` for score; no old `$('Get New Jobs')` references
result: [pending]

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0

## Gaps

[none yet]
