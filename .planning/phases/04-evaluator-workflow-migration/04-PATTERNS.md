# Phase 4: Evaluator Workflow Migration — Pattern Map

**Mapped:** 2026-06-10
**Files analyzed:** 2 (02-evaluator.json source, 01a-scanner-greenhouse.json reference)
**Analogs found:** 6 / 6 node replacement patterns + 6 code/parameter edits

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `workflows/02-evaluator.json` (modified) | workflow | CRUD (read + update) | `workflows/01a-scanner-greenhouse.json` (same NocoDB GET/POST pattern but evaluator uses PATCH instead of POST) | role-match |

### Node Replacements (inserted into 02-evaluator.json)

| New Node | Replaces | Role | Data Flow | Best Analog |
|---|---|---|---|---|
| `Get Profile` (HTTP GET) | Airtable Get Profile | controller | request-response | `01a: Get Profile` (HTTP GET, lines 222-257) — exact same table, same pattern |
| `Unwrap Profile` (Code) | (new, after Get Profile) | transform | transform | `01a: Unwrap Profile` (Code node, lines 258-270) — identical unwrap logic |
| `Get New Jobs` (HTTP GET) | Airtable Get New Jobs | controller | request-response | `01a: Get Tracked Companies` (lines 271-306) — HTTP GET with `where` clause filter |
| `Unwrap New Jobs` (Code) | (new, after Get New Jobs) | transform | transform | `01a: Unwrap Tracked Companies` (lines 307-319) — identical unwrap logic |
| `Update Job Record` (HTTP PATCH) | Airtable Update Job Record | controller | CRUD (update) | `01a: Create Pipeline Records` (lines 367-406) — same NocoDB table URL but PATCH instead of POST |
| `Update Interview Prep` (HTTP PATCH) | Airtable Update Interview Prep | controller | CRUD (update) | `01a: Create Pipeline Records` (lines 367-406) — same PATCH body pattern as Update Job Record |

### Code Node Edits (in 02-evaluator.json)

| Code Node | Change | Analog |
|---|---|---|
| `Build Scoring Prompt` (line 90) | `$('Get Profile')` → `$('Unwrap Profile')` | `01a: Parse & Filter Jobs` (line 51) — same `$('Unwrap Profile').first().json` pattern |
| `Parse AI Response` (line 157) | `loopItem._airtableRecordId \|\| loopItem.id` → `loopItem.id` | New pattern — NocoDB `id` (string UUID) replaces Airtable record ID |
| `Build Interview Prep Prompt` (line 623) | `$('Get Profile')` → `$('Unwrap Profile')` | Same pattern as Build Scoring Prompt change |
| `If` node condition (line 599) | `$json.fields['Fit Tier']` → `$('Parse AI Response').item.json.fields['Fit Tier']` | New pattern — must reference Parse AI Response directly because PATCH response shape breaks `$json.fields` |

### Parameter Edits (in 02-evaluator.json)

| Node | Change | Instances |
|---|---|---|
| `Send a new email` (Resend, line 566) | `$('Get Profile')` → `$('Unwrap Profile')` | 1 (Notification Email) |
| `Send a new email` (Resend, line 567-568) | `$('Get New Jobs')` → `$('Unwrap New Jobs')` | 4+ (Job Title, Company, Location in subject + body) |

---

## Pattern Assignments

### `Get Profile` — Airtable → HTTP GET (lines 16-50 → replace)

**Analog:** `workflows/01a-scanner-greenhouse.json`, lines 222-257 (HTTP GET for Profile)

**Existing Airtable node** (02-evaluator.json, lines 16-50):
```json
{
  "parameters": {
    "operation": "search",
    "base": { "__rl": true, "value": "appE808oZ5gTSQzUY" },
    "table": { "__rl": true, "value": "tbl4hqn6sfFVbLuzd" },
    "returnAll": false,
    "limit": 1,
    "options": {}
  },
  "name": "Get Profile",
  "type": "n8n-nodes-base.airtable",
  "typeVersion": 2.1,
  "position": [240, 0],
  "credentials": {
    "airtableTokenApi": { "id": "Ngaw78ZStScPicDq", "name": "Airtable Personal Access Token account" }
  }
}
```

