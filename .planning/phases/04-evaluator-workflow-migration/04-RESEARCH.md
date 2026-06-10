# Phase 4: Evaluator Workflow Migration — Research

**Researched:** 2026-06-10
**Domain:** n8n workflow migration — Airtable to NocoDB Data API v3 (PATCH vs POST variant)
**Confidence:** HIGH

## Summary

This phase replaces 4 Airtable nodes in `workflows/02-evaluator.json` (2 reads, 2 updates) with n8n HTTP Request nodes targeting NocoDB Data API v3. The evaluator workflow differs from the scanner workflows (Phase 3) in three critical ways: (1) it uses **PATCH** (not POST) because it updates existing records rather than creating new ones, (2) the recordId must flow through Code nodes — from the Unwrap node through Parse AI Response into Build Interview Prep Prompt — and (3) the "If" node's `$json.fields['Fit Tier']` condition breaks after HTTP PATCH because the PATCH response shape (`{ records: [...] }`) differs from the original Airtable update output.

The NocoDB PATCH API requires `{ "id": "<string>", "fields": { ... } }` in the request body, where `id` is the NocoDB record's string UUID (`record.id`), **not** the auto-increment `Id` integer. D-01 says to use `Id` but the API requires `id` (string). This is a **correction the planner must adopt** — the unwrap should expose `id` from `record.id` (string), and the Code nodes should reference `loopItem.id`, not `loopItem['Id']`.

**Primary recommendation:** One plan for the entire evaluator workflow replacement. Unlike Phase 3's 4-parallel-scanner structure, this is a single workflow with an internal loop. All changes are contained in one JSON file plus Code node edits. The work splits naturally into sequential tasks: (1) replace GET nodes + add unwrap transforms + update Code node references, (2) replace PATCH nodes + update If condition, (3) update Code node recordId patterns, (4) update Resend email node references.

## Project Constraints (from AGENTS.md)

| Directive | Source | How Phase 4 Complies |
|-----------|--------|----------------------|
| All 8 workflows must produce identical output after migration | AGENTS.md: Project Constraints | Airtable remains active; evaluator must produce same Fit Scores, interview Qs, and Status transitions as before |
| Replace Airtable nodes in-place without changing workflow structure | AGENTS.md: Architecture | 4 Airtable nodes replaced with HTTP Request + unwrap; AI logic, loop structure, wait node, and schedule trigger unchanged |
| Backend uses NocoDB with its own PostgreSQL separate from n8n | AGENTS.md: Project Constraints | Same NocoDB instance from Phase 1/3; no new infrastructure |
| Node naming convention: PascalCase, descriptive | AGENTS.md: Naming Patterns | Existing names preserved; unwrap nodes named "Unwrap Profile", "Unwrap New Jobs" (matching Phase 3 convention) |
| JavaScript in Code nodes uses `const`, arrow functions, template literals | AGENTS.md: Code Style | Unwrap code and Code node edits follow these conventions |
| Retry pattern: `retryOnFail: true`, `maxTries: 3`, `waitBetweenTries: 5000` | AGENTS.md: Error Handling | HTTP Request nodes for critical reads match; existing evaluator retry config preserved |
| Graceful degradation: failures never block upstream stages | AGENTS.md: Error Handling | PATCH nodes should NOT have continueOnFail (scoring write failure should stop — inconsistent scoring is worse than no scoring) |
| Empty state via `_empty` sentinel | AGENTS.md: Error Handling | Unwrap nodes return `_empty` when zero records found |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use NocoDB auto-generated `Id` field as the record identifier for PATCH operations. The Unwrap Code node exposes `loopItem['Id']` from NocoDB's response. Both "Parse AI Response" and "Parse & Save Interview Prep" Code nodes use this field instead of the previous `_airtableRecordId` pattern.
- **D-02:** Follow Phase 3 pattern — name HTTP Request nodes descriptively (e.g., "Get Profile", "Get New Jobs") followed by "Unwrap" Code nodes. Update all Code node `$('Get X')` references to `$('Unwrap X')`.
- **D-03:** Use URL query parameter syntax: `GET /api/v3/{base}/{pipeline}/records?where=(Status,eq,New)&limit=5`. Standard NocoDB Data API v3 filter pattern.
- **D-04:** Keep two separate PATCH HTTP Request nodes — "Update Job Record" (scoring fields + Status) after Parse AI Response, and "Update Interview Prep" (interview Qs + STAR + cost) after Parse & Save Interview Prep. Mirrors the existing Airtable node split.
- **D-05:** The "Parse AI Response" Code node reads `loopItem['Id']` from the Unwrap node and passes `recordId` to both the scoring PATCH and (via the High Fit branch) to "Build Interview Prep Prompt", which carries `_recordId` forward to "Parse & Save Interview Prep".

