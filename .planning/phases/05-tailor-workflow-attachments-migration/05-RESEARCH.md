# Phase 5: Tailor Workflow & Attachments Migration — Research

**Researched:** 2026-06-11
**Domain:** n8n workflow migration — NocoDB storage upload (v2) + Data API v3 PATCH with attachment fields
**Confidence:** HIGH

## Summary

Phase 5 replaces 4 Airtable integration points in `workflows/03-tailor.json` with NocoDB HTTP Request nodes plus Unwrap Code nodes, and adapts the DOCX attachment pipeline from Airtable's `content.airtable.com` JSON-base64 upload to NocoDB's two-step flow: `POST /api/v2/storage/upload` (multipart) → `PATCH /api/v3/data/.../records` (attachment array in `fields`).

This phase is harder than Phase 4 (Evaluator) because it introduces **mixed NocoDB API versions**: storage upload stays on **v2** (`/api/v2/storage/upload`), while record reads/writes use **Data API v3** (`/api/v3/data/{baseId}/{tableId}/records`). The upload response is a **top-level JSON array** of attachment metadata objects; that entire array is assigned to the `Tailored CV` attachment field in the PATCH body's `fields` object.

Two corrections the planner must adopt from Phase 4 research:

1. **Record ID for PATCH:** D-05 says `loopItem['Id']`, but the NocoDB v3 PATCH API requires the string UUID `record.id`, not the auto-increment integer `Id`. Unwrap nodes must expose `id: record.id`; Code nodes must use `loopItem.id` / `_recordId` carrying that string UUID — identical to the implemented Phase 4 pattern in `workflows/02-evaluator.json`.

2. **Base64 → binary before upload:** D-02 says the Upload HTTP Request node converts Render DOCX's base64 output. Community docs and n8n behavior confirm the HTTP Request multipart mode requires **binary data**, not a JSON string field. Insert a **Convert to File** node (`Move Base64 String to File`, input field `docx_base64`) between Render DOCX and Upload DOCX. This still satisfies D-02's intent (n8n native binary handling, no custom Code node for conversion).

**Primary recommendation:** One plan modifying `workflows/03-tailor.json` in sequential tasks: (1) replace 2 GET reads + add 2 Unwrap nodes + update Code references, (2) insert Convert to File + Upload DOCX nodes replacing Airtable content upload, (3) replace Update Pipeline Record with v3 PATCH including conditional attachment array for D-06 graceful degradation, (4) manual verification of attachment preview in NocoDB UI (TAIL-03).

## Project Constraints (from AGENTS.md)

| Directive | Source | How Phase 5 Complies |
|-----------|--------|----------------------|
| All 8 workflows must produce identical output after migration | AGENTS.md: Project Constraints | Tailored CV markdown, cost tracking, and DOCX attachment must match pre-migration behavior |
| Replace Airtable nodes in-place without changing workflow structure | AGENTS.md: Architecture | 4 Airtable/content nodes replaced; AI tailoring, Render DOCX sidecar, Loop Over Jobs, Wait 2s, schedule unchanged |
| NocoDB local attachment storage (no MinIO/S3) | AGENTS.md: Project Constraints | Upload uses NocoDB `/api/v2/storage/upload` → `nocodb_data` Docker volume |
| Graceful degradation: downstream failures never block upstream | AGENTS.md: Error Handling | D-06: upload failure still PATCHes `Tailored CV Text` + `CV Tailoring Cost` |
| Node naming: PascalCase, descriptive | AGENTS.md: Naming Patterns | Rename generic "HTTP Request" to "Upload DOCX"; add "Unwrap High Fit Jobs", "Unwrap Profile" |
| Retry pattern on critical writes | AGENTS.md: Error Handling | PATCH node keeps `retryOnFail: true, maxTries: 3, waitBetweenTries: 5000` (match evaluator) |
| JavaScript Code nodes use `const`, arrow functions | AGENTS.md: Code Style | Unwrap + Code node edits follow existing conventions |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use **two separate nodes** for the attachment upload: an "Upload DOCX" HTTP Request node (multipart POST to `/api/v2/storage/upload`), followed by a single combined PATCH node. The upload response array feeds into the PATCH.
- **D-02:** Configure the upload HTTP Request node with **n8n binary data mode** — multipart/form-data with `file` field. The Render DOCX node returns base64; the HTTP Request node's binary handling converts it. NocoDB's `/api/v2/storage/upload` requires multipart (confirmed by NocoDB docs and n8n community threads).
- **D-03:** Use a **single combined HTTP PATCH** node to update `Tailored CV Text`, `CV Tailoring Cost`, and `Tailored CV` (attachment array) together after successful upload. Matches the existing Airtable pattern (one "Update Pipeline Record" node).
- **D-04:** Filter for untailored jobs using NocoDB `(is,blank)` syntax: `?where=(Status,eq,Evaluated)~and(Fit%20Tier,eq,High)~and(Tailored%20CV%20Text,is,blank)`. The `blank` operator catches both empty string and NULL. The `(is,null)` operator does not work correctly in NocoDB v3 for text fields (treated as string literal).
- **D-05:** The "Build Tailoring Prompt" Code node reads NocoDB's auto-generated `Id` field directly: `loopItem['Id']` from the Unwrap node response. Matches Phase 4 D-05 pattern exactly.
- **D-06:** If the NocoDB storage upload fails, the PATCH node still updates `Tailored CV Text` and `CV Tailoring Cost` — the markdown text is the primary output, the DOCX is convenience. Follows the existing codebase graceful degradation pattern (interview prep failures store error instead of crashing).

