# Phase 5: Tailor Workflow & Attachments Migration - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace 2 Airtable read nodes (Get High Fit Jobs, Get Profile), 1 Airtable update node (Update Pipeline Record), and 1 Airtable content upload (HTTP Request to `content.airtable.com`) in `workflows/03-tailor.json` with NocoDB HTTP Request + Unwrap nodes. Adapt DOCX attachment upload from Airtable's content API to NocoDB's `/api/v2/storage/upload` endpoint. AI tailoring logic, DOCX rendering, the Loop Over Jobs splitInBatches, Wait 2s node, and schedule trigger remain unchanged. Only the database backend is swapped.

Requirements: TAIL-01, TAIL-02, TAIL-03

</domain>

<decisions>
## Implementation Decisions

### NocoDB Storage Upload Flow
- **D-01:** Use **two separate nodes** for the attachment upload: an "Upload DOCX" HTTP Request node (multipart POST to `/api/v2/storage/upload`), followed by a single combined PATCH node. The upload response array feeds into the PATCH.
- **D-02:** Configure the upload HTTP Request node with **n8n binary data mode** — multipart/form-data with `file` field. The Render DOCX node returns base64; the HTTP Request node's binary handling converts it. NocoDB's `/api/v2/storage/upload` requires multipart (confirmed by NocoDB docs and n8n community threads).
- **D-03:** Use a **single combined HTTP PATCH** node to update `Tailored CV Text`, `CV Tailoring Cost`, and `Tailored CV` (attachment array) together after successful upload. Matches the existing Airtable pattern (one "Update Pipeline Record" node).

### Empty String Filter for Tailored CV Text
- **D-04:** Filter for untailored jobs using NocoDB `(is,blank)` syntax: `?where=(Status,eq,Evaluated)~and(Fit%20Tier,eq,High)~and(Tailored%20CV%20Text,is,blank)`. The `blank` operator catches both empty string and NULL. The `(is,null)` operator does not work correctly in NocoDB v3 for text fields (treated as string literal).

### Record ID from NocoDB
- **D-05:** The Unwrap nodes expose NocoDB's string UUID `record.id` (not the auto-increment integer `Id`). "Build Tailoring Prompt" and "Parse Tailored CV" Code nodes thread `job.json.id` as `_recordId` for PATCH operations. Supersedes original D-05 wording — Phase 4 research proved v3 PATCH requires string `id`, not integer `Id`.

### Graceful Degradation
- **D-06:** If the NocoDB storage upload fails, the PATCH node still updates `Tailored CV Text` and `CV Tailoring Cost` — the markdown text is the primary output, the DOCX is convenience. Follows the existing codebase graceful degradation pattern (interview prep failures store error instead of crashing).

### Carry-Forward Decisions (Phase 3 & 4)
- Use n8n HTTP Request nodes calling NocoDB Data API v3 (not native NocoDB node) — Phase 3 D-01
- Authenticate via `xc-token` header — Phase 3 D-02
- NocoDB URL and table IDs via env vars: `NOCODB_URL`, `NOCODB_BASE_ID`, `NOCODB_TABLE_PROFILE`, `NOCODB_TABLE_PIPELINE` — Phase 3 D-03/D-04
- Unwrap Code/Set node after each NocoDB HTTP GET to flatten `{ list: [...] }` response — Phase 3 D-06
- Title Case column names matching Airtable fields — Phase 3 D-07
- URL query parameter filter syntax: `?where=(Status,eq,Evaluated)` — Phase 4 D-03
- Node naming: "Get High Fit Jobs" + "Unwrap High Fit Jobs" pattern — Phase 4 D-02
- All Code node `$('Get X')` references updated to `$('Unwrap X')` — Phase 4 D-02

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — Requirements TAIL-01, TAIL-02, TAIL-03 (read Profile + Pipeline, storage upload, verify attachment)
- `.planning/ROADMAP.md` — Phase 5 goal, success criteria (4 items), depends-on Phase 4
- `.planning/PROJECT.md` — Key decisions (in-place node replacement, cutover migration, NocoDB env vars)