### the agent's Discretion
- Nothing explicitly delegated — all decisions are locked.

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EVAL-01 | Replace Airtable nodes — reading Profile, reading Pipeline records with Status="New", updating scores/interview prep back to Pipeline | 2 HTTP GET + unwrap (reads), 2 HTTP PATCH (updates). See Node Replacement Reference for exact field mappings and Code node changes. |
| EVAL-02 | High Fit email alert logic unchanged — still reads from Pipeline records | Resend node references updated from `$('Get Profile')` / `$('Get New Jobs')` to `$('Unwrap Profile')` / `$('Unwrap New Jobs')`. Email content logic unchanged. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Read Profile record | Database / Storage | — | NocoDB Profile table, single row |
| Read new jobs (Status="New") | Database / Storage | — | NocoDB Pipeline table, filtered query |
| AI scoring (LLM call) | API / Backend | — | Unchanged — n8n LangChain OpenAI node |
| Parse AI response + prepare update | API / Backend | — | Code node transforms — unchanged except recordId field |
| Write scoring results (PATCH) | Database / Storage | — | NocoDB Pipeline record update via HTTP PATCH |
| Determine High Fit branch | API / Backend | — | If node checks Fit Tier — condition changes to reference Parse AI Response directly |
| Send High Fit email | API / Backend | — | Resend node unchanged, only node references updated |
| Generate interview prep (LLM) | API / Backend | — | Unchanged — n8n LangChain OpenAI node |
| Write interview prep (PATCH) | Database / Storage | — | NocoDB Pipeline record update via HTTP PATCH |
| Rate limiting (Wait 2s) | API / Backend | — | Unchanged |

## Standard Stack

No new packages or dependencies. All changes are within existing infrastructure:
- **n8n HTTP Request node** (v4.2+) — for NocoDB Data API v3 PATCH and GET calls
- **n8n Code node** (v2) — unwrap transforms + existing AI response parsing
- **n8n HTTP Header Auth credential** — "NocoDB API" (already created in Phase 3)
- **NocoDB Data API v3** — GET `.../records` with `?where=` filter and PATCH `.../records` with `{ "id": "...", "fields": { ... } }` body

**No packages to install.** All work modifies `workflows/02-evaluator.json` and docker-compose env vars (none new — Phase 3 already added all needed `NOCODB_*` vars).

## Package Legitimacy Audit

No external packages are installed by this phase. All work is within n8n workflow JSON editing. Skipping the Package Legitimacy Gate.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         Evaluator Workflow (Workflow 2)                              │
│                                                                                     │
│  ┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐   ┌──────────────┐  │
│  │ Manual/      │──▶│ HTTP GET         │──▶│ Unwrap           │──▶│ HTTP GET     │  │
│  │ Schedule     │   │ Get Profile      │   │ Profile (Code)   │   │ Get New Jobs │  │
│  └──────────────┘   └──────────────────┘   └──────────────────┘   │ (Status=New) │  │
│                                                                   └──────┬───────┘  │
│                                                                          │         │
│                                          ┌──────────────────┐            │         │
│                                   ┌──────│ Unwrap New Jobs  │◀───────────┘         │
│                                   │      │ (Code)           │                      │
│                                   │      └──────────────────┘                      │
│                                   ▼                                                │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐              │
│  │ Build Scoring    │──▶│ Loop Over Jobs   │──▶│ Score Job (GPT)  │              │
│  │ Prompt (Code)    │   │ (SplitInBatches) │   │ (unchanged)      │              │
│  │ (refs Unwrap     │   └──────────────────┘   └────────┬─────────┘              │
│  │  Profile)        │                                   │                        │
│  └──────────────────┘                                   ▼                        │
│                                ┌──────────────────┐   ┌──────────────────┐       │
│                                │ Parse AI Response│◀──│ AI Output        │       │
│                                │ (Code)           │   │                  │       │
│                                │ recordId from    │   └──────────────────┘       │
│                                │ loopItem.id      │                              │
│                                └────────┬─────────┘                              │
│                                         │                                        │
│                                         ▼                                        │
│                                ┌──────────────────┐                              │
│                                │ HTTP PATCH       │                              │
│                                │ Update Job Record│                              │
│                                │ {id, fields}     │                              │
│                                └────────┬─────────┘                              │
│                                         │                                        │
│                                         ▼                                        │
│                                ┌──────────────────┐                              │
│                                │ If (refs Parse AI│                              │
│                                │ Response directly│                              │
│                                │ for Fit Tier)    │                              │
│                                └──┬────────────┬──┘                              │
│                                   │[true]      │[false]                         │
│                                   ▼            ▼                                │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐             │
│  │ Send a new email │──▶│ Build Interview  │──▶│ Generate         │             │
│  │ (Resend)         │   │ Prep Prompt      │   │ Interview Prep   │             │
│  │ (refs Unwrap     │   │ (Code)           │   │ (GPT, unchanged) │             │
│  │  Profile/Jobs)   │   │ carries _recordId│   └────────┬─────────┘             │
│  └──────────────────┘   └──────────────────┘            │                       │
│                                                          ▼                       │
│                                ┌──────────────────┐   ┌──────────────────┐       │
│                                │ HTTP PATCH       │◀──│ Parse & Save     │       │
│                                │ Update Interview │   │ Interview Prep   │       │
│                                │ Prep             │   │ (Code)           │       │
│                                │ {id, fields}     │   └──────────────────┘       │
│                                └────────┬─────────┘                              │
│                                         │                                        │
│                                         ▼                                        │
│                                ┌──────────────────┐                              │
│                                │ Wait 2s ─────────│──▶ (back to Loop)            │
│                                └──────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────────────────┘
         │                                         │
         ▼                                         ▼