### Carry-Forward Decisions (Phase 3 & 4)
- Use n8n HTTP Request nodes calling NocoDB Data API v3 (not native NocoDB node) — Phase 3 D-01
- Authenticate via `xc-token` header — Phase 3 D-02
- NocoDB URL and table IDs via env vars: `NOCODB_URL`, `NOCODB_BASE_ID`, `NOCODB_TABLE_PROFILE`, `NOCODB_TABLE_PIPELINE` — Phase 3 D-03/D-04
- Unwrap Code/Set node after each NocoDB HTTP GET to flatten `{ records: [...] }` response — Phase 3 D-06
- Title Case column names matching Airtable fields — Phase 3 D-07
- URL query parameter filter syntax: `?where=(Status,eq,Evaluated)` — Phase 4 D-03
- Node naming: "Get High Fit Jobs" + "Unwrap High Fit Jobs" pattern — Phase 4 D-02
- All Code node `$('Get X')` references updated to `$('Unwrap X')` — Phase 4 D-02

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TAIL-01 | Replace Airtable nodes — reading Profile + Pipeline records with Status="Evaluated" + High Fit | 2 HTTP GET + 2 Unwrap nodes; filter `where=(Status,eq,Evaluated)~and("Fit Tier",eq,High)~and("Tailored CV Text",is,blank)`; Code refs `$('Unwrap Profile')` / `$('Unwrap High Fit Jobs')` |
| TAIL-02 | Adapt CV DOCX upload to NocoDB storage API: `POST /api/v2/storage/upload` → update Pipeline record attachment field with response array | Convert to File → Upload DOCX (multipart `file`) → combined PATCH with `fields['Tailored CV']` = upload response array |
| TAIL-03 | Verify CV attachment appears in NocoDB UI with preview and download | Manual test: open Pipeline record in NocoDB UI after workflow run; confirm DOCX preview + download (VER-04 overlap) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Read Profile record | Database / Storage | — | NocoDB Profile table via Data API v3 GET |
| Read high-fit untailored jobs | Database / Storage | — | NocoDB Pipeline filtered query |
| AI CV tailoring (LLM) | API / Backend | — | Unchanged — LangChain OpenAI node |
| Parse tailored CV + cost calc | API / Backend | — | Code node — unchanged except recordId source |
| Render DOCX (markdown → binary) | API / Backend (sidecar) | — | Unchanged — `http://cv-renderer:3456/render` returns base64 JSON |
| Base64 → n8n binary | API / Backend | — | Convert to File node (n8n native) |
| Upload DOCX to NocoDB storage | Database / Storage | — | NocoDB v2 storage API multipart upload |
| Write tailored CV + attachment | Database / Storage | — | NocoDB v3 PATCH with `fields` object |
| Rate limiting (Wait 2s) | API / Backend | — | Unchanged |

## Standard Stack

No new packages or dependencies. All changes are within existing infrastructure:

| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| n8n HTTP Request node | v4.2+ | NocoDB GET/PATCH + storage upload | Phase 3/4 established pattern |
| n8n Convert to File node | v1+ | Move Base64 String to File | Official n8n path from JSON base64 to binary [CITED: docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.converttofile/] |
| n8n Code node | v2 | Unwrap transforms + existing parse logic | Phase 3 pattern |
| n8n HTTP Header Auth credential | — | `xc-token` header ("NocoDB API") | Phase 3 |
| NocoDB Data API v3 | — | GET/PATCH records | Phase 3/4 |
| NocoDB Storage API v2 | — | `POST /api/v2/storage/upload` | [CITED: docs.nocodb.com/developer-resources/rest-apis/upload-via-api/] |
| CV renderer sidecar | Python 3.12 | DOCX generation | Unchanged |

**No packages to install.** All work modifies `workflows/03-tailor.json`.

## Package Legitimacy Audit