**Replacement — HTTP Request GET** (copy from 01a lines 222-257, keeping position [240, 0]):
```json
{
  "parameters": {
    "method": "GET",
    "url": "={{ $env.NOCODB_URL }}/api/v3/data/{{ $env.NOCODB_BASE_ID }}/{{ $env.NOCODB_TABLE_PROFILE }}/records",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        { "name": "Content-Type", "value": "application/json" }
      ]
    },
    "options": {}
  },
  "name": "Get Profile",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "position": [240, 0],
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000,
  "alwaysOutputData": true,
  "credentials": {
    "httpHeaderAuth": { "id": "TO_BE_CREATED", "name": "NocoDB API" }
  }
}
```

**Plus new Unwrap Profile Code node** (insert between Get Profile and Get New Jobs, position ~[352, 0]):
```json
{
  "parameters": {
    "jsCode": "// Unwrap NocoDB Data API v3 response — transforms { records: [...], next, prev } into flat items\nconst response = $input.first().json;\nconst records = response.records || [];\n\nif (records.length === 0) {\n  return [{ json: { _empty: true, _message: 'No Profile found' } }];\n}\n\nreturn records.map(record => ({\n  json: {\n    ...record.fields,\n    id: record.id\n  }\n}));"
  },
  "name": "Unwrap Profile",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [352, 0]
}
```

---

### `Get New Jobs` — Airtable → HTTP GET (lines 52-87 → replace)

**Analog:** `workflows/01a-scanner-greenhouse.json`, lines 271-306 (HTTP GET with `where` clause)

**Existing Airtable node** (02-evaluator.json, lines 52-87):
```json
{
  "parameters": {
    "operation": "search",
    "base": { "__rl": true, "value": "appE808oZ5gTSQzUY" },
    "table": { "__rl": true, "value": "tblqvCvqMIczRGjLi" },
    "filterByFormula": "={Status}='New'",
    "returnAll": false,
    "limit": 5,
    "options": {}
  },
  "name": "Get New Jobs",
  "type": "n8n-nodes-base.airtable",
  "typeVersion": 2.1,
  "position": [448, 0],
  "credentials": {
    "airtableTokenApi": { "id": "Ngaw78ZStScPicDq" }
  }
}
```

**Replacement — HTTP Request GET with `where` clause** (NocoDB Data API v3 syntax):
```json
{
  "parameters": {
    "method": "GET",
    "url": "={{ $env.NOCODB_URL }}/api/v3/data/{{ $env.NOCODB_BASE_ID }}/{{ $env.NOCODB_TABLE_PIPELINE }}/records?where=(Status,eq,New)&limit=5",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        { "name": "Content-Type", "value": "application/json" }
      ]
    },
    "options": {}
  },
  "name": "Get New Jobs",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "position": [560, 0],
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000,
  "alwaysOutputData": true,
  "credentials": {
    "httpHeaderAuth": { "id": "TO_BE_CREATED", "name": "NocoDB API" }
  }
}
```

**Plus new Unwrap New Jobs Code node** (insert between Get New Jobs and Build Scoring Prompt, position ~[672, 0]):
```json
{
  "parameters": {
    "jsCode": "// Unwrap NocoDB Data API v3 response — transforms { records: [...] } into flat items\nconst response = $input.first().json;\nconst records = response.records || [];\n\nif (records.length === 0) {\n  return [{ json: { _empty: true, _message: 'No new jobs found' } }];\n}\n\nreturn records.map(record => ({\n  json: {\n    ...record.fields,\n    id: record.id\n  }\n}));"
  },
  "name": "Unwrap New Jobs",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [672, 0]
}
```

---

