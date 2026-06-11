---
status: testing
phase: 05-tailor-workflow-attachments-migration
source: [05-01-SUMMARY.md]
started: 2026-06-11T12:00:00Z
updated: 2026-06-11T12:00:00Z
---

## Current Test

number: 1
name: No Airtable Nodes Remain
expected: |
  Workflow 03-tailor.json contains zero `n8n-nodes-base.airtable` nodes — all reads, uploads, and updates use NocoDB HTTP nodes
awaiting: user response

## Tests

### 1. No Airtable Nodes Remain
expected: Workflow 03-tailor.json contains zero `n8n-nodes-base.airtable` nodes — all reads, uploads, and updates use NocoDB HTTP nodes
result: [pending]

### 2. Profile Read from NocoDB
expected: HTTP GET node "Get Profile" reads from NocoDB via `$env.NOCODB_TABLE_PROFILE` URL, followed by "Unwrap Profile" Code node that maps `records[].fields` to flat items with `executeOnce` upstream
result: [pending]

### 3. Pipeline Read with High Fit Filter
expected: HTTP GET node "Get High Fit Jobs" reads Pipeline with filter for Status=Evaluated, Fit Tier=High, and blank Tailored CV Text using `(is,blank)` syntax; followed by "Unwrap High Fit Jobs" Code node exposing `id` as string UUID
result: [pending]

### 4. Code Node References Updated
expected: "Build Tailoring Prompt" references `$('Unwrap Profile')` and `$('Unwrap High Fit Jobs')` instead of old Airtable GET nodes; filters `_empty` sentinel jobs
result: [pending]

### 5. Record ID Uses NocoDB String UUID
expected: Build Tailoring Prompt threads `job.json.id` as `_recordId` (string UUID); Parse Tailored CV reads `loopItem._recordId` for PATCH target
result: [pending]

### 6. Convert to File and Upload DOCX Chain
expected: Workflow contains "Convert to File" node after "Render DOCX" (docx_base64 → binary), then "Upload DOCX" multipart POST to `/api/v2/storage/upload` with `continueOnFail: true`
result: [pending]

### 7. Update Pipeline Record v3 PATCH
expected: "Update Pipeline Record" HTTP PATCH sends `{ id: string, fields: { Tailored CV Text, CV Tailoring Cost, Tailored CV? } }` to NocoDB v3 API with defensive attachmentArray extraction from upload response
result: [pending]

### 8. Runtime — NocoDB Reads Execute Correctly (TAIL-01)
expected: Execute "JobSignal - Workflow 3 - Tailor" in n8n with ≥1 Evaluated+High Fit job (blank Tailored CV Text). Unwrap Profile shows flat Profile fields; Unwrap High Fit Jobs shows only matching jobs with string UUID `id`
result: [pending]

### 9. Runtime — DOCX Upload Chain Succeeds (TAIL-02)
expected: Trace Parse Tailored CV → Render DOCX (docx_base64 present) → Convert to File (binary data) → Upload DOCX (HTTP 200, array with url) → Update Pipeline Record (PATCH 200, body includes Tailored CV when upload succeeded)
result: [pending]

### 10. Runtime — NocoDB UI Attachment Preview and Download (TAIL-03)
expected: Open tailored Pipeline record in NocoDB UI — Tailored CV Text populated, Tailored CV attachment shows DOCX with working preview and download
result: [pending]

### 11. Runtime — Graceful Degradation on Upload Failure (D-06)
expected: With upload URL broken or storage unavailable, Upload DOCX fails but PATCH still saves Tailored CV Text and CV Tailoring Cost without blocking the workflow
result: [pending]

### 12. Runtime — Empty State When No Untailored Jobs
expected: When all High Fit jobs already have Tailored CV Text, Unwrap High Fit Jobs returns `_empty` sentinel and workflow completes without errors
result: [pending]

## Summary

total: 12
passed: 0
issues: 0
pending: 12
skipped: 0
blocked: 0

## Gaps

[none yet]