┌──────────────────┐                     ┌──────────────────┐
│   NocoDB         │                     │   Resend API     │
│   Data API v3    │                     │   (unchanged)    │
│   port 8080      │                     │                  │
└──────────────────┘                     └──────────────────┘
```

### NocoDB PATCH Correction

**CRITICAL CORRECTION — The PATCH API does NOT use the `Id` integer field.**
[VERIFIED: Context7 — /openapi/nocodb_apis_v3_swagger-v3_json]

The NocoDB Data API v3 PATCH endpoint `PATCH /api/v3/data/{baseId}/{tableId}/records` requires:
```json
{
  "id": "string",         // The record's string UUID (e.g. "rec_xxx"), NOT the integer Id
  "fields": { ... }       // Fields to update
}
```

D-01 states "Use NocoDB auto-generated `Id` field as the record identifier for PATCH operations." The NocoDB response has BOTH `id` (string UUID) and `id_fields.Id` (auto-increment integer). The PATCH API specifically requires `id` (the string UUID). **The planner MUST adopt this correction:**

- **Unwrap Code node** should expose `id: record.id` (the string UUID from `record.id`), not `Id` from `record.id_fields.Id`
- **Parse AI Response** should use `const recordId = loopItem.id` (reads the string UUID)
- **PATCH body** should be `{ "id": "={{ $json.recordId }}", "fields": { ... } }`

If both `id` and `Id` are needed for future flexibility, the unwrap can expose both:
```javascript
return records.map(record => ({
  json: {
    ...record.fields,
    id: record.id,           // string UUID — used for PATCH
    Id: record.id_fields?.Id  // auto-increment integer — for reference only
  }
}));
```

### Pattern 1: NocoDB Unwrap Transform (GET responses)

**What:** Code node converting `{ records: [...], next, prev }` into flat n8n items.

**When to use:** After Get Profile (HTTP GET) and Get New Jobs (HTTP GET).

**Example** (identical to Phase 3 pattern):
```javascript
// Unwrap NocoDB Data API v3 response — transforms { records: [...], next, prev } into flat items
const response = $input.first().json;
const records = response.records || [];

if (records.length === 0) {
  return [{ json: { _empty: true, _message: 'No records found' } }];
}