No external packages are installed by this phase. Skipping the Package Legitimacy Gate.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           Tailor Workflow (Workflow 3)                               │
│                                                                                     │
│  ┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐                    │
│  │ Manual/      │──▶│ HTTP GET         │──▶│ Unwrap High Fit  │                    │
│  │ Schedule     │   │ Get High Fit Jobs│   │ Jobs (Code)      │                    │
│  └──────────────┘   └──────────────────┘   └────────┬─────────┘                    │
│                                                      │                              │
│                      ┌──────────────────┐   ┌────────▼─────────┐                    │
│                      │ HTTP GET         │◀──│                  │                    │
│                      │ Get Profile      │   │                  │                    │
│                      └────────┬─────────┘   │                  │                    │
│                               │             │                  │                    │
│                      ┌────────▼─────────┐   │                  │                    │
│                      │ Unwrap Profile   │   │                  │                    │
│                      │ (Code)           │   │                  │                    │
│                      └────────┬─────────┘   │                  │                    │
│                               │             │                  │                    │
│                               ▼             │                  │                    │
│  ┌──────────────────┐   ┌──────────────────┐                    │
│  │ Build Tailoring  │◀──│ (refs Unwrap     │                    │
│  │ Prompt (Code)    │   │  Profile + Jobs) │                    │
│  └────────┬─────────┘   └──────────────────┘                    │
│           │                                                       │
│           ▼                                                       │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐              │
│  │ Loop Over Jobs   │──▶│ Tailor CV (GPT)  │──▶│ Parse Tailored CV│              │
│  │ (SplitInBatches) │   │ (unchanged)      │   │ (Code)           │              │
│  └──────────────────┘   └──────────────────┘   └────────┬─────────┘              │
│                                                          │                        │
│                                                          ▼                        │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐              │
│  │ Wait 2s ◀────────│───│ HTTP PATCH       │◀──│ Upload DOCX      │              │
│  │ (back to Loop)   │   │ Update Pipeline  │   │ POST v2/storage  │              │
│  └──────────────────┘   │ Record           │   └────────▲─────────┘              │
│                           └──────────────────┘            │                        │
│                                                           │                        │
│                      ┌──────────────────┐   ┌─────────────┴────────┐              │
│                      │ Render DOCX      │──▶│ Convert to File    │              │
│                      │ (sidecar, same)  │   │ (base64 → binary)  │              │
│                      └──────────────────┘   └────────────────────┘              │
└─────────────────────────────────────────────────────────────────────────────────────┘
         │                              │                        │
         ▼                              ▼                        ▼
┌──────────────────┐         ┌──────────────────┐    ┌──────────────────┐
│  cv-renderer     │         │  NocoDB Data v3  │    │  NocoDB Storage  │
│  :3456           │         │  GET + PATCH     │    │  v2 /upload      │
└──────────────────┘         └──────────────────┘    └──────────────────┘
```

### Mixed API Versions (Confirmed)

| Operation | API Version | Endpoint | Auth |
|-----------|-------------|----------|------|
| Read Profile / Pipeline | v3 Data API | `GET /api/v3/data/{baseId}/{tableId}/records` | `xc-token` |
| Upload DOCX | **v2 Storage** | `POST /api/v2/storage/upload` | `xc-token` |
| Update record | v3 Data API | `PATCH /api/v3/data/{baseId}/{tableId}/records` | `xc-token` |

[CITED: docs.nocodb.com/developer-resources/rest-apis/upload-via-api/] — upload examples use v2 storage endpoint while record CRUD can use v2 tables API or v3 data API. This project standardizes CRUD on v3 (Phase 3/4) while upload remains v2 per NocoDB docs.

### Pattern 1: NocoDB Unwrap Transform (GET responses)

Identical to Phase 3/4. After each HTTP GET, insert Unwrap Code node:

```javascript
// Unwrap NocoDB Data API v3 response
const response = $input.first().json;
const records = response.records || [];

if (records.length === 0) {
  return [{ json: { _empty: true, _message: 'No high-fit jobs found' } }];
}

