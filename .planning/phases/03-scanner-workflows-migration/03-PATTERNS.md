# Phase 3: Scanner Workflows Migration — Pattern Map

**Mapped:** 2026-06-10
**Files analyzed:** 5 (4 workflows + docker-compose)
**Analogs found:** 5 / 5

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `workflows/01a-scanner-greenhouse.json` | workflow | CRUD | `workflows/01a-scanner-greenhouse.json` (self — reference pattern for all scanners) | exact |
| `workflows/01b-scanner-ashby.json` | workflow | CRUD | `workflows/01a-scanner-greenhouse.json` | role-match |
| `workflows/01c-scanner-lever.json` | workflow | CRUD | `workflows/01a-scanner-greenhouse.json` | role-match |
| `workflows/01d-scanner-jobspy.json` | workflow | CRUD | `workflows/01d-scanner-jobspy.json` (self) + `workflows/01a-scanner-greenhouse.json` (Get Profile pattern) | role-match |
| `docker-compose.example.yml` | config | — | `docker-compose.example.yml` (self — add env vars to existing pattern) | exact |

### New Node Types (to insert into each workflow)

| Node Type | Role | Data Flow | Best Analog |
|---|---|---|---|
| `HTTP Request GET (NocoDB)` | controller | request-response | `Fetch Greenhouse API` / `Call JobSpy Scanner` (existing HTTP Request nodes) |
| `HTTP Request POST (NocoDB)` | controller | request-response | `Call JobSpy Scanner` (existing POST HTTP Request node) |
| `Unwrap Transform Code node` | transform | transform | No existing analog — new pattern from RESEARCH.md |
| `Parse & Filter Jobs Code edit` (JobSpy only) | transform | transform | Reference: 1a/1b/1c `Parse & Filter Jobs` pattern for Profile geography |

---

## Pattern Assignments

### `workflows/01a-scanner-greenhouse.json` (workflow, CRUD)

**Replaces 4 Airtable nodes with 4 HTTP Request nodes + 3 unwrap Code nodes. Existing Code node logic unchanged.**

#### Pattern 1A: Airtable "Get Profile" → HTTP Request GET + Unwrap
**Analog:** `workflows/01a-scanner-greenhouse.json`, lines 651-683 (existing Airtable "Get Profile" node — shows position in workflow)

**Existing Airtable node** (lines 651-683):
```json
{
  "parameters": {
    "operation": "search",
    "base": { "__rl": true, "value": "appE808oZ5gTSQzUY" },
    "table": { "__rl": true, "value": "tbl4hqn6sfFVbLuzd" },
    "options": {}
  },
  "name": "Get Profile",
  "type": "n8n-nodes-base.airtable",
  "typeVersion": 2.1,
  "position": [352, -400],
  "credentials": {
    "airtableTokenApi": { "id": "Ngaw78ZStScPicDq", "name": "Airtable Personal Access Token account" }
  }
}
```