### Prior Phase Decisions
- `.planning/phases/04-evaluator-workflow-migration/04-CONTEXT.md` — Phase 4: NocoDB Id field (D-01), node naming (D-02), filter syntax (D-03), PATCH split (D-04), code node record ID flow (D-05)
- `.planning/phases/03-scanner-workflows-migration/03-CONTEXT.md` — Phase 3: HTTP Request nodes not native NocoDB node (D-01), xc-token auth (D-02), Unwrap pattern (D-06), Title Case columns (D-07), env vars (D-03/D-04)
- `.planning/phases/01-infrastructure-bootstrap/01-CONTEXT.md` — NocoDB port 8080, env var conventions, API token

### Tailor Workflow (source to modify)
- `workflows/03-tailor.json` — The tailor workflow with 4 Airtable nodes to replace, code node record ID flow, DOCX render + upload pipeline

### NocoDB API References
- NocoDB Data API v3 Swagger: `https://data-apis-v3.nocodb.com/` — Record CRUD endpoints (GET, PATCH for Pipeline records)
- NocoDB Meta API v3 Swagger: `https://meta-apis-v3.nocodb.com/` — Table/field discovery if needed
- NocoDB Upload via API: `https://docs.nocodb.com/developer-resources/rest-apis/upload-via-api/` — Storage upload expects multipart/form-data with `file` field, returns attachment array

### Schema
- `airtable/AIRTABLE-SCHEMA.md` — Pipeline table field types, select options to match Title Case column names in NocoDB

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `workflows/01a-scanner-greenhouse.json` — Reference pattern for NocoDB HTTP Request + Unwrap Code node flow (Phase 3 pattern)
- `.planning/phases/04-evaluator-workflow-migration/04-CONTEXT.md` — Phase 4 decisions (Id field, filter syntax, PATCH approach) that directly apply

### Established Patterns
- HTTP Request nodes with `xc-token` header auth targeting NocoDB Data API v3
- Unwrap Code/Set node after each NocoDB HTTP GET: `{ list: [...] }` → flat items
- Title Case column names matching Airtable field names (no renaming needed)
- Env vars via docker-compose: `NOCODB_URL`, `NOCODB_BASE_ID`, `NOCODB_TABLE_PROFILE`, `NOCODB_TABLE_PIPELINE`
- Graceful degradation: failures in downstream steps store error instead of crashing
- Record ID threaded as `_recordId` through Code nodes (Build Tailoring Prompt → Parse Tailored CV)

### Integration Points
- 2 Airtable read nodes replaced with HTTP GET + Unwrap: "Get High Fit Jobs", "Get Profile"
- 1 Airtable update node replaced with HTTP PATCH: "Update Pipeline Record"
- 1 Airtable content upload replaced with HTTP POST to NocoDB storage + combined PATCH
- Build Tailoring Prompt Code node: `loopItem['Id']` replaces `loopItem._recordId`
- All Code node `$('Get X')` references updated to `$('Unwrap X')`
- Render DOCX node unchanged — still calls `http://cv-renderer:3456/render`
- The upload node consumes the Render DOCX response (base64) and sends as multipart binary

</code_context>

<specifics>
## Specific Ideas

- The Render DOCX node returns `{ docx_base64, filename, mime_type }`. The upload HTTP Request node sends the DOCX as multipart/form-data with `file` field
- After successful upload, the combined PATCH node sets: `Tailored CV Text` = tailoredCV, `CV Tailoring Cost` = cost, `Tailored CV` = [upload response array]
- If upload fails: PATCH only `Tailored CV Text` + `CV Tailoring Cost` (no attachment array) — CV markdown preserved
- The "Loop Over Jobs" splitInBatches structure, "Wait 2s" rate limiting, and "Schedule Trigger" stay unchanged
- The "HTTP Request" node (currently named for Airtable content upload) should be renamed to "Upload DOCX" for clarity

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 5-Tailor Workflow & Attachments Migration*
*Context gathered: 2026-06-10*