return records.map(record => ({
  json: {
    ...record.fields,
    id: record.id  // string UUID — required for PATCH (NOT Id integer)
  }
}));
```

### Pattern 2: Convert to File (base64 → binary)

**What:** n8n native node converting Render DOCX JSON output to binary for multipart upload.

**When to use:** Between Render DOCX and Upload DOCX — required because Render DOCX returns `{ docx_base64, filename, mime_type }` as JSON, not binary.

**Configuration:**
- Operation: `Move Base64 String to File`
- Base64 Input Field: `docx_base64` (literal field name, not expression)
- File Name: `={{ $('Render DOCX').item.json.filename }}`
- MIME Type: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

[CITED: docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.converttofile/]

### Pattern 3: NocoDB Storage Upload (multipart)

**Upload DOCX HTTP Request node configuration:**

| Property | Value |
|----------|-------|
| Name | Upload DOCX |
| Method | POST |
| URL | `={{ $env.NOCODB_URL }}/api/v2/storage/upload` |
| Authentication | HTTP Header Auth ("NocoDB API", `xc-token`) |
| Body Content Type | Multipart Form-Data |
| Body Parameter | Type: **Form Binary Data**, Name: `file`, Input Data Field Name: `data` |
| continueOnFail | `true` (D-06 graceful degradation) |
| alwaysOutputData | `true` |
| retryOnFail | `true`, maxTries: 2, waitBetweenTries: 5000 |

**Response shape:** Top-level **JSON array** of attachment objects. Each object includes at minimum `url`, `title`, `mimetype`, `size`, and an internal `id`. [CITED: docs.nocodb.com upload-via-api; GitHub nocodb#3922; n8n community #176452]

Example response (structure):
```json
[
  {
    "url": "https://...",
    "title": "cv_acme_1718123456789.docx",
    "mimetype": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "size": 45678,
    "id": "..."
  }
]
```

Pass the **entire array** to PATCH — do not cherry-pick fields. [CITED: community.nocodb.com/t/trouble-with-uploading-csv-file-via-api/1308]

### Pattern 4: Combined PATCH with Attachment + Graceful Degradation

**NocoDB v3 PATCH body format** (matches implemented evaluator pattern):

```json
{
  "id": "<string UUID from record.id>",
  "fields": {
    "Tailored CV Text": "<markdown>",
    "CV Tailoring Cost": 0.000123,
    "Tailored CV": [ /* upload response array — only when upload succeeded */ ]
  }
}
```

For v3 Data API, attachment values are a **native JSON array** inside `fields`, not a JSON-encoded string (v2 tables API sometimes required stringified arrays). [CITED: nocodb.com/docs/scripts/api-reference/field — Attachment field returns array of objects; v3 release notes mention reliable v3 attachment uploads]

**D-06 conditional PATCH** — use expression jsonBody on Update Pipeline Record:

```javascript
={{ (() => {
  const parse = $('Parse Tailored CV').item.json;
  const upload = $('Upload DOCX').item.json;
  const fields = {
    'Tailored CV Text': parse.tailoredCV,
    'CV Tailoring Cost': parse.cost
  };
  if (Array.isArray(upload) && upload.length > 0 && upload[0].url) {
    fields['Tailored CV'] = upload;
  }
  return JSON.stringify({ id: parse.recordId, fields });
})() }}
```

Upload DOCX must have `continueOnFail: true` so PATCH still executes when upload fails.

### PATCH Record ID Correction (Phase 4 carry-forward)

**CRITICAL:** D-05 references `loopItem['Id']` (auto-increment integer). The v3 PATCH API requires `id` (string UUID from `record.id`). Implemented evaluator already uses `loopItem.id`.

**Planner MUST adopt:**
- Unwrap exposes `id: record.id`
- Build Tailoring Prompt: `const recordId = job.json.id;` (not `job.json['Id']`)
- Parse Tailored CV: `recordId: loopItem._recordId` (unchanged — `_recordId` carries string UUID)
- PATCH body: `"id": "={{ $('Parse Tailored CV').item.json.recordId }}"`

### Anti-Patterns to Avoid

- **Sending base64 in multipart body:** NocoDB storage API expects binary multipart, not JSON with base64 string
- **Using v2 tables PATCH URL:** Use v3 data API URL consistent with Phase 3/4
- **Omitting attachment objects from upload response:** Must use full objects returned by storage API
- **Using `$('Get Profile')` after migration:** Returns raw `{ records: [...] }` — use Unwrap nodes
- **Failing entire job when upload fails:** Violates D-06 — PATCH text fields regardless

## Node Replacement Reference

### Node: "Get High Fit Jobs" (Airtable → HTTP GET + Unwrap)

| Property | Airtable (original) | HTTP GET (replacement) |
|----------|-------------------|----------------------|
| Type | `n8n-nodes-base.airtable` | `n8n-nodes-base.httpRequest` v4.2 |
| Filter | `AND({Status}='Evaluated',{Fit Tier}='High',{Tailored CV Text}='')` | See filter URL below |
| Auth | Airtable PAT | HTTP Header Auth: `xc-token` |

**Filter URL** (prefer quoted field names for spaces per Phase 3):
```
={{ $env.NOCODB_URL }}/api/v3/data/{{ $env.NOCODB_BASE_ID }}/{{ $env.NOCODB_TABLE_PIPELINE }}/records?where=(Status,eq,Evaluated)~and("Fit Tier",eq,High)~and("Tailored CV Text",is,blank)
```

D-04's URL-encoded variant `(Fit%20Tier,...)` is equivalent; quoted syntax `"Fit Tier"` matches Phase 3 convention for space-containing columns.

**New node:** "Unwrap High Fit Jobs" (Code) — positioned between Get High Fit Jobs and Get Profile.

**Connections:**
- Trigger → Get High Fit Jobs (HTTP) → **Unwrap High Fit Jobs** → Get Profile (HTTP) → **Unwrap Profile** → Build Tailoring Prompt

### Node: "Get Profile" (Airtable → HTTP GET + Unwrap)

Same pattern as Phase 4 / scanner workflows:

```
GET {{ $env.NOCODB_URL }}/api/v3/data/{{ $env.NOCODB_BASE_ID }}/{{ $env.NOCODB_TABLE_PROFILE }}/records
```

**New node:** "Unwrap Profile" — `executeOnce: true` preserved on Get Profile HTTP node.

### Node: "HTTP Request" → "Upload DOCX" (Airtable content upload → NocoDB storage)

| Property | Airtable (original) | NocoDB (replacement) |
|----------|-------------------|----------------------|
| Name | HTTP Request | **Upload DOCX** |
| URL | `content.airtable.com/.../uploadAttachment` | `{{ $env.NOCODB_URL }}/api/v2/storage/upload` |
| Body | JSON `{ contentType, file: base64, filename }` | Multipart form-data, field `file`, binary from Convert to File |
| Auth | Airtable Bearer PAT | `xc-token` (NocoDB API credential) |

**New upstream node:** "Convert to File" between Render DOCX and Upload DOCX.

**Connection order (unchanged intent):**
```
Parse Tailored CV → Render DOCX → Convert to File → Upload DOCX → Update Pipeline Record → Wait 2s
```

Current Airtable flow matches this order (upload before update). NocoDB combined PATCH adds attachment to the update step.

### Node: "Update Pipeline Record" (Airtable → HTTP PATCH)

| Property | Airtable (original) | HTTP PATCH (replacement) |
|----------|-------------------|------------------------|
| Type | `n8n-nodes-base.airtable` update | `n8n-nodes-base.httpRequest` PATCH |
| URL | Airtable base/table | `{{ $env.NOCODB_URL }}/api/v3/data/{{ $env.NOCODB_BASE_ID }}/{{ $env.NOCODB_TABLE_PIPELINE }}/records` |
| Fields | Tailored CV Text, CV Tailoring Cost only | Same + `Tailored CV` attachment array when upload succeeds |
| Auth | Airtable PAT | `xc-token` |

**Note:** Airtable uploaded attachment via separate content API; the Airtable update node never set the attachment field directly. NocoDB requires the upload response array in the PATCH — this is the key behavioral adaptation for TAIL-02.

## n8n Binary Upload Patterns

### Workflow binary mode

`workflows/03-tailor.json` already sets `"binaryMode": "separate"` in settings — correct for Convert to File → HTTP Request binary chain.

### Render DOCX output

CV sidecar returns JSON (not binary):
```json
{ "status": "ok", "filename": "cv_acme_123.docx", "docx_base64": "UEsDB..." }
```
Source: `scripts/cv_service.py`

### Recommended chain (3 nodes)

1. **Render DOCX** — unchanged HTTP POST to sidecar
2. **Convert to File** — `Move Base64 String to File`, field `docx_base64` → binary property `data`
3. **Upload DOCX** — multipart, Form Binary Data, name `file`, input `data`

[CITED: n8n community #176452, #228945; docs.n8n.io HTTP Request Form-Data + Form Binary Data]

### Why D-02 needs a planner correction

D-02 assumes the Upload HTTP Request node alone converts base64. n8n HTTP Request multipart requires an existing binary property — it does not decode a JSON string field automatically. The **Convert to File** node is the standard n8n-native solution and aligns with D-02's "no custom Code node" constraint.

## NocoDB Attachment PATCH Format

### Field definition

Pipeline table `Tailored CV` column: type `Attachment` in `scripts/nocodb-schema.json` and `airtable/AIRTABLE-SCHEMA.md`.

### v3 PATCH attachment value

```json
{
  "id": "rec_xxxxxxxx",
  "fields": {
    "Tailored CV Text": "# JOHN DOE\n...",
    "CV Tailoring Cost": 0.000045,
    "Tailored CV": [
      {
        "url": "https://nocodb.example.com/...",
        "title": "cv_acme_1718123456789.docx",
        "mimetype": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "size": 45678
      }
    ]
  }
}
```

Use `$('Upload DOCX').item.json` directly when response is the array. If n8n wraps it, check execution output — may need `$('Upload DOCX').item.json[0]` vs full array (upload endpoint returns array at top level per docs).

### Size limit

`NC_ATTACHMENT_FIELD_SIZE=20971520` (20MB) in `docker-compose.example.yml` — DOCX files from CV renderer are well under this limit.

## Code Node Changes

### 1. "Build Tailoring Prompt"

**Current:**
```javascript
const profile = $('Get Profile').first().json;
const jobs = $('Get High Fit Jobs').all();
// ...
const recordId = job.json.id || job.json.recordId;
```

**New:**
```javascript
const profile = $('Unwrap Profile').first().json;
const jobs = $('Unwrap High Fit Jobs').all();
// ...
const recordId = job.json.id;
if (!recordId) throw new Error('Missing NocoDB record id on job item');
```

Profile field access already handles flat unwrap shape (`profile['CV Markdown']`).

### 2. "Parse Tailored CV"

**No structural change** — already uses `loopItem._recordId` from Build Tailoring Prompt. Verify `_recordId` is string UUID after Build Tailoring Prompt fix.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Base64 → binary conversion | Custom Code node with Buffer | Convert to File node | Official n8n pattern; MIME type + filename handling built-in |
| Multipart upload encoding | Manual FormData in Code | HTTP Request Form Binary Data | n8n handles boundaries and headers |
| Attachment metadata construction | Manual url/title guessing | Full array from storage upload response | NocoDB expects complete objects from upload API |
| NocoDB auth | Hardcoded token | n8n "NocoDB API" credential | Phase 3 established |

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | Pipeline records in NocoDB may have existing `Tailored CV` attachments from Phase 2 import | No migration — new uploads append/replace per PATCH array semantics |
| Live service config | n8n stores active workflow copy in its DB; git JSON edit alone does not update running instance | Re-import or sync `workflows/03-tailor.json` in n8n UI after edit |
| OS-registered state | None — verified: no launchd/systemd/cron references to tailor workflow | None |
| Secrets/env vars | Tailor nodes reference Airtable PAT credential + Airtable Header Auth for content upload | Replace with "NocoDB API" HTTP Header Auth; remove Airtable credential refs from 4 nodes |
| Build artifacts | None — verified: no compiled artifacts depend on Airtable node types | None |

## Common Pitfalls

### Pitfall 1: Upload fails with "Cannot read properties of null (reading 'name')"
**What goes wrong:** HTTP Request multipart upload errors before reaching NocoDB.
**Why:** Binary property name mismatch — Convert to File outputs `data` but HTTP Request references wrong field.
**How to avoid:** Set Form Binary Data Input Data Field Name to `data`; verify binary tab in n8n execution view after Convert to File.
**Warning signs:** n8n error in Upload DOCX before HTTP response.

### Pitfall 2: PATCH succeeds but attachment column empty
**What goes wrong:** Text fields update; no DOCX in NocoDB UI.
**Why:** PATCH body missing `Tailored CV` array, or used partial object instead of full upload response.
**How to avoid:** Assign entire upload response array to `fields['Tailored CV']`; verify upload node output is array with `url` key.
**Warning signs:** TAIL-03 manual verification fails.

### Pitfall 3: Using integer `Id` instead of string `id` in PATCH
**What goes wrong:** 400 Bad Request on Update Pipeline Record.
**Why:** D-05 references wrong identifier; same issue corrected in Phase 4.
**How to avoid:** Unwrap exposes `id: record.id`; recordId flows as string UUID.
**Warning signs:** PATCH HTTP status 400.

### Pitfall 4: Stale `$('Get Profile')` / `$('Get High Fit Jobs')` references
**What goes wrong:** Build Tailoring Prompt throws empty CV or wrong job list.
**Why:** HTTP GET returns `{ records: [...] }` not flat items.
**How to avoid:** Update all references to Unwrap nodes.
**Warning signs:** "CV Markdown is empty" despite Profile populated in NocoDB.

### Pitfall 5: Upload failure blocks text save
**What goes wrong:** Entire job lost when storage upload fails.
**Why:** Upload DOCX missing `continueOnFail: true` or PATCH depends on upload success path only.
**How to avoid:** Upload: `continueOnFail: true`; PATCH: conditional attachment per Pattern 4.
**Warning signs:** No `Tailored CV Text` saved after upload error.

### Pitfall 6: Wrong filter — jobs with existing tailored CV re-processed
**What goes wrong:** Duplicate tailoring runs, wasted AI cost.
**Why:** Using `(eq,)` instead of `(is,blank)` or `(is,null)` for text field.
**How to avoid:** Use D-04 `(is,blank)` filter exactly.
**Warning signs:** Jobs with non-empty Tailored CV Text appear in Unwrap output.

## Code Examples

### Unwrap High Fit Jobs (full)

```javascript
// Unwrap NocoDB Data API v3 response — high-fit untailored jobs
const response = $input.first().json;
const records = response.records || [];

