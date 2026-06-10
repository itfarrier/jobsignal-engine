# Phase 5: Tailor Workflow & Attachments Migration — Pattern Map

**Mapped:** 2026-06-11
**Files analyzed:** 1 primary file (`workflows/03-tailor.json`) + 10 node replacements/edits + 2 reference workflows
**Analogs found:** 8 / 10 node patterns (2 new node types have no codebase analog)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `workflows/03-tailor.json` (modified) | workflow | CRUD (read + update) + file-I/O (upload) | `workflows/02-evaluator.json` (same Profile/Pipeline NocoDB migration) | exact |
| `Get High Fit Jobs` (HTTP GET) | controller | request-response | `02-evaluator.json: Get New Jobs` (lines 65-98) — filtered Pipeline GET | exact |
| `Unwrap High Fit Jobs` (Code) | transform | transform | `02-evaluator.json: Unwrap New Jobs` (lines 100-111) | exact |
| `Get Profile` (HTTP GET) | controller | request-response | `01a-scanner-greenhouse.json: Get Profile` (lines 222-257) | exact |
| `Unwrap Profile` (Code) | transform | transform | `01a-scanner-greenhouse.json: Unwrap Profile` (lines 258-270) | exact |
| `Build Tailoring Prompt` (Code edit) | transform | transform | `02-evaluator.json: Build Scoring Prompt` (line 115) — Unwrap refs + `job.json.id` | role-match |
| `Parse Tailored CV` (Code edit) | transform | transform | `02-evaluator.json: Parse AI Response` (lines 181-192) — `loopItem.id` / `_recordId` flow | role-match |
| `Render DOCX` (unchanged) | controller | request-response | `workflows/03-tailor.json: Render DOCX` (lines 184-206) | exact (keep as-is) |
| `Convert to File` (new) | transform | file-I/O | None in codebase | no analog |
| `Upload DOCX` (HTTP POST multipart) | controller | file-I/O | `03-tailor.json: HTTP Request` (lines 641-675) — replace URL/body/auth only | partial |
| `Update Pipeline Record` (HTTP PATCH) | controller | CRUD (update) | `02-evaluator.json: Update Job Record` (lines 193-229) | exact |

### Connection Order (after migration)

```
Trigger → Get High Fit Jobs → Unwrap High Fit Jobs → Get Profile → Unwrap Profile → Build Tailoring Prompt → Loop Over Jobs → …
Parse Tailored CV → Render DOCX → Convert to File → Upload DOCX → Update Pipeline Record → Wait 2s → Loop Over Jobs
```

**Analog for connection chaining:** `02-evaluator.json` connections (lines 438-480) — Get → Unwrap → Get → Unwrap → Code.

---

## Pattern Assignments

### `Get High Fit Jobs` — Airtable → HTTP GET (03-tailor.json lines 35-68 → replace)

**Analog:** `workflows/02-evaluator.json`, lines 65-98 (`Get New Jobs` with `where` filter)

**Existing Airtable node** (03-tailor.json, lines 36-68):
```json
{
  "parameters": {
    "operation": "search",
    "filterByFormula": "==AND({Status}='Evaluated',{Fit Tier}='High',{Tailored CV Text}='')"
  },
  "name": "Get High Fit Jobs",
  "type": "n8n-nodes-base.airtable",
  "typeVersion": 2.1,
  "position": [2784, 64]
}
```

**Replacement — HTTP Request GET with D-04 `(is,blank)` filter** (copy auth/retry from 02-evaluator Get New Jobs, change URL):
```json
{
  "parameters": {
    "method": "GET",
    "url": "={{ $env.NOCODB_URL }}/api/v3/data/{{ $env.NOCODB_BASE_ID }}/{{ $env.NOCODB_TABLE_PIPELINE }}/records?where=(Status,eq,Evaluated)~and(\"Fit Tier\",eq,High)~and(\"Tailored CV Text\",is,blank)",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [{ "name": "Content-Type", "value": "application/json" }]
    },
    "options": {}
  },
  "name": "Get High Fit Jobs",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "position": [2784, 64],
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000,
  "alwaysOutputData": true,
  "credentials": {
    "httpHeaderAuth": { "id": "TO_BE_CREATED", "name": "NocoDB API" }
  }
}
```

**New downstream node:** `Unwrap High Fit Jobs` (insert at position ~[2896, 64], between Get High Fit Jobs and Get Profile).

---