**Replacement — HTTP Request GET node structure:**
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
  "position": [352, -400],
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000,
  "alwaysOutputData": true,
  "credentials": {
    "httpHeaderAuth": { "id": "TO_BE_CREATED", "name": "NocoDB API" }
  }
}
```

**Plus Unwrap Transform Code node** (new — no direct analog in existing workflows):
```javascript
{
  "parameters": {
    "jsCode": "// Unwrap NocoDB Data API v3 response — transforms { records: [...], next, prev } into flat items\nconst response = $input.first().json;\nconst records = response.records || [];\n\nif (records.length === 0) {\n  return [{ json: { _empty: true, _message: 'No records found' } }];\n}\n\n// Flatten: each record becomes { json: { ...fields, id: record.id } }\n// Downstream nodes access record.json['Target Geography'] directly\nreturn records.map(record => ({\n  json: {\n    ...record.fields,\n    id: record.id\n  }\n}));"
  },
  "name": "Unwrap Profile",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [472, -400]
}
```

**Connection:**
- Manual Trigger → **Get Profile** → **Unwrap Profile** → Get Tracked Companies
- Schedule Trigger → **Get Profile** → **Unwrap Profile** → Get Tracked Companies

---

#### Pattern 1B: Airtable "Get Tracked Companies" → HTTP Request GET + Unwrap
**Analog:** `workflows/01a-scanner-greenhouse.json`, lines 15-48 (existing Airtable "Get Tracked Companies" with filterByFormula)

**Existing Airtable filter:** `=AND({Enabled}=TRUE(),{Scan Method}='Greenhouse API')`

**Replacement — HTTP Request GET with NocoDB `where` clause:**
```json
{
  "parameters": {
    "method": "GET",
    "url": "={{ $env.NOCODB_URL }}/api/v3/data/{{ $env.NOCODB_BASE_ID }}/{{ $env.NOCODB_TABLE_COMPANIES }}/records?where=(Enabled,is,true)~and(\"Scan Method\",eq,\"Greenhouse API\")",
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
  "name": "Get Tracked Companies",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "position": [576, -400],
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000,
  "alwaysOutputData": true,
  "credentials": {
    "httpHeaderAuth": { "id": "TO_BE_CREATED", "name": "NocoDB API" }
  }
}
```

**Variant where clauses per scanner:**
- 1a (Greenhouse): `where=(Enabled,is,true)~and("Scan Method",eq,"Greenhouse API")`
- 1b (Ashby): `where=(Enabled,is,true)~and("Scan Method",eq,"Ashby API")`
- 1c (Lever): `where=(Enabled,is,true)~and("Scan Method",eq,"Lever API")`
- 1d (JobSpy, for Search Queries): `where=(Enabled,is,true)~and("Source Type",eq,"JobSpy")`

**Plus Unwrap Transform Code node** (identical pattern to Pattern 1A):
```javascript
{
  "parameters": {
    "jsCode": "// Unwrap NocoDB Data API v3 response\nconst response = $input.first().json;\nconst records = response.records || [];\n\nif (records.length === 0) {\n  return [{ json: { _empty: true, _message: 'No records found' } }];\n}\n\nreturn records.map(record => ({\n  json: { ...record.fields, id: record.id }\n}));"
  },
  "name": "Unwrap Tracked Companies",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [688, -400]
}
```

**Connection:** Get Profile (Unwrap) → **Get Tracked Companies** → **Unwrap Tracked Companies** → Loop Companies

---

#### Pattern 1C: Airtable "Get Existing Job IDs" → HTTP Request GET + Unwrap
**Analog:** `workflows/01a-scanner-greenhouse.json`, lines 125-162 (existing Airtable with fields projection)

**Existing Airtable has field projection:** `"fields": ["Job ID"]`

**Replacement — HTTP Request GET with `?fields` parameter:**
```json
{
  "parameters": {
    "method": "GET",
    "url": "={{ $env.NOCODB_URL }}/api/v3/data/{{ $env.NOCODB_BASE_ID }}/{{ $env.NOCODB_TABLE_PIPELINE }}/records?fields=Job+ID",
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
  "name": "Get Existing Job IDs",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "position": [2496, -400],
  "alwaysOutputData": true,
  "executeOnce": true,
  "credentials": {
    "httpHeaderAuth": { "id": "TO_BE_CREATED", "name": "NocoDB API" }
  }
}
```

**Note:** This node does NOT need `retryOnFail` — existing Airtable version also has no retry. Keep `alwaysOutputData: true` and `executeOnce: true` (the existing pattern).

**Plus Unwrap Transform Code node:**
```javascript
{
  "parameters": {
    "jsCode": "// Unwrap NocoDB Data API v3 — field-projected response (only 'Job ID' field)\nconst response = $input.first().json;\nconst records = response.records || [];\n\nif (records.length === 0) {\n  return [{ json: { _empty: true, _message: 'No existing Job IDs found' } }];\n}\n\n// Each record has { fields: { 'Job ID': 'abc123' }, id: 'rec_xxx' }\n// Flatten so downstream dedup code can access record.json['Job ID'] directly\nreturn records.map(record => ({\n  json: {\n    'Job ID': record.fields['Job ID'],\n    id: record.id\n  }\n}));"
  },
  "name": "Unwrap Existing Job IDs",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [2592, -400]
}
```

**Connection:** Aggregate All Jobs → **Get Existing Job IDs** → **Unwrap Existing Job IDs** → Deduplicate vs Pipeline

---

#### Pattern 1D: Airtable "Create Pipeline Records" → HTTP Request POST
**Analog:** `workflows/01d-scanner-jobspy.json`, lines 84-108 (existing "Call JobSpy Scanner" POST HTTP Request) + `workflows/01a-scanner-greenhouse.json`, lines 178-564 (existing Airtable "Create" column mapping)

**Existing Airtable column mapping** (lines 195-209):
```json
"columns": {
  "mappingMode": "defineBelow",
  "value": {
    "Job ID": "={{ $json.jobId }}",
    "Job Title": "={{ $json.jobTitle }}",
    "Company": "={{ $json.company }}",
    "Location": "={{ $json.location }}",
    "Apply Link": "={{ $json.applyLink }}",
    "Job Description": "={{ $json.jobDescription }}",
    "Source": "={{ $json.source }}",
    "Source Query": "={{ $json.sourceQuery }}",
    "Source Tag": "={{ $json.sourceTag }}",
    "Discovery Date": "={{ $json.discoveryDate }}",
    "Status": "New"
  }
}
```

**Replacement — HTTP Request POST with `{ "fields": { ... } }` body:**
```json
{
  "parameters": {
    "method": "POST",
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
    "jsonBody": "={\n  \"fields\": {\n    \"Job ID\": \"{{ $json.jobId }}\",\n    \"Job Title\": \"{{ $json.jobTitle }}\",\n    \"Company\": \"{{ $json.company }}\",\n    \"Location\": \"{{ $json.location }}\",\n    \"Apply Link\": \"{{ $json.applyLink }}\",\n    \"Job Description\": \"{{ $json.jobDescription }}\",\n    \"Source\": \"{{ $json.source }}\",\n    \"Source Query\": \"{{ $json.sourceQuery }}\",\n    \"Source Tag\": \"{{ $json.sourceTag }}\",\n    \"Discovery Date\": \"{{ $json.discoveryDate }}\",\n    \"Status\": \"New\"\n  }\n}",
    "options": {}
  },
  "name": "Create Pipeline Records",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "position": [3248, -400],
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000,
  "alwaysOutputData": true,
  "credentials": {
    "httpHeaderAuth": { "id": "TO_BE_CREATED", "name": "NocoDB API" }
  }
}
```

**JobSpy variant** additionally includes in `jsonBody`:
```json
"Salary Info": "{{ $json.salaryInfo }}"
```

**No unwrap transform needed** — POST returns the created record directly. Downstream nodes are connected to the "If" node's true branch output, not the POST response.

---

### `workflows/01b-scanner-ashby.json` (workflow, CRUD)

**Identical to 1a pattern, with only the `where` clause changed:**
- `where=(Enabled,is,true)~and("Scan Method",eq,"Ashby API")`

All 4 replacement patterns from 1a apply 1:1. No other differences.

---

### `workflows/01c-scanner-lever.json` (workflow, CRUD)

**Identical to 1a pattern, with only the `where` clause changed:**
- `where=(Enabled,is,true)~and("Scan Method",eq,"Lever API")`

All 4 replacement patterns from 1a apply 1:1. No other differences.

---

### `workflows/01d-scanner-jobspy.json` (workflow, CRUD)

**Most complex — adds a new "Get Profile" node at the start, replaces 3 Airtable nodes + edits 1 Code node.**

#### Pattern 1J-1: NEW "Get Profile" HTTP Request + Unwrap (ADD, not replace)
**Analog:** Pattern 1A from 1a scanner. JobSpy currently has NO Get Profile node.

Insert between Schedule/Manual triggers and "Get Search Queries":

```json
// HTTP Request GET — identical to Pattern 1A
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
  "position": [-960, -240],
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000,
  "alwaysOutputData": true,
  "credentials": {
    "httpHeaderAuth": { "id": "TO_BE_CREATED", "name": "NocoDB API" }
  }
}
```

```javascript
// Unwrap Code node — identical to Pattern 1A
{
  "parameters": {
    "jsCode": "// Unwrap NocoDB Data API v3 response\nconst response = $input.first().json;\nconst records = response.records || [];\n\nif (records.length === 0) {\n  return [{ json: { _empty: true, _message: 'No Profile found' } }];\n}\n\nreturn records.map(record => ({\n  json: { ...record.fields, id: record.id }\n}));"
  },
  "name": "Unwrap Profile",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [-848, -240]
}
```

**Connection:**
```
Manual Trigger ──┐
                 ├──▶ Get Profile → Unwrap Profile → Get Search Queries → ...
Schedule Trigger ┘
```

#### Pattern 1J-2: "Get Search Queries" → HTTP Request GET + Unwrap
**Analog:** Pattern 1B, but with Search Queries table and different where clause.

```json
{
  "parameters": {
    "method": "GET",
    "url": "={{ $env.NOCODB_URL }}/api/v3/data/{{ $env.NOCODB_BASE_ID }}/{{ $env.NOCODB_TABLE_QUERIES }}/records?where=(Enabled,is,true)~and(\"Source Type\",eq,\"JobSpy\")",
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
  "name": "Get Search Queries",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "position": [-736, -240],
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000,
  "alwaysOutputData": true,
  "credentials": {
    "httpHeaderAuth": { "id": "TO_BE_CREATED", "name": "NocoDB API" }
  }
}
```

```javascript
// Unwrap Search Queries
{
  "parameters": {
    "jsCode": "// Unwrap NocoDB Data API v3 response\nconst response = $input.first().json;\nconst records = response.records || [];\n\nif (records.length === 0) {\n  return [{ json: { _empty: true, _message: 'No enabled Search Queries found' } }];\n}\n\nreturn records.map(record => ({\n  json: { ...record.fields, id: record.id }\n}));"
  },
  "name": "Unwrap Search Queries",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [-624, -240]
}
```

#### Pattern 1J-3: "Get Existing Job IDs" → HTTP Request GET + Unwrap
**Identical to Pattern 1C.** Same HTTP Request GET with `?fields=Job+ID` and same unwrap.

#### Pattern 1J-4: "Create Pipeline Records" → HTTP Request POST
**Analog:** Pattern 1D with additional `Salary Info` field.

Same as Pattern 1D, but `jsonBody` includes:
```json
"Salary Info": "{{ $json.salaryInfo }}"
```

#### Pattern 1J-5: Fix "Parse & Filter Jobs" — Dynamic Geography from Profile
**Analog:** `workflows/01a-scanner-greenhouse.json` lines 96-97 (existing Profile geography reading pattern in "Parse & Filter Jobs") and `workflows/01b-scanner-ashby.json` lines 65-66 (same pattern).

**Current JobSpy code** (hardcoded):
```javascript
// TODO: Read from Profile.Target Geography in v1.1
const userGeographies = ['Canada', 'Remote Global', 'Remote North America'];
```

**New code** (dynamic from Profile — same pattern as 1a/1b/1c):
```javascript
// Dynamic geography from Profile table (same pattern as Workflows 1a/1b/1c)
const profileData = $('Get Profile').first().json;
const geoField = profileData['Target Geography'];
const userGeographies = Array.isArray(geoField) ? geoField : ['Remote Global'];
```

**Note:** The JobSpy "Parse & Filter Jobs" Code node already uses flat items from the unwrap (no `.fields` nested accessor), so `profileData['Target Geography']` works directly — no fallback needed. This differs from 1a/1b/1c which have the `profileData.fields ? profileData.fields['Target Geography'] : profileData['Target Geography']` pattern.

---

### `docker-compose.example.yml` (config)

**Analog:** `docker-compose.example.yml` lines 40-63 (existing n8n service environment section)

**Current env vars** (lines 46-57):
```yaml
environment:
  - DB_TYPE=postgresdb
  - DB_POSTGRESDB_HOST=db
  - DB_POSTGRESDB_PORT=5432
  - DB_POSTGRESDB_DATABASE=n8n
  - DB_POSTGRESDB_USER=n8n
  - DB_POSTGRESDB_PASSWORD=REPLACE_WITH_YOUR_PASSWORD
  - N8N_METRICS=true
  - N8N_SECURE_COOKIE=true
  - WEBHOOK_URL=https://your-domain.com/
  - NOCDB_API_TOKEN=REPLACE_WITH_TOKEN
  - NOCDB_HOST=http://nocodb:8080
```

**New env vars to add** (after `NOCDB_HOST` line):
```yaml
  - NOCODB_URL=http://nocodb:8080     # Canonical name per D-03 (alias for NOCDB_HOST)
  - NOCODB_BASE_ID=<p_xxxxx>          # From bootstrap output
  - NOCODB_TABLE_PROFILE=<m_xxxxx>    # From bootstrap output
  - NOCODB_TABLE_COMPANIES=<m_xxxxx>  # From bootstrap output
  - NOCODB_TABLE_PIPELINE=<m_xxxxx>   # From bootstrap output
  - NOCODB_TABLE_QUERIES=<m_xxxxx>    # From bootstrap output
```

**Env var naming notes:**
- Existing `NOCDB_HOST=http://nocodb:8080` uses `NOCDB` (missing second 'O'). Keep as-is for backward compat.
- New `NOCODB_URL=http://nocodb:8080` is the canonical name (per D-03).
- HTTP Request nodes use `{{ $env.NOCODB_URL }}` — not `NOCDB_HOST`.
- Bootstrap script outputs `NOCODB_*` prefixed vars (matches new convention).

---

## Shared Patterns

### Pattern: HTTP Header Auth Credential Reference
**Source:** `workflows/03-tailor.json`, lines 645-674 (existing `httpHeaderAuth` credential pattern)

**When creating new HTTP Request nodes, reference the credential like this:**
```json
"authentication": "genericCredentialType",
"genericAuthType": "httpHeaderAuth",
"credentials": {
  "httpHeaderAuth": {
    "id": "TO_BE_CREATED",
    "name": "NocoDB API"
  }
}
```

**Credential to create in n8n UI:**
- Type: HTTP Header Auth
- Name: `NocoDB API`
- Header Name: `xc-token`
- Header Value: The NocoDB API token (from `NOCDB_API_TOKEN` env var)

All 4 scanners share this one credential — consistent with the existing `httpHeaderAuth` pattern used for sidecar services.

---

### Pattern: Retry Configuration
**Source:** `workflows/01a-scanner-greenhouse.json`, lines 78-82 (existing "Fetch Greenhouse API" retry) and lines 556-558 (existing "Create Pipeline Records" retry)

| Property | GET nodes (Profile, Tracked Companies, Search Queries) | GET nodes (Existing Job IDs) | POST nodes (Create Pipeline Records) |
|---|---|---|---|
| `retryOnFail` | `true` | (optional — existing has none) | `true` |
| `maxTries` | `3` | — | `3` |
| `waitBetweenTries` | `5000` | — | `5000` |
| `alwaysOutputData` | `true` | `true` | `true` |
| `continueOnFail` | `false` | `false` | `true` |

**Rationale:**
- GET nodes for config data (Profile, Companies, Queries) — if these fail, the workflow can't proceed. Do NOT set `continueOnFail: true`.
- GET nodes for dedup (Existing Job IDs) — existing Airtable version uses `alwaysOutputData: true` only. Match that.
- POST nodes (Create Pipeline Records) — use `continueOnFail: true` so one failed insert doesn't block subsequent records.
- Unwrap Code nodes need no retry config (they're simple transforms).

---

### Pattern: NocoDB API URL Construction
**All HTTP Request nodes use this pattern:**
```
GET:  ={{ $env.NOCODB_URL }}/api/v3/data/{{ $env.NOCODB_BASE_ID }}/{{ $env.NOCODB_TABLE_* }}/records[?params]
POST: ={{ $env.NOCODB_URL }}/api/v3/data/{{ $env.NOCODB_BASE_ID }}/{{ $env.NOCODB_TABLE_PIPELINE }}/records
```

**Table env var mappings:**
| Table | Env Var |
|---|---|
| Profile | `NOCODB_TABLE_PROFILE` |
| Tracked Companies | `NOCODB_TABLE_COMPANIES` |
| Pipeline | `NOCODB_TABLE_PIPELINE` |
| Search Queries | `NOCODB_TABLE_QUERIES` |

---

### Pattern: `_empty` Sentinel for Empty Results
**Source:** All existing Code nodes (e.g., `workflows/01a-scanner-greenhouse.json`, lines 165-176 "Deduplicate vs Pipeline")

**This pattern already exists in all scanner workflows.** The unwrap transform nodes continue the pattern:
```javascript
if (records.length === 0) {
  return [{ json: { _empty: true, _message: 'No records found' } }];
}
```

---

### Pattern: Existing Code Node Data Access (WITHOUT field nesting) After Unwrap
**Source:** `workflows/01a-scanner-greenhouse.json`, lines 165-176 ("Deduplicate vs Pipeline" handling both nested and flat format)

**The "Deduplicate vs Pipeline" Code node already handles both formats:**
```javascript
for (const record of existingRecords) {
  let jobId = null;
  if (record.json.fields && record.json.fields['Job ID']) {
    jobId = record.json.fields['Job ID'];
  } else if (record.json['Job ID']) {
    jobId = record.json['Job ID'];
  }
  if (jobId) existingIds.add(jobId);
}
```

**After unwrap, the data arrives as flat items.** The fallback branch (`else if (record.json['Job ID'])`) handles this. So **no Code node changes are needed** for dedup logic — it already works with the flat format.

---

### Pattern: NocoDB `where` Clause — Quoted Field Names with Spaces
**Source:** RESEARCH.md (verified against NocoDB docs)

**Syntax:**
```
where=(Enabled,is,true)~and("Field Name With Spaces",eq,"value")
```

| Scanner | `where` value |
|---|---|
| Greenhouse | `(Enabled,is,true)~and("Scan Method",eq,"Greenhouse API")` |
| Ashby | `(Enabled,is,true)~and("Scan Method",eq,"Ashby API")` |
| Lever | `(Enabled,is,true)~and("Scan Method",eq,"Lever API")` |
| JobSpy | `(Enabled,is,true)~and("Source Type",eq,"JobSpy")` |

---

## No Analog Found

| New Node Pattern | Role | Data Flow | Reason |
|---|---|---|---|
| Unwrap Transform Code node | transform | transform | This is a new pattern specific to NocoDB's Data API v3 response format. No existing Code node in the codebase unwraps a `{ records: [...], next, prev }` response. The closest analog is any existing Code node's structure (parameters, typeVersion, etc.) but the JS logic inside is unique. |

## Metadata

**Analog search scope:** `workflows/` (all 8 workflow JSON files), `docker-compose.example.yml`, `airtable/AIRTABLE-SCHEMA.md`
**Files scanned:** 10 (4 scanner workflows + 4 non-scanner workflows + docker-compose + schema)
**Pattern extraction date:** 2026-06-10

**Key correction from RESEARCH.md vs CONTEXT.md:**
- Response shape is `{ records: [...], next, prev }` NOT `{ list: [...], pageInfo: {...} }`
- API path is `/api/v3/data/{baseId}/{tableId}/records` NOT `/api/v3/{base}/{table}/records`
- Env var naming: existing `NOCDB_HOST` (typo) vs decision `NOCODB_URL` — use both for now, canonical is `NOCODB_URL`