if (records.length === 0) {
  return [{ json: { _empty: true, _message: 'No high-fit jobs needing tailoring' } }];
}

return records.map(record => ({
  json: {
    ...record.fields,
    id: record.id
  }
}));
```

### Upload DOCX node (multipart parameters)

```json
{
  "method": "POST",
  "url": "={{ $env.NOCODB_URL }}/api/v2/storage/upload",
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth",
  "sendBody": true,
  "contentType": "multipart-form-data",
  "bodyParameters": {
    "parameters": [
      {
        "parameterType": "formBinaryData",
        "name": "file",
        "inputDataFieldName": "data"
      }
    ]
  },
  "continueOnFail": true,
  "alwaysOutputData": true,
  "retryOnFail": true,
  "maxTries": 2,
  "waitBetweenTries": 5000
}
```

Source: n8n HTTP Request docs + NocoDB upload docs [CITED: docs.nocodb.com upload-via-api]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| n8n (Docker) | Workflow execution | ✓ | latest | n8n Desktop |
| NocoDB (Docker) | Database + storage | ✓ (Phase 1) | latest, port 8080 | — |
| cv-renderer sidecar | Render DOCX | ✓ | Python 3.12, port 3456 | Text-only (no DOCX) |
| NOCODB_* env vars | All NocoDB HTTP nodes | ✓ (Phase 3) | — | — |
| NocoDB API credential | xc-token auth | ✓ (Phase 3) | — | — |
| nocodb_data volume | Attachment persistence | ✓ (docker-compose) | — | — |

**Missing dependencies with no fallback:** None — all dependencies established in Phases 1–4.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual workflow execution + node output inspection (no automated n8n test harness) |
| Config file | None |
| Quick run command | n8n UI → "JobSignal - Workflow 3 - Tailor" → Execute Workflow → inspect node outputs |
| Full suite command | Manual trigger with ≥1 Evaluated+High Fit job with blank Tailored CV Text; verify NocoDB record via UI + API |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TAIL-01 | Profile + filtered Pipeline read from NocoDB | Manual | Execute workflow; inspect Unwrap nodes for flat items + correct filter | ❌ Wave 0 |
| TAIL-02 | DOCX upload via storage API + PATCH attachment | Manual | Inspect Upload DOCX response (array with url); inspect PATCH body includes `Tailored CV` | ❌ Wave 0 |
| TAIL-03 | Attachment visible in NocoDB UI | Manual | Open Pipeline record in NocoDB UI — preview + download DOCX | ❌ Wave 0 |

### Manual Test Cases

**Test Case A: NocoDB reads (TAIL-01)**
1. Ensure ≥1 Pipeline record: Status=Evaluated, Fit Tier=High, Tailored CV Text blank
2. Execute tailor workflow
3. Inspect Unwrap Profile — 1 item with `CV Markdown`, `Full Name`, etc.
4. Inspect Unwrap High Fit Jobs — only matching jobs, each with `id` (string UUID)

**Test Case B: End-to-end tailoring (TAIL-01 + TAIL-02)**
1. Execute past Parse Tailored CV — verify `tailoredCV` length ≥ 100, `recordId` present
2. Render DOCX — verify `docx_base64` present
3. Convert to File — verify binary `data` property in output
4. Upload DOCX — verify HTTP 200, response is array with `url`
5. Update Pipeline Record — verify PATCH 200, body has all three fields

**Test Case C: NocoDB UI attachment (TAIL-03)**
1. Open tailored job in NocoDB Pipeline table
2. Confirm `Tailored CV Text` populated with markdown
3. Confirm `Tailored CV` attachment shows DOCX with preview and download

**Test Case D: Graceful degradation (D-06)**
1. Temporarily break upload (invalid URL or stop NocoDB storage)
2. Verify Upload DOCX fails but workflow continues
3. Verify PATCH still saves `Tailored CV Text` + `CV Tailoring Cost`
4. Verify `Tailored CV` attachment column unchanged/empty

**Test Case E: Empty state**
1. Ensure no jobs match filter (all already tailored)
2. Unwrap High Fit Jobs returns `_empty` sentinel
3. Workflow handles gracefully (no AI calls)

### Sampling Rate
- **Per task commit:** Inspect modified node outputs in n8n UI
- **Per plan merge:** Full manual test cases A–E
- **Phase gate:** TAIL-03 UI verification before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] No automated test suite for n8n workflows
- [ ] Upload response shape must be confirmed against running NocoDB instance (array vs wrapped)
- [ ] Filter `(is,blank)` on `Tailored CV Text` must be verified against running NocoDB

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | no | No user-facing input — automated pipeline |
| V6 Cryptography | no | No new crypto operations |
| V8 Data Protection | yes | API token in n8n credential store; DOCX contains PII (CV data) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API token leak | Information Disclosure | `xc-token` in n8n "NocoDB API" credential only — remove Airtable PAT from tailor workflow |
| Oversized upload | Denial of Service | `NC_ATTACHMENT_FIELD_SIZE=20971520` (20MB) enforced by NocoDB |
| NocoDB exposed externally | Tampering | Port 8080 on docker-compose — restrict to internal network in production |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | v3 PATCH accepts attachment as native array in `fields`, not JSON string | NocoDB Attachment PATCH | If v3 requires stringified array, PATCH body format must change |
| A2 | `/api/v2/storage/upload` returns top-level array assigned directly to `$json` | Storage Upload | If wrapped in `{ data: [...] }`, expression must use `.data` |
| A3 | Multipart field name is `file` (singular) for v2 storage upload | Upload config | v1 API used `files` plural — wrong field name causes upload failure |
| A4 | Convert to File required between Render DOCX and Upload | Binary Upload | If newer n8n HTTP Request can decode base64 inline, Convert to File could be omitted |
| A5 | D-05 `Id` integer works for PATCH | PATCH Correction | **High risk** — Phase 4 proved API requires string `id`; planner must override D-05 |
| A6 | `(is,blank)` filter works for LongText `Tailored CV Text` | Filter URL | If blank operator fails, fall back to compound `(eq,)~or(is,null)` testing |

## Open Questions (RESOLVED)

1. **Upload response wrapping in n8n HTTP Request node** — RESOLVED
   - **Decision:** PATCH IIFE uses defensive extraction: `const uploadJson = $('Upload DOCX').item.json; const attachmentArray = Array.isArray(uploadJson) ? uploadJson : (uploadJson.data || uploadJson.body || []);`
   - **Rationale:** n8n HTTP Request typically places JSON array responses at `$json` root, but axios-style `.data` wrapping is possible depending on response options. The IIFE handles both shapes without a second test pass.
   - **Verify at runtime:** Task 3 manual test inspects Upload DOCX output shape and documents which branch fired.

2. **Quoted vs URL-encoded filter for Fit Tier** — RESOLVED
   - **Decision:** Use quoted column syntax in plan URL: `?where=(Status,eq,Evaluated)~and("Fit Tier",eq,High)~and("Tailored CV Text",is,blank)`
   - **Rationale:** Phase 3 scanner research confirmed quoted syntax for space-containing column names; D-04 URL-encoded variant (`Fit%20Tier`) retained as documented fallback if query returns zero results unexpectedly.
   - **Fallback:** If filter returns no jobs when jobs exist, switch to D-04 URL-encoded form: `(Fit%20Tier,eq,High)`

## Sources

### Primary (HIGH confidence)
- `workflows/03-tailor.json` — All 4 Airtable/content nodes, connections, Code nodes, binaryMode setting [VERIFIED: codebase]
- `workflows/02-evaluator.json` — Implemented v3 PATCH + unwrap + `loopItem.id` pattern [VERIFIED: codebase]
- `workflows/01a-scanner-greenhouse.json` — HTTP GET + Unwrap reference [VERIFIED: codebase]
- `scripts/cv_service.py` — Render DOCX response shape (`docx_base64`, `filename`) [VERIFIED: codebase]
- `scripts/nocodb-schema.json` — `Tailored CV` Attachment field type [VERIFIED: codebase]
- `docker-compose.example.yml` — NocoDB service, `NC_ATTACHMENT_FIELD_SIZE`, `nocodb_data` volume [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- [docs.nocodb.com/developer-resources/rest-apis/upload-via-api/](https://docs.nocodb.com/developer-resources/rest-apis/upload-via-api/) — v2 upload endpoint, multipart `file`, response array passed to record field [CITED: WebFetch snippet via WebSearch — direct fetch blocked by robots.txt]
- [docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.converttofile/](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.converttofile/) — Move Base64 String to File [CITED: WebSearch]
- [n8n community #176452](https://community.n8n.io/t/nocodb-upload-attachment-issues-with-http-node/176452) — Two-step upload + PATCH pattern [CITED: WebSearch]
- [GitHub nocodb#3922](https://github.com/nocodb/nocodb/discussions/3922) — Storage upload then attachment column update [CITED: WebSearch]
- `.planning/phases/04-evaluator-workflow-migration/04-RESEARCH.md` — PATCH id correction, unwrap patterns

### Tertiary (LOW confidence)
- [all-apis.nocodb.com Storage upload](https://all-apis.nocodb.com/#tag/Storage/operation/storage-upload) — Legacy v1 endpoint `/api/v1/db/storage/upload` with `files` field — **do not use**; project uses v2 per CONTEXT

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Phase 3/4 patterns directly applicable; upload API documented
- Architecture: HIGH — Node mapping complete; connection order verified against current workflow
- Binary upload chain: MEDIUM — Convert to File + multipart config confirmed by docs; not tested on running n8n instance
- Attachment PATCH format: MEDIUM — v3 native array inferred from v3 release notes + evaluator PATCH pattern; needs runtime confirmation
- Pitfalls: HIGH — Derived from Phase 4 corrections + NocoDB community reports

**Research date:** 2026-06-11
**Valid until:** 2026-07-11 (30 days — stable stack)

## RESEARCH COMPLETE