### `Unwrap High Fit Jobs` — new Code node

**Analog:** `workflows/02-evaluator.json`, lines 100-111 (`Unwrap New Jobs`)

**Unwrap pattern** (adapt empty message only):
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
    id: record.id  // string UUID — required for PATCH (NOT Id integer)
  }
}));
```

**CRITICAL (override D-05):** Expose `id: record.id` (string UUID), not `Id` integer. Phase 4 proved v3 PATCH requires `record.id`.

---

### `Get Profile` — Airtable → HTTP GET (03-tailor.json lines 70-103 → replace)

**Analog:** `workflows/01a-scanner-greenhouse.json`, lines 222-257

**Replacement** (copy exactly from 01a/02-evaluator, preserve `executeOnce: true` from current tailor node):
```json
{
  "parameters": {
    "method": "GET",
    "url": "={{ $env.NOCODB_URL }}/api/v3/data/{{ $env.NOCODB_BASE_ID }}/{{ $env.NOCODB_TABLE_PROFILE }}/records",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [{ "name": "Content-Type", "value": "application/json" }]
    },
    "options": {}
  },
  "name": "Get Profile",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "position": [3024, 64],
  "executeOnce": true,
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000,
  "alwaysOutputData": true,
  "credentials": {
    "httpHeaderAuth": { "id": "TO_BE_CREATED", "name": "NocoDB API" }
  }
}
```

**New downstream node:** `Unwrap Profile` (insert at position ~[3136, 64]).

---

### `Unwrap Profile` — new Code node

**Analog:** `workflows/01a-scanner-greenhouse.json`, lines 258-270 (identical to 02-evaluator lines 52-63)

```javascript
// Unwrap NocoDB Data API v3 response — transforms { records: [...], next, prev } into flat items
const response = $input.first().json;
const records = response.records || [];

if (records.length === 0) {
  return [{ json: { _empty: true, _message: 'No Profile found' } }];
}

return records.map(record => ({
  json: {
    ...record.fields,
    id: record.id
  }
}));
```

---

### `Build Tailoring Prompt` — Code node edits (03-tailor.json lines 105-117)

**Analog:** `workflows/02-evaluator.json`, line 115 (`Build Scoring Prompt` — Unwrap refs + record ID)

**Current references to replace** (03-tailor.json, jsCode opening lines):
```javascript
const profile = $('Get Profile').first().json;
const jobs = $('Get High Fit Jobs').all();
// ...
const recordId = job.json.id || job.json.recordId;
```

**New pattern** (copy from 02-evaluator Build Scoring Prompt):
```javascript
const profileItems = $('Unwrap Profile').all();
if (!profileItems || profileItems.length === 0) {
  throw new Error('Profile table is empty. Add your profile row before running.');
}
const profile = profileItems[0].json;