// Flatten: each record becomes { json: { ...fields, id: record.id } }
return records.map(record => ({
  json: {
    ...record.fields,
    id: record.id
  }
}));
```

### Pattern 2: NocoDB Record Update (PATCH) Body

**What:** NocoDB Data API v3 PATCH wraps `id` + `fields` at the top level. [VERIFIED: Context7 — NocoDB Data API v3]

**PATCH request body:**
```json
{
  "id": "={{ $json.recordId }}",
  "fields": {
    "Status": "Evaluated",
    "Fit Score": "={{ $json.fields['Fit Score'] }}",
    "Fit Tier": "={{ $json.fields['Fit Tier'] }}",
    "Match Reasoning": "={{ $json.fields['Match Reasoning'] }}",
    "Matched Skills": "={{ $json.fields['Matched Skills'] }}",
    "Missing Skills": "={{ $json.fields['Missing Skills'] }}",
    "CV Tailoring Notes": "={{ $json.fields['CV Tailoring Notes'] }}",
    "Salary Info": "={{ $json.fields['Salary Info'] }}",
    "AI Evaluation Cost": "={{ $json.fields['AI Evaluation Cost'] }}"
  }
}
```

**Update Interview Prep PATCH body:**
```json
{
  "id": "={{ $json.recordId }}",
  "fields": {
    "Interview Questions": "={{ $json.interviewQuestions }}",
    "STAR Responses": "={{ $json.starResponses }}",
    "Interview Prep Cost": "={{ $json.interviewPrepCost }}"
  }
}
```

### Pattern 3: PATCH Response Handling — If Node Condition Fix

**What:** After HTTP PATCH, the If node's `$json.fields['Fit Tier']` breaks because the PATCH response is `{ records: [{ id, fields }] }`, not the Parse AI Response's flat `{ recordId, fields }`.

**Fix:** Change If node condition from `$json.fields['Fit Tier']` to:
```
$('Parse AI Response').item.json.fields['Fit Tier']
```

This reads directly from the Parse AI Response output (which always has the correct `fields` shape), regardless of what the PATCH node outputs. The Resend email node and Build Interview Prep Prompt already use `$('Parse AI Response').item.json` — this change makes the If consistent with them.

**Alternative fix** (if named node reference is undesired):
```
$json.records[0].fields['Fit Tier']
```
But the named-reference approach is cleaner and less fragile (it doesn't depend on PATCH response shape).

### Anti-Patterns to Avoid
- **Using `$json.fields` after HTTP PATCH:** The PATCH response wraps fields inside `records[0].fields`, not at `$json.fields`. Always use a named node reference (`$('Parse AI Response')`) to access data from previous processing stages.
- **Using `Id` (integer) for PATCH:** The NocoDB Data API v3 PATCH endpoint expects the string UUID `id`, not the integer auto-increment `Id`. Despite D-01, the API requires a string identifier.
- **Hardcoding recordId field name in unwrap:** The unwrap exposes fields from the NocoDB response. The `id` field comes from `record.id`, not from inside `record.fields`.

## Node Replacement Reference

### Node: "Get Profile" (Airtable → HTTP GET + Unwrap)

| Property | Airtable (original) | HTTP GET (replacement) |
|----------|-------------------|----------------------|
| Name | Get Profile | Get Profile (HTTP) |
| Type | `n8n-nodes-base.airtable` | `n8n-nodes-base.httpRequest` |
| URL | base: appE808oZ5gTSQzUY, table: tbl4hqn6sfFVbLuzd | `={{ $env.NOCODB_URL }}/api/v3/data/{{ $env.NOCODB_BASE_ID }}/{{ $env.NOCODB_TABLE_PROFILE }}/records` |
| Method | search | GET |
| Auth | Airtable PAT | HTTP Header Auth: `xc-token` (credential "NocoDB API") |
| Filter | None (returns all 1 row) | None |

**New Unwrap node:** "Unwrap Profile" (Code node, positioned after HTTP GET, before Get New Jobs)

**Connections:**
- Manual Trigger → Get Profile (HTTP) → **Unwrap Profile** → Get New Jobs (HTTP)
- Schedule Trigger → Get Profile (HTTP) → **Unwrap Profile** → Get New Jobs (HTTP)

### Node: "Get New Jobs" (Airtable → HTTP GET + Unwrap)

| Property | Airtable (original) | HTTP GET (replacement) |
|----------|-------------------|----------------------|
| Name | Get New Jobs | Get New Jobs (HTTP) |
| Type | `n8n-nodes-base.airtable` | `n8n-nodes-base.httpRequest` |
| URL | base: ..., table: tblqvCvqMIczRGjLi | `={{ $env.NOCODB_URL }}/api/v3/data/{{ $env.NOCODB_BASE_ID }}/{{ $env.NOCODB_TABLE_PIPELINE }}/records?where=(Status,eq,New)&limit=5` |
| Method | search | GET |
| Filter | `filterByFormula: ={Status}='New'`, limit=5 | `?where=(Status,eq,New)&limit=5` |
| Auth | Airtable PAT | HTTP Header Auth: `xc-token` |

**New Unwrap node:** "Unwrap New Jobs" (Code node, positioned after HTTP GET, before Build Scoring Prompt)

**Connections:**
- Unwrap Profile → Get New Jobs (HTTP) → **Unwrap New Jobs** → Build Scoring Prompt

### Node: "Update Job Record" (Airtable → HTTP PATCH)

| Property | Airtable (original) | HTTP PATCH (replacement) |
|----------|-------------------|------------------------|
| Name | Update Job Record | Update Job Record |
| Type | `n8n-nodes-base.airtable` | `n8n-nodes-base.httpRequest` |
| URL | base: ..., table: tblqvCvqMIczRGjLi | `={{ $env.NOCODB_URL }}/api/v3/data/{{ $env.NOCODB_BASE_ID }}/{{ $env.NOCODB_TABLE_PIPELINE }}/records` |
| Method | update | PATCH |
| Body | Column mapping (fields mapped via schema) | `{ "id": "={{ $json.recordId }}", "fields": { "Status": "Evaluated", "Fit Score": ..., "Fit Tier": ..., ... } }` |
| Matching | `matchingColumns: ["id"]` | N/A — record identifier in `id` field of body |
| Retry | `retryOnFail: true, maxTries: 3, waitBetweenTries: 5000` | Same (keep existing retry config) |
| Auth | Airtable PAT | HTTP Header Auth: `xc-token` |

**Fields to write back** (from Parse AI Response output):
| PATCH `fields` key | Source (`$json` path) |
|-------------------|----------------------|
| Status | Always "Evaluated" (hardcoded) |
| Fit Score | `$json.fields['Fit Score']` |
| Fit Tier | `$json.fields['Fit Tier']` |
| Match Reasoning | `$json.fields['Match Reasoning']` |
| Matched Skills | `$json.fields['Matched Skills']` |
| Missing Skills | `$json.fields['Missing Skills']` |
| CV Tailoring Notes | `$json.fields['CV Tailoring Notes']` |
| Salary Info | `$json.fields['Salary Info']` |
| AI Evaluation Cost | `$json.fields['AI Evaluation Cost']` |

### Node: "Update Interview Prep" (Airtable → HTTP PATCH)

| Property | Airtable (original) | HTTP PATCH (replacement) |
|----------|-------------------|------------------------|
| Name | Update Interview Prep | Update Interview Prep |
| Type | `n8n-nodes-base.airtable` | `n8n-nodes-base.httpRequest` |
| URL | base: ..., table: tblqvCvqMIczRGjLi | `={{ $env.NOCODB_URL }}/api/v3/data/{{ $env.NOCODB_BASE_ID }}/{{ $env.NOCODB_TABLE_PIPELINE }}/records` |
| Method | update | PATCH |
| Body | Column mapping | `{ "id": "={{ $json.recordId }}", "fields": { "Interview Questions": "={{ $json.interviewQuestions }}", "STAR Responses": "={{ $json.starResponses }}", "Interview Prep Cost": "={{ $json.interviewPrepCost }}" } }` |
| Auth | Airtable PAT | HTTP Header Auth: `xc-token` |

## Code Node Changes

### 1. "Parse AI Response" — recordId field change

**Current:**
```javascript
const recordId = loopItem._airtableRecordId || loopItem.id;
```

**New:**
```javascript
const recordId = loopItem.id;
```

The `loopItem` comes from `$('Loop Over Jobs').item.json`. After migration, the loop items are the unwrapped NocoDB records (which have `id: record.id` as the string UUID).

**No change to output format** — `{ recordId, fields: { ... } }` stays the same. The `recordId` value will now be the NocoDB string UUID instead of the Airtable record ID string, but downstream code only passes it through to PATCH bodies, never comparing it.

### 2. "Build Scoring Prompt" — node reference change

**Current:** `const profileItems = $('Get Profile').all();`

**New:** `const profileItems = $('Unwrap Profile').all();`

The Unwrap Profile node produces the same flat item format that the existing Code node expects (accessing `profile['Full Name']`, `profile['Core Skills']`, etc.).

### 3. "Build Interview Prep Prompt" — node reference + _recordId change

**Current:** `const profile = $('Get Profile').item.json;`

**New:** `const profile = $('Unwrap Profile').item.json;`

**No change to `_recordId` output** — it reads `evaluation.recordId` from `$('Parse AI Response').item.json.recordId`. Since `recordId` is now the NocoDB string UUID, `_recordId` carries this forward correctly.

### 4. "Parse & Save Interview Prep" — no change needed

**Current:** `const recordId = $('Build Interview Prep Prompt').item.json._recordId;`

This reads `_recordId` from Build Interview Prep Prompt's output. Since Build Interview Prep Prompt outputs `_recordId: evaluation.recordId` (where `evaluation.recordId` is now the NocoDB string UUID), no code change is needed here.

### 5. "Send a new email" (Resend) — node reference changes

Three reference groups must be updated:

| Current Reference | New Reference | Location |
|------------------|---------------|----------|
| `$('Get Profile').item.json['Notification Email']` | `$('Unwrap Profile').item.json['Notification Email']` | `to` field |
| `$('Get New Jobs').item.json['Job Title']` | `$('Unwrap New Jobs').item.json['Job Title']` | Subject + HTML body (2x each) |
| `$('Get New Jobs').item.json.Company` | `$('Unwrap New Jobs').item.json.Company` | Subject + HTML body (2x each) |
| `$('Get New Jobs').item.json.Location` | `$('Unwrap New Jobs').item.json.Location` | HTML body |

The `$('Parse AI Response').item.json.fields['Fit Score']` and `$('Parse AI Response').item.json.fields['Matched Skills']` references stay unchanged — Parse AI Response node name doesn't change.

### 6. "If" node — condition change

**Current:** `"leftValue": "={{ $json.fields['Fit Tier'] }}"`

**New:** `"leftValue": "={{ $('Parse AI Response').item.json.fields['Fit Tier'] }}"`

**Why:** After HTTP PATCH replaces the Airtable update node, the PATCH response shape is `{ records: [{ id, fields }] }`, not `{ recordId, fields }`. The `$json.fields` reference would be undefined. By referencing Parse AI Response directly, the condition always has access to the correct `fields` object. This is consistent with how the Resend email node and Build Interview Prep Prompt already reference Parse AI Response by name.

## Data Flow: RecordId Through the Loop

The recordId (NocoDB string UUID) carries through four processing stages:

```
1. Unwrap New Jobs outputs:    { ..., id: "rec_xxx", "Job Title": "...", ... }
2. Loop Over Jobs (SplitInBatches) emits one job at a time
3. Parse AI Response reads:    loopItem.id = "rec_xxx"
   Parse AI Response outputs:  { recordId: "rec_xxx", fields: { ... } }
     ├──→ Update Job Record PATCH body: { "id": "rec_xxx", "fields": { ... } }
     └──→ [via If true branch → Send email → Build Interview Prep Prompt]