### `Update Job Record` — Airtable → HTTP PATCH (lines 168-562 → replace)

**This is a NEW pattern** (PATCH, not POST). The scanner analogs used POST (create), but the evaluator needs PATCH (update).

**Existing Airtable update node** (02-evaluator.json, lines 168-562 — full Airtable column mapping schema, 30+ fields):
```json
{
  "parameters": {
    "operation": "update",
    "base": { "__rl": true, "value": "appE808oZ5gTSQzUY" },
    "table": { "__rl": true, "value": "tblqvCvqMIczRGjLi" },
    "columns": {
      "mappingMode": "defineBelow",
      "value": {
        "Fit Score": "={{ $json.fields['Fit Score'] }}",
        "AI Evaluation Cost": "={{ $json.fields['AI Evaluation Cost'] }}",
        "id": "={{ $json.recordId }}",
        "Salary Info": "={{ $json.fields['Salary Info'] }}",
        "CV Tailoring Notes": "={{ $json.fields['CV Tailoring Notes'] }}",
        "Missing Skills": "={{ $json.fields['Missing Skills'] }}",
        "Matched Skills": "={{ $json.fields['Matched Skills'] }}",
        "Match Reasoning": "={{ $json.fields['Match Reasoning'] }}",
        "Status": "Evaluated",
        "Fit Tier": "={{ $json.fields['Fit Tier'] }}"
      },
      "matchingColumns": ["id"]
    },
    "options": {}
  },
  "name": "Update Job Record",
  "type": "n8n-nodes-base.airtable",
  "typeVersion": 2.1,
  "position": [1520, 64],
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000,
  "credentials": {
    "airtableTokenApi": { "id": "Ngaw78ZStScPicDq" }
  }
}
```

**Replacement — HTTP PATCH node** (no unwrap needed — the PATCH response is not consumed downstream):
```json
{
  "parameters": {
    "method": "PATCH",
    "url": "={{ $env.NOCODB_URL }}/api/v3/data/{{ $env.NOCODB_BASE_ID }}/{{ $env.NOCODB_TABLE_PIPELINE }}/records",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        { "name": "Content-Type", "value": "application/json" }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={\n  \"id\": \"{{ $json.recordId }}\",\n  \"fields\": {\n    \"Status\": \"Evaluated\",\n    \"Fit Score\": \"{{ $json.fields['Fit Score'] }}\",\n    \"Fit Tier\": \"{{ $json.fields['Fit Tier'] }}\",\n    \"Match Reasoning\": \"{{ $json.fields['Match Reasoning'] }}\",\n    \"Matched Skills\": \"{{ $json.fields['Matched Skills'] }}\",\n    \"Missing Skills\": \"{{ $json.fields['Missing Skills'] }}\",\n    \"CV Tailoring Notes\": \"{{ $json.fields['CV Tailoring Notes'] }}\",\n    \"Salary Info\": \"{{ $json.fields['Salary Info'] }}\",\n    \"AI Evaluation Cost\": \"{{ $json.fields['AI Evaluation Cost'] }}\"\n  }\n}",
    "options": {}
  },
  "name": "Update Job Record",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "position": [1520, 64],
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000,
  "credentials": {
    "httpHeaderAuth": { "id": "TO_BE_CREATED", "name": "NocoDB API" }
  }
}
```

**CRITICAL — PATCH body format:** The NocoDB Data API v3 PATCH endpoint requires `{ "id": "<string_UUID>", "fields": { ... } }`. The `id` is the string UUID (`record.id` from NocoDB), **not** the integer `Id` from `id_fields.Id`. See also "Parse AI Response" change below — it reads `loopItem.id` which is the string UUID exposed by Unwrap New Jobs.

---

### `Update Interview Prep` — Airtable → HTTP PATCH (lines 688-1311 → replace)

Same PATCH pattern as Update Job Record but with different fields:

```json
{
  "parameters": {
    "method": "PATCH",
    "url": "={{ $env.NOCODB_URL }}/api/v3/data/{{ $env.NOCODB_BASE_ID }}/{{ $env.NOCODB_TABLE_PIPELINE }}/records",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        { "name": "Content-Type", "value": "application/json" }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={\n  \"id\": \"{{ $json.recordId }}\",\n  \"fields\": {\n    \"Interview Questions\": \"{{ $json.interviewQuestions }}\",\n    \"STAR Responses\": \"{{ $json.starResponses }}\",\n    \"Interview Prep Cost\": \"{{ $json.interviewPrepCost }}\"\n  }\n}",
    "options": {}
  },
  "name": "Update Interview Prep",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "position": [2912, -192],
  "credentials": {
    "httpHeaderAuth": { "id": "TO_BE_CREATED", "name": "NocoDB API" }
  }
}
```

**Note:** The original Airtable "Update Interview Prep" node (lines 688-1141) has no `retryOnFail` — the replacement matches this. No retry needed for interview prep writes (graceful degradation pattern — failure is captured in the Code node's error message).

---

## Code Node Changes (edits within existing nodes)

### Change 1: `Build Scoring Prompt` — node reference (line 90)

**Current** (line 90):
```javascript
const profileItems = $('Get Profile').all();
```

**New**:
```javascript
const profileItems = $('Unwrap Profile').all();
```

**Why:** The original Airtable "Get Profile" returned flat items. The HTTP GET replacement returns `{ records: [...] }`. Unwrap Profile flattens this to the same format the Code node expects. Since the existing code already uses `profileItems[0].json` to access fields like `profile['Full Name']`, and the unwrap spreads `...record.fields` at the top level, no further changes are needed.

---

### Change 2: `Parse AI Response` — recordId field (line 157)

**Current** (line 157):
```javascript
const recordId = loopItem._airtableRecordId || loopItem.id;
```

**New**:
```javascript
const recordId = loopItem.id;
```

**Why:** After migration, `loopItem` comes from `$('Loop Over Jobs').item.json`, where the loop items are unwrapped NocoDB records (from Unwrap New Jobs). The unwrap exposes `id: record.id` (the string UUID). The old `_airtableRecordId` fallback is no longer needed.

**No change to the output format** — downstream code still receives `{ recordId: "rec_xxx", fields: { ... } }`. The `recordId` is now the NocoDB string UUID instead of the Airtable record ID, but downstream only passes it through to PATCH bodies, never comparing it.

---

### Change 3: `Build Interview Prep Prompt` — node reference (line 623)

**Current** (line 623):
```javascript
const profile = $('Get Profile').item.json;
```

**New**:
```javascript
const profile = $('Unwrap Profile').item.json;
```

**Why:** Same as Change 1 — `$('Get Profile')` now returns raw NocoDB response. Must reference Unwrap Profile instead.

---

### Change 4: `Parse & Save Interview Prep` — NO CHANGE NEEDED (line 677)

**Current** (line 677):
```javascript
const recordId = $('Build Interview Prep Prompt').item.json._recordId;
```

**No change needed.** Build Interview Prep Prompt outputs `_recordId: evaluation.recordId`, and `evaluation.recordId` now contains the NocoDB string UUID (from Change 2). The downstream PATCH uses `$json.recordId` which correctly references this value.

---

### Change 5: `If` node — condition change (line 599)

**Current** (line 599):
```json
"leftValue": "={{ $json.fields['Fit Tier'] }}"
```

**New**:
```json
"leftValue": "={{ $('Parse AI Response').item.json.fields['Fit Tier'] }}"
```

**Why:** After HTTP PATCH replaces the Airtable update node, the PATCH response shape is `{ records: [{ id, fields }] }`, NOT `{ recordId, fields }`. `$json.fields` would evaluate to `undefined`. By referencing Parse AI Response directly (same pattern as Resend email and Build Interview Prep Prompt already use), the condition always has correct access to `fields`.

**Right value / operator unchanged:**
```json
"rightValue": "High",
"operator": { "type": "string", "operation": "equals", "name": "filter.operator.equals" }
```

---

### Change 6: `Send a new email` (Resend) — node references (lines 565-568)

**Analog:** No existing node references to change — this is parameter-level text replacement in the Resend node's `parameters` object.

**Changes needed** (5 occurrences total):

| Field | Current | New |
|-------|---------|-----|
| `to` (line 566) | `=$('Get Profile').item.json['Notification Email']` | `=$('Unwrap Profile').item.json['Notification Email']` |
| `subject` (line 567) | `=$('Get New Jobs').item.json['Job Title']` | `=$('Unwrap New Jobs').item.json['Job Title']` |
| `subject` (line 567) | `=$('Get New Jobs').item.json.Company` | `=$('Unwrap New Jobs').item.json.Company` |
| `html` (line 568) | `=$('Get New Jobs').item.json['Job Title']` | `=$('Unwrap New Jobs').item.json['Job Title']` |
| `html` (line 568) | `=$('Get New Jobs').item.json.Company` | `=$('Unwrap New Jobs').item.json.Company` |
| `html` (line 568) | `=$('Get New Jobs').item.json.Location` | `=$('Unwrap New Jobs').item.json.Location` |

**NOT changed** (already correct — Parse AI Response node name doesn't change):
- `$('Parse AI Response').item.json.fields['Fit Score']` (unchanged)
- `$('Parse AI Response').item.json.fields['Matched Skills']` (unchanged)

---

## Connection Changes (02-evaluator.json lines 1177-1361)

The connections block must be updated to wire the new Unwrap nodes:

| Current Connection | New Connection |
|---|---|
| `Manual Trigger` → `Get Profile` | `Manual Trigger` → `Get Profile` (unchanged) |
| `Get Profile` → `Get New Jobs` | `Get Profile` → **`Unwrap Profile`** → `Get New Jobs` |
| `Get New Jobs` → `Build Scoring Prompt` | `Get New Jobs` → **`Unwrap New Jobs`** → `Build Scoring Prompt` |
| `Schedule Trigger` → `Get Profile` | `Schedule Trigger` → `Get Profile` (unchanged) |
| All other connections | Unchanged |

---

## Shared Patterns

### Pattern: NocoDB HTTP GET with Unwrap

**Source:** `workflows/01a-scanner-greenhouse.json`, lines 222-270 (Get Profile → Unwrap Profile)

**URL construction:**
```
={{ $env.NOCODB_URL }}/api/v3/data/{{ $env.NOCODB_BASE_ID }}/{{ $env.NOCODB_TABLE_* }}/records
```

**Unwrap transform** (identical for both Profile and New Jobs):
```javascript
const response = $input.first().json;
const records = response.records || [];
if (records.length === 0) {
  return [{ json: { _empty: true, _message: 'No records found' } }];
}
return records.map(record => ({
  json: { ...record.fields, id: record.id }
}));
```

| Property | Unwrap Profile | Unwrap New Jobs |
|---|---|---|
| Node name | `Unwrap Profile` | `Unwrap New Jobs` |
| Position | `[352, 0]` | `[672, 0]` |
| `_empty` message | `'No Profile found'` | `'No new jobs found'` |

---

### Pattern: NocoDB HTTP PATCH (NEW — no existing analog)

**PATCH URL:**
```
={{ $env.NOCODB_URL }}/api/v3/data/{{ $env.NOCODB_BASE_ID }}/{{ $env.NOCODB_TABLE_PIPELINE }}/records
```

**PATCH body format** (NocoDB Data API v3):
```json
{
  "id": "string_UUID",       // From $json.recordId (exposed by Parse AI Response)
  "fields": { ... }           // Fields to update
}
```

**CRITICAL:** The `id` field is the NocoDB string UUID (from `record.id`), NOT the auto-increment `Id` integer. The Unwrap Code node exposes `id: record.id` and Parse AI Response sets `recordId = loopItem.id`, which carries the string UUID through to the PATCH body.

| Property | Update Job Record | Update Interview Prep |
|---|---|---|
| Position | `[1520, 64]` | `[2912, -192]` |
| `retryOnFail` | `true` (3 tries) | Not set (matches original) |
| Fields written | Status, Fit Score, Fit Tier, Match Reasoning, Matched Skills, Missing Skills, CV Tailoring Notes, Salary Info, AI Evaluation Cost | Interview Questions, STAR Responses, Interview Prep Cost |

---

### Pattern: PATCH Response Shape — If Node Workaround

**Source:** RESEARCH.md Pattern 3 (verified against PATCH API spec)

After HTTP PATCH replaces the Airtable update node, the PATCH response shape is `{ records: [{ id, fields }] }` — NOT `{ recordId, fields }`. This breaks:
- ❌ `$json.fields['Fit Tier']` — evaluates to `undefined` because `$json` is the PATCH response, not Parse AI Response

**Fix:** Use named node reference instead:
```javascript
$('Parse AI Response').item.json.fields['Fit Tier']
```

This pattern is already used by:
- Resend email node: `$('Parse AI Response').item.json.fields['Fit Score']`
- Build Interview Prep Prompt: `$('Parse AI Response').item.json`

---

### Pattern: HTTP Header Auth Credential Reference

**Source:** `workflows/01a-scanner-greenhouse.json`, lines 251-256

**All 4 new HTTP Request nodes use:**
```json
"authentication": "genericCredentialType",
"genericAuthType": "httpHeaderAuth",
"credentials": {
  "httpHeaderAuth": { "id": "TO_BE_CREATED", "name": "NocoDB API" }
}
```

The credential must already exist from Phase 3. If not, create in n8n UI:
- Type: HTTP Header Auth
- Name: `NocoDB API`
- Header Name: `xc-token`
- Header Value: NocoDB API token

---

### Pattern: `_empty` Sentinel for Empty Results

**Source:** `workflows/01a-scanner-greenhouse.json`, Unwrap nodes (lines 260, 309, 356)

**Applied to both new Unwrap nodes:**
```javascript
if (records.length === 0) {
  return [{ json: { _empty: true, _message: '...' } }];
}
```

---

### Pattern: NocoDB `where` Clause Syntax

**Source:** `workflows/01a-scanner-greenhouse.json`, line 274

**Evaluator filter** (Status field has no spaces, so unquoted syntax):
```
?where=(Status,eq,New)&limit=5
```

**Note:** Unlike Phase 3 scanner filters (which had space-containing field names like `"Scan Method"` requiring quoted syntax), `Status` has no spaces, so `(Status,eq,New)` is correct without quotes.

---

## No Analog Found

| Pattern | Role | Data Flow | Reason |
|---|---|---|---|
| NocoDB HTTP PATCH body | controller | CRUD (update) | Phase 3 only used POST (create). The PATCH endpoint requires `{ "id": "...", "fields": {...}}` format — different from POST's `{ "fields": {...}}`. New pattern for Phase 4. |
| If condition fix using `$('Parse AI Response')` | config | — | Phase 3 had no `$json.fields` breakage because POST response doesn't break downstream conditions. New pattern specific to PATCH integration. |

---

## Metadata

**Analog search scope:** `workflows/02-evaluator.json`, `workflows/01a-scanner-greenhouse.json`
**Files scanned:** 2 (evaluator source + Greenhouse scanner reference)
**Pattern extraction date:** 2026-06-10

**Key correction from RESEARCH.md vs CONTEXT.md:**
- D-01 says use `Id` (auto-increment integer), but NocoDB Data API v3 PATCH requires `id` (string UUID). Unwrap exposes `id: record.id` (string), NOT `Id: record.id_fields?.Id` (integer). Parse AI Response uses `loopItem.id` which reads the string UUID.
- PATCH body uses `"id": "{{ $json.recordId }}"` where `recordId` is a string UUID, not an integer.