const jobs = $('Unwrap High Fit Jobs').all();
// ...
return jobs.map(job => {
  const fields = job.json;  // already flat from Unwrap — no .fields nesting needed
  const recordId = job.json.id;
  if (!recordId) throw new Error('Missing NocoDB record id on job item');
  // ...
  _recordId: recordId
});
```

**Field access:** After Unwrap, Profile fields are top-level (`profile['CV Markdown']`). Keep existing fallback chain but drop `profile.fields ?` branch if desired (Unwrap always flattens).

---

### `Parse Tailored CV` — minimal verification (03-tailor.json lines 171-183)

**Analog:** `workflows/02-evaluator.json`, lines 181-192 (`Parse AI Response` recordId extraction)

**Current pattern (keep structure, verify `_recordId` is string UUID):**
```javascript
const loopItem = $('Loop Over Jobs').item.json;
// ...
return [{
  json: {
    recordId: loopItem._recordId,
    tailoredCV: tailoredCV,
    cost: cost,
    filename: filename
  }
}];
```

No structural change needed if `Build Tailoring Prompt` sets `_recordId` from `job.json.id` (string UUID).

---

### `Render DOCX` — unchanged (03-tailor.json lines 184-206)

**Analog:** Self — keep as-is.

**Sidecar response shape** (`scripts/cv_service.py`, lines 54-58):
```python
self._respond(200, {
    'status': 'ok',
    'filename': f'{filename}.docx',
    'docx_base64': docx_base64
})
```

**Workflow binaryMode** (03-tailor.json lines 814-817) — already `"binaryMode": "separate"`; required for Convert to File → Upload DOCX chain.

---

### `Convert to File` — new node (no codebase analog)

**Analog:** None — use RESEARCH.md Pattern 2 + n8n docs.

**Insert between Render DOCX and Upload DOCX** (position ~[4448, 64]).

**Configuration:**
```json
{
  "parameters": {
    "operation": "toBinary",
    "sourceProperty": "docx_base64",
    "options": {
      "fileName": "={{ $('Render DOCX').item.json.filename }}",
      "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    }
  },
  "name": "Convert to File",
  "type": "n8n-nodes-base.convertToFile",
  "typeVersion": 1.1,
  "position": [4448, 64]
}
```

**Note:** n8n UI label is "Move Base64 String to File"; outputs binary property `data`. Required because HTTP Request multipart cannot decode JSON base64 string directly (D-02 planner correction).

---

### `Upload DOCX` — replace Airtable content upload (03-tailor.json lines 641-675)

**Analog (partial):** Existing `HTTP Request` node structure (auth, retry) + RESEARCH.md multipart config. Replace URL, body, credential.

**Current Airtable upload** (03-tailor.json, lines 642-658):
```json
{
  "method": "POST",
  "url": "=https://content.airtable.com/v0/.../uploadAttachment",
  "jsonBody": "{ \"contentType\": \"...\", \"file\": \"{{ $('Render DOCX').item.json.docx_base64 }}\", \"filename\": \"...\" }"
}
```

**Replacement — NocoDB v2 storage multipart** (rename node to `Upload DOCX`):
```json
{
  "parameters": {
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
    "options": {}
  },
  "name": "Upload DOCX",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "position": [4576, 64],
  "continueOnFail": true,
  "alwaysOutputData": true,
  "retryOnFail": true,
  "maxTries": 2,
  "waitBetweenTries": 5000,
  "credentials": {
    "httpHeaderAuth": { "id": "TO_BE_CREATED", "name": "NocoDB API" }
  }
}
```

**Graceful degradation flag:** `continueOnFail: true` — copy intent from `01a-scanner-greenhouse.json: Fetch Greenhouse API` (line 47) and `Create Pipeline Records` (line 399).

**Response:** Top-level JSON array of attachment objects — pass entire array to PATCH `fields['Tailored CV']`.

---

### `Update Pipeline Record` — Airtable → HTTP PATCH (03-tailor.json lines 207-625 → replace)

**Analog:** `workflows/02-evaluator.json`, lines 193-229 (`Update Job Record`)

**Existing Airtable update** (03-tailor.json, lines 222-228 — sets text + cost only; attachment via separate upload):
```json
{
  "columns": {
    "value": {
      "id": "={{ $('Parse Tailored CV').item.json.recordId }}",
      "Tailored CV Text": "={{ $('Parse Tailored CV').item.json.tailoredCV }}",
      "CV Tailoring Cost": "={{ $('Parse Tailored CV').item.json.cost }}"
    }
  }
}
```

**Replacement — HTTP PATCH with D-06 conditional attachment** (copy auth/retry from 02-evaluator Update Job Record):
```json
{
  "parameters": {
    "method": "PATCH",
    "url": "={{ $env.NOCODB_URL }}/api/v3/data/{{ $env.NOCODB_BASE_ID }}/{{ $env.NOCODB_TABLE_PIPELINE }}/records",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [{ "name": "Content-Type", "value": "application/json" }]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={{ (() => { const parse = $('Parse Tailored CV').item.json; const upload = $('Upload DOCX').item.json; const fields = { 'Tailored CV Text': parse.tailoredCV, 'CV Tailoring Cost': parse.cost }; if (Array.isArray(upload) && upload.length > 0 && upload[0].url) { fields['Tailored CV'] = upload; } return JSON.stringify({ id: parse.recordId, fields }); })() }}",
    "options": {}
  },
  "name": "Update Pipeline Record",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "position": [4832, 64],
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000,
  "credentials": {
    "httpHeaderAuth": { "id": "TO_BE_CREATED", "name": "NocoDB API" }
  }
}
```

**Key difference from evaluator PATCH:** Evaluator uses static field list (lines 210-210); tailor needs IIFE expression for conditional `Tailored CV` attachment array (D-03 + D-06).

**Schema reference:** `Tailored CV` is type `Attachment` in `scripts/nocodb-schema.json` (lines 409-412).

---

## Shared Patterns

### NocoDB HTTP Request Auth (GET/PATCH/POST storage)

**Source:** `workflows/02-evaluator.json`, lines 19-20, 44-48

**Apply to:** All 4 new NocoDB HTTP nodes (Get High Fit Jobs, Get Profile, Upload DOCX, Update Pipeline Record)

```json
"authentication": "genericCredentialType",
"genericAuthType": "httpHeaderAuth",
"credentials": {
  "httpHeaderAuth": { "id": "TO_BE_CREATED", "name": "NocoDB API" }
}
```

Env vars: `NOCODB_URL`, `NOCODB_BASE_ID`, `NOCODB_TABLE_PROFILE`, `NOCODB_TABLE_PIPELINE` (Phase 3 D-03/D-04).

---

### Unwrap Transform (after every NocoDB GET)

**Source:** `workflows/01a-scanner-greenhouse.json`, lines 259-269

**Apply to:** Unwrap High Fit Jobs, Unwrap Profile

```javascript
return records.map(record => ({
  json: {
    ...record.fields,
    id: record.id
  }
}));
```

---

### Record ID Threading (string UUID, not integer Id)

**Source:** `workflows/02-evaluator.json`, Parse AI Response (lines ~130-135 in jsCode)

**Apply to:** Build Tailoring Prompt → Loop Over Jobs → Parse Tailored CV → Update Pipeline Record

```javascript
const recordId = loopItem.id;  // from Unwrap — string UUID
if (!recordId) throw new Error('Could not find NocoDB record ID on the looped job item.');
// Thread as _recordId through Build Tailoring Prompt, read as recordId in Parse Tailored CV
// PATCH body: "id": parse.recordId
```

**Planner MUST override CONTEXT D-05** (`loopItem['Id']`) — use `loopItem.id` per Phase 4 implementation.

---

### Graceful Degradation (D-06)

**Source 1:** `workflows/02-evaluator.json`, Parse & Save Interview Prep (lines 345-355) — catch returns error text instead of throwing:

```javascript
} catch (err) {
  return [{
    json: {
      recordId: recordId,
      interviewQuestions: '(Interview prep generation failed: ' + err.message + ')',
      // ... still proceeds to PATCH
    }
  }];
}
```

**Source 2:** `workflows/01a-scanner-greenhouse.json`, line 47 — `continueOnFail: true` on HTTP nodes.

**Apply to:** Upload DOCX (`continueOnFail: true` + `alwaysOutputData: true`); Update Pipeline Record (conditional attachment in jsonBody — always PATCH text + cost).

---

### Retry on Critical Writes

**Source:** `workflows/02-evaluator.json`, Update Job Record (lines 221-223)

**Apply to:** Update Pipeline Record

```json
"retryOnFail": true,
"maxTries": 3,
"waitBetweenTries": 5000
```

---

### Title Case Column Names

**Source:** Phase 3 D-07 — all NocoDB field names match Airtable: `Tailored CV Text`, `CV Tailoring Cost`, `Tailored CV`, `Fit Tier`, `Status`.

---

## No Analog Found

| File/Node | Role | Data Flow | Reason |
|---|---|---|---|
| `Convert to File` | transform | file-I/O | No convertToFile nodes exist in any workflow; use RESEARCH.md Pattern 2 + n8n docs |
| `Upload DOCX` (multipart) | controller | file-I/O | No NocoDB storage upload in codebase; partial analog is existing Airtable JSON-base64 upload (03-tailor.json lines 641-675) — replace body/auth only |

---

## Connection Updates (03-tailor.json lines 678-811)

**Replace current chain:**
```
Get High Fit Jobs → Get Profile → Build Tailoring Prompt
Render DOCX → HTTP Request → Update Pipeline Record
```

**With:**
```
Get High Fit Jobs → Unwrap High Fit Jobs → Get Profile → Unwrap Profile → Build Tailoring Prompt
Render DOCX → Convert to File → Upload DOCX → Update Pipeline Record
```

**Copy connection pattern from:** `02-evaluator.json` lines 438-480 (Get → Unwrap → Get → Unwrap → Code).

---

## Metadata

**Analog search scope:** `workflows/03-tailor.json`, `workflows/02-evaluator.json`, `workflows/01a-scanner-greenhouse.json`, `scripts/cv_service.py`, `scripts/nocodb-schema.json`, `.planning/phases/04-evaluator-workflow-migration/04-PATTERNS.md`
**Files scanned:** 6
**Pattern extraction date:** 2026-06-11