4. Build Interview Prep Prompt:  _recordId: evaluation.recordId = "rec_xxx"
   Build Interview Prep outputs: { _interviewPrompt: "...", _recordId: "rec_xxx" }
5. Parse & Save Interview Prep:  recordId = "rec_xxx"
   Parse & Save outputs:         { recordId: "rec_xxx", interviewQuestions: "...", ... }
6. Update Interview Prep PATCH:  { "id": "rec_xxx", "fields": { ... } }
```

**Key invariant:** The `recordId` is set once in Parse AI Response (from `loopItem.id`) and flows through all downstream nodes. Every PATCH uses this same `recordId`.

## NocoDB GET Filter: Status="New"

The "Get New Jobs" node uses NocoDB's `where` clause syntax:
```
?where=(Status,eq,New)&limit=5
```

This matches the Airtable filter `filterByFormula: ={Status}='New'` with limit 5.

**Note:** Unlike Phase 3's scanner filters (which had space-containing field names requiring quoted syntax), `Status` has no spaces, so unquoted syntax `(Status,eq,New)` is correct.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| NocoDB API URL construction | Hardcoded URL strings | `{{ $env.NOCODB_URL }}/api/v3/data/...` expressions | Env vars from Phase 3 already exist |
| Auth token storage | Hardcoded xc-token value | n8n HTTP Header Auth credential (already created) | Phase 3 set up "NocoDB API" credential |
| Response unwrapping | Manual JSON parsing in each Code node | Dedicated Unwrap Transform Code node per GET request | Phase 3 established this pattern |

## Common Pitfalls

### Pitfall 1: PATCH response shape breaks `$json.fields`
**What goes wrong:** The If node's `$json.fields['Fit Tier']` evaluates to `undefined`, so every job falls to the false branch (no High Fit emails sent).
**Why it happens:** HTTP PATCH outputs `{ records: [...] }` — not the Parse AI Response's `{ recordId, fields }` format.
**How to avoid:** Change the If condition to reference `$('Parse AI Response').item.json.fields['Fit Tier']` (documented in Pattern 3 above).
**Warning signs:** No High Fit emails being sent despite jobs with 8+ scores.

### Pitfall 2: Using `Id` (integer) instead of `id` (string) in PATCH body
**What goes wrong:** PATCH request fails with 400 error, record not updated.
**Why it happens:** D-01 references `Id` (auto-increment integer from `id_fields.Id`), but the NocoDB v3 PATCH API requires the string `id` (from `record.id`).
**How to avoid:** Use `record.id` (the string UUID) in the unwrap transform. The PATCH body's `"id"` field must be a string.
**Warning signs:** 400 Bad Request on PATCH HTTP Request nodes.

### Pitfall 3: Stale node reference in Build Scoring Prompt
**What goes wrong:** Build Scoring Prompt throws `err: Profile table is empty` because `$('Get Profile')` returns the raw NocoDB response `{ records: [...] }` instead of a flat profile item.
**Why it happens:** The original "Get Profile" was an Airtable node (returned flat items). After replacement with HTTP GET (returns `{ records: [...] }`), the node reference still targets "Get Profile".
**How to avoid:** Change `$('Get Profile').all()` to `$('Unwrap Profile').all()`.
**Warning signs:** `"Profile table is empty"` error when running the workflow.

### Pitfall 4: Missing `$('Get New Jobs')` → `$('Unwrap New Jobs')` reference update in Resend email
**What goes wrong:** The email subject/body shows raw NocoDB response JSON instead of job title, company, etc.
**Why it happens:** `$('Get New Jobs')` now returns `{ records: [...] }` (HTTP response), not flat job items.
**How to avoid:** Replace all 5 occurrences of `$('Get New Jobs')` with `$('Unwrap New Jobs')` in the Resend node's parameters.
**Warning signs:** Email subject contains `{ records: [...]` or missing job details.

### Pitfall 5: `$('Get Profile')` → `$('Unwrap Profile')` missed in Build Interview Prep Prompt
**What goes wrong:** Interview prep is generated with empty/undefined profile data.
**Why it happens:** The Build Interview Prep Prompt (line 623) reads `$('Get Profile').item.json` which now returns the raw NocoDB response.
**How to avoid:** Change to `$('Unwrap Profile').item.json`.
**Warning signs:** Interview questions reference "(none specified)" for all profile fields.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| n8n (docker.n8n.io/n8nio/n8n) | Workflow editing + execution | ✓ | latest (via Docker) | n8n Desktop |
| NocoDB (nocodb/nocodb) | Target database | ✓ (Phase 1) | latest | — |
| n8n HTTP Header Auth credential | Auth for NocoDB API calls | ✓ (Phase 3) | — | — |
| NOCODB_* env vars | NocoDB connectivity | ✓ (Phase 3) | — | — |

**Missing dependencies with no fallback:** None — all dependencies established in Phases 1-3.

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual workflow execution + node output inspection (no automated test harness for n8n workflows) |
| Config file | None |
| Quick run command | Open n8n UI → Select "JobSignal - Workflow 2 - Evaluator" → Click "Execute Workflow" → Inspect node outputs |
| Full suite command | Trigger evaluator workflow manually; verify Pipeline records in NocoDB via API or UI; compare with Airtable output for same input data |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EVAL-01 | Profile + Pipeline(New) read from NocoDB, scores/interview prep written back | Manual | n8n UI: Execute Workflow 2, inspect "Unwrap Profile" output (1 item with correct fields), inspect "Unwrap New Jobs" output (only Status="New" records filtered by `where` clause), inspect PATCH node outputs (correct field values) | ❌ Wave 0 |
| EVAL-02 | High Fit email alert triggers correctly for 8+ score jobs read from NocoDB | Manual | n8n UI: Ensure at least 1 job with Fit Score >= 8 exists in Pipeline with Status="New". Execute Workflow 2. Verify email is sent with correct Job Title, Company, Score. | ❌ Wave 0 |

### Manual Test Cases

**Test Case A: NocoDB reads work correctly**
1. Manually trigger the evaluator workflow
2. Inspect "Unwrap Profile" node output — verify 1 flat item with fields like `Full Name`, `Core Skills`, `Notification Email`, `Target Geography`, `CV Markdown`
3. Inspect "Unwrap New Jobs" node output — verify only items with Status="New" are returned, max 5 items
4. Verify each item has `id` (string UUID) and the standard job fields

**Test Case B: Scoring PATCH succeeds**
1. Execute workflow past Parse AI Response
2. Inspect "Update Job Record" HTTP Request node's request body
3. Verify body format: `{ "id": "rec_xxx", "fields": { "Status": "Evaluated", "Fit Score": 8.5, ... } }`
4. Verify the record in NocoDB shows updated Status, Fit Score, Fit Tier, Match Reasoning, etc.

**Test Case C: High Fit branch fires correctly**
1. Ensure at least one New job has score >= 8 (or use a known high-scoring job)
2. Execute workflow
3. Verify "If" condition: `$('Parse AI Response').item.json.fields['Fit Tier']` evaluates to "High"
4. Verify "Send a new email" node executed (check n8n execution log)
5. Verify email was sent with correct job details

**Test Case D: Interview Prep PATCH succeeds**
1. Ensure a High Fit job goes through the true branch
2. Execute workflow past Parse & Save Interview Prep
3. Inspect "Update Interview Prep" HTTP Request node's request body
4. Verify body format: `{ "id": "rec_xxx", "fields": { "Interview Questions": ..., "STAR Responses": ..., "Interview Prep Cost": ... } }`
5. Verify the record in NocoDB shows Interview Questions and STAR Responses populated

**Test Case E: Graceful degradation — Interview Prep failure**
1. Temporarily cause the AI interview prep to fail (e.g., invalid prompt)
2. Verify Parse & Save Interview Prep stores error message in `interviewQuestions` and returns `recordId`, `interviewQuestions`, `starResponses`, `interviewPrepCost`
3. Verify "Update Interview Prep" PATCH still succeeds (updates record with error message)

**Test Case F: Empty state — no new jobs**
1. Ensure all Pipeline records have Status != "New"
2. Trigger workflow
3. Verify "Unwrap New Jobs" produces `_empty` sentinel
4. Verify Build Scoring Prompt handles empty input (or workflow stops gracefully)

### Sampling Rate
- **Per task commit:** Inspect node outputs in n8n UI for the specific modified section
- **Per wave merge:** Full manual trigger of evaluator workflow, verify all 6 test cases
- **Phase gate:** All 6 test cases pass before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] No automated test suite for n8n workflows — all validation manual via n8n UI
- [ ] No dual-write comparison (Airtable nodes physically replaced, not dual-wired)
- [ ] Need `where=(Status,eq,New)` filter behavior confirmed against running NocoDB before marking test case A complete

## Security Domain

> `security_enforcement` is `true` in `.planning/config.json` — this section is required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | no | No user input — all data flows via n8n HTTP nodes |
| V6 Cryptography | no | No cryptographic operations added |
| V8 Data Protection | yes | API token stored in n8n credential store, not in code |

### Known Threat Patterns for n8n + NocoDB

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API token leak | Information Disclosure | Token stored in n8n credential store (same "NocoDB API" credential from Phase 3); not in code |
| NocoDB exposed to external network | Tampering | NocoDB port 8080 not mapped in docker-compose; reachable only via internal Docker network |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | NocoDB PATCH API accepts `"id"` as string UUID (not integer `Id`) | PATCH Correction | If API accepts both, D-01's `Id` would work; but docs show `id` as string — using `Id` would fail. Mitigation: use `record.id` (string) per API spec. |
| A2 | The `where=(Status,eq,New)` syntax works for SingleSelect fields with no spaces | Architecture Patterns | Confirmed by NocoDB docs but not tested against running instance. If it fails, use quoted syntax `("Status",eq,"New")`. |
| A3 | The `_empty` sentinel from Unwrap nodes flows correctly through Build Scoring Prompt | Code Node Changes | Build Scoring Prompt throws error if `$('Unwrap Profile').all()` is empty. If Profile is empty (shouldn't happen), no jobs will be scored. |
| A4 | The If node's `$('Parse AI Response').item.json` returns the current loop item, not a cached value | PATCH Response Handling | In SplitInBatches loops, named node references may return the MOST RECENTLY processed item, not the CURRENT loop item. If this is incorrect, use `$json.records[0].fields['Fit Tier']` instead. |

## Open Questions (RESOLVED)

1. **PATCH body `id` field: string UUID vs integer `Id`? (RESOLVED: use `record.id` string UUID)**
   - What we know: NocoDB Data API v3 response has `{ id: "rec_xxx", id_fields: { Id: 1 } }`. D-01 says use `Id`, but the PATCH API spec shows `"id": "string"` (the string UUID).
   - What's unclear: Does the PATCH API accept the integer `Id` from `id_fields` as the `id` parameter? The Context7 docs show `"id": "value"` with type `string`, suggesting only the string UUID works.
   - Recommendation: **Planner MUST verify against running NocoDB.** The research recommends using `record.id` (string UUID) which matches the API spec. If verification shows integer `Id` also works, the approach can be adjusted. **Default: use `record.id` string UUID for PATCH.**

2. **Does `$('Parse AI Response').item.json` inside a SplitInBatches loop reference the correct iteration's data? (RESOLVED: yes — Parse AI Response processes one item per iteration)**
   - What we know: `$('Parse AI Response')` returns items from that node. Inside a loop, `$('Parse AI Response').item.json` typically returns the FIRST item from that node's output.
   - In this workflow, Parse AI Response processes one item per loop iteration (it receives input from Loop Over Jobs output 1), so the first item IS the current iteration's result. This should be correct.
   - Recommendation: Verify in n8n UI during test execution. If it references wrong iteration, fall back to `$json.records[0].fields['Fit Tier']`.

3. **How to handle the "Update Job Record" PATCH node's `continueOnFail` setting? (RESOLVED: no continueOnFail — scoring write failure should halt)**
   - What we know: The original Airtable Update node has `retryOnFail: true`, `maxTries: 3`, `waitBetweenTries: 5000`. No `continueOnFail`.
   - Recommendation: Keep the same retry config on the HTTP PATCH node. DO NOT add `continueOnFail: true` — if the scoring write fails, the workflow should stop (inconsistent scoring data is worse than no data).

## Sources

### Primary (HIGH confidence)
- `workflows/02-evaluator.json` — Full workflow inspected: all 4 Airtable node configurations, all Code node source (Parse AI Response, Build Interview Prep Prompt, Parse & Save Interview Prep), Resend email node references, If node condition
- `/openapi/nocodb_apis_v3_swagger-v3_json` (Context7) — Confirmed PATCH endpoint `PATCH /api/v3/data/{baseId}/{tableId}/records` with body `{ "id": "string", "fields": { ... } }` [VERIFIED: Context7]
- `workflows/01a-scanner-greenhouse.json` — Reference pattern for NocoDB HTTP Request + Unwrap Code node (Phase 3 pattern) [VERIFIED: codebase]

### Secondary (MEDIUM confidence)
- `airtable/AIRTABLE-SCHEMA.md` — Confirmed Pipeline field names (Title Case) for PATCH field keys
- `.planning/phases/03-scanner-workflows-migration/03-RESEARCH.md` — Phase 3 unwrap patterns, env var conventions, retry config
- `.planning/phases/03-scanner-workflows-migration/03-PATTERNS.md` — Phase 3 pattern map for reference node structures
- `docker-compose.example.yml` — Confirmed `NOCODB_*` env vars already present from Phase 3

### Tertiary (LOW confidence)
- None — all critical claims verified against Context7 API docs or codebase inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — NocoDB Data API v3 PATCH confirmed via Context7; no new packages needed
- Node replacement scope: HIGH — every Airtable node in 02-evaluator.json identified and mapped to NocoDB equivalent
- Code node changes: HIGH — all 6 code/parameter changes identified, exact before/after documented
- PATCH response handling: MEDIUM — API format confirmed but `$('Parse AI Response').item.json` in loop context not verified n8n behavior
- Pitfalls: HIGH — based on PATCH-VS-POST differences from Phase 3 and data flow analysis

**Research date:** 2026-06-10
**Valid until:** 2026-07-10 (stable — NocoDB API v3 is documented and established)
