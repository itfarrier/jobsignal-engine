# Phase 3: Scanner Workflows Migration — Research

**Researched:** 2026-06-10
**Domain:** n8n workflow migration — Airtable to NocoDB Data API v3
**Confidence:** MEDIUM

## Summary

This phase replaces all Airtable nodes in the 4 scanner workflows (01a Greenhouse, 01b Ashby, 01c Lever, 01d JobSpy) with n8n HTTP Request nodes targeting NocoDB's Data API v3. Code node logic (parsing, FNV-1a deduplication, geography filtering) remains untouched — only the database backend is swapped. Airtable stays active; cutover is Phase 8.

**Key discoveries:**
- The NocoDB Data API v3 response format is `{ records: [...], next, prev }` — NOT `{ list: [...], pageInfo: {...} }` as stated in CONTEXT.md D-06. The unwrap transform must key on `records`, not `list`. This is a correction the planner MUST adopt.
- The API endpoint path is `/api/v3/data/{baseId}/{tableId}/records` — NOT `/api/v3/{base}/{table}/records` as stated in CONTEXT.md D-10.
- Existing Code nodes already handle both Airtable's nested `fields` format and flat format — the unwrap transforms produce flat items, so **no Code node changes are needed** for existing dedup/parsing logic (except JobSpy's geography TODO).
- The existing docker-compose uses `NOCDB_HOST` and `NOCDB_API_TOKEN` env vars (note: `NOCDB` missing the second 'O'), while CONTEXT.md D-03 standardizes on `NOCODB_URL`. This naming inconsistency must be resolved.
- JobSpy (1d) has a hardcoded `const userGeographies = ['Canada', 'Remote Global', 'Remote North America']` with a `// TODO: Read from Profile.Target Geography in v1.1` comment — D-11 fixes this by adding a "Get Profile" node and reading from it.
- The NocoDB `where` clause for a v3 API with space-containing field names supports quoting: `("Scan Method",eq,"Greenhouse API")` makes the filter expression robust.

**Primary recommendation:** One plan per scanner workflow (4 plans), with a potential 5th plan for docker-compose env var updates and n8n credential setup. Execute in order: 1a (reference pattern) → 1b → 1c → 1d (most complex, adds Profile node).

## Project Constraints (from AGENTS.md)

The AGENTS.md file contains the following actionable directives that apply to this phase:

| Directive | Source | How Phase 3 Complies |
|-----------|--------|----------------------|
| All 8 workflows must produce identical output after migration | AGENTS.md: Project Constraints | Airtable remains active (cutover at Phase 8); scanner workflows must produce same Pipeline records as before |
| Replace Airtable nodes in-place without changing workflow structure | AGENTS.md: Architecture (replace Airtable nodes in-place) | Nodes are replaced with HTTP Request + unwrap transform; existing Code node logic and connection flow remain unchanged |
| Backend uses NocoDB with its own PostgreSQL separate from n8n | AGENTS.md: Project Constraints | NocoDB is already deployed via Phase 1; this phase only changes how scanners talk to it |
| GSD workflow enforcement — use GSD commands before editing | AGENTS.md: GSD Workflow Enforcement | Planner will create PLAN.md; phase follows `/gsd-execute-phase` |
| Node naming convention: PascalCase, descriptive (e.g., "Get Profile") | AGENTS.md: Naming Patterns | New HTTP Request nodes follow existing naming: "Get Profile", "Get Tracked Companies", "Get Existing Job IDs", "Create Pipeline Records" |
| JavaScript in Code nodes uses `const`, arrow functions, template literals | AGENTS.md: Code Style | Unwrap transform code follows these conventions |
| Retry pattern: `retryOnFail: true`, `maxTries: 3`, `waitBetweenTries: 5000` | AGENTS.md: Error Handling | HTTP Request nodes configured with matching retry config |
| Graceful degradation: failures never block upstream stages | AGENTS.md: Error Handling | GET nodes should NOT have continueOnFail (data is required); POST can use continueOnFail |
| Empty state handling via `_empty` sentinel | AGENTS.md: Error Handling | Unwrap transform returns `_empty` sentinel when zero records found |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use n8n HTTP Request nodes to call NocoDB Data API v3 — NOT the n8n native NocoDB node
- **D-02:** Authenticate via n8n "HTTP Header Auth" credential with `xc-token` header. One credential shared across all 4 scanners.
- **D-03:** NocoDB internal URL via `NOCODB_URL` env var (e.g., `http://nocodb:8080`)
- **D-04:** Base and table IDs via env vars: `NOCODB_BASE_ID`, `NOCODB_TABLE_PROFILE`, `NOCODB_TABLE_COMPANIES`, `NOCODB_TABLE_PIPELINE`, `NOCODB_TABLE_QUERIES`
- **D-05:** Bootstrap script prints env var assignments to stdout; user copies into docker-compose
- **D-06:** Add unwrap transform node after each NocoDB HTTP Request (**CORRECTION:** response is `{ records: [...], next, prev }` not `{ list: [...], pageInfo: {...} }`)
- **D-07:** NocoDB column names use Title Case matching Airtable fields
- **D-08:** Each scanner workflow keeps its own "Get Profile" HTTP Request node
- **D-09:** Fix JobSpy TODO — add Profile reading with Target Geography
- **D-10:** Use field projection: `?fields=Job+ID` (**CORRECTION:** endpoint path is `/api/v3/data/{baseId}/{tableId}/records`)
- **D-11:** JobSpy scanner (1d) gains a "Get Profile" node + geography filtering

### the agent's Discretion
- Nothing explicitly delegated — all decisions are locked.

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCAN-01 | Replace Airtable nodes in Greenhouse scanner (1a) — 4 Airtable nodes replaced | 3 GET + 1 POST HTTP Request nodes + 3 unwrap transforms |
| SCAN-02 | Replace Airtable nodes in Ashby scanner (1b) — same pattern as 1a | Same node replacement count, filter targets Ashby API |
| SCAN-03 | Replace Airtable nodes in Lever scanner (1c) — same pattern as 1a | Same node replacement count, filter targets Lever API |
| SCAN-04 | Replace Airtable nodes in JobSpy scanner (1d) — includes Search Queries, adds Get Profile | 1 NEW Get Profile node + 3 Airtable replacements + 1 Code node edit |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Database read (config) | Database / Storage | — | Reads Profile, Tracked Companies, Search Queries from NocoDB |
| Database read (dedup) | Database / Storage | — | Reads Pipeline Job IDs to check for duplicates |
| Database write (Pipeline) | Database / Storage | — | Creates new Pipeline records after deduplication |
| Data transformation | API / Backend | — | Code node transforms happen in n8n, database calls are pure I/O |
| API orchestration | API / Backend | — | n8n orchestrates HTTP calls to NocoDB, Greenhouse/Ashby/Lever APIs, and JobSpy sidecar |
| HTTP auth/credential | API / Backend | — | n8n HTTP Header Auth credential manages xc-token, not exposed to other tiers |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| n8n HTTP Request node | v4.2+ | Make HTTP calls to NocoDB Data API v3 | D-01: locked decision, replaces native Airtable nodes |
| n8n Code node | v2 | Unwrap transforms + existing parsing/dedup | Already the standard for n8n business logic in this project |
| n8n HTTP Header Auth credential | — | Store `xc-token` for NocoDB auth | D-02: locked decision, matches existing sidecar auth pattern |
| NocoDB Data API v3 | — | REST API for CRUD on NocoDB tables | D-01: target API version; confirmed via direct Context7 query on `/openapi/nocodb_apis_v3_swagger-v3_json` [VERIFIED: Context7] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| n8n HTTP Request node | n8n native NocoDB node | n8n NocoDB node targets API v2 and has a stalled v3 migration PR — not viable [CITED: CONTEXT.md D-01] |
| Unwrap Code node | n8n Set node | Code node is more explicit and can handle empty-record edge cases; Set node works too if response shape is always consistent |

**No packages to install.** This phase modifies existing n8n workflow JSON files and docker-compose. No npm/pip packages involved.

## Package Legitimacy Audit

No external packages are installed by this phase. All work is within n8n workflow JSON editing, docker-compose env var configuration, and n8n credential creation. Skipping the Package Legitimacy Gate — no packages to audit.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Scanner Workflow (1a/1b/1c/1d)                      │
│                                                                             │
│  ┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐            │
│  │ Manual/      │──▶│ HTTP Request     │──▶│ Unwrap Transform │            │
│  │ Schedule     │   │ GET /Profile     │   │ (Code node)      │            │
│  └──────────────┘   └──────────────────┘   └──────────────────┘            │
│                            │                                               │
│                            ▼                                               │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐        │
│  │ HTTP Request     │──▶│ Unwrap Transform │──▶│ Loop Companies   │──▶ ... │
│  │ GET /Companies   │   │ (Code node)      │   │ (SplitInBatches) │        │
│  │ (with where=)    │   └──────────────────┘   └──────────────────┘        │
│  └──────────────────┘                                                      │
│                                                                             │
│  (after Aggregation)                                                       │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐        │
│  │ HTTP Request     │──▶│ Unwrap Transform │──▶│ Deduplicate vs   │        │
│  │ GET /Pipeline    │   │ (Code node)      │   │ Pipeline (Code)  │        │
│  │ ?fields=Job+ID   │   └──────────────────┘   └──────────────────┘        │
│  └──────────────────┘                            │                        │
│                                                  ▼                        │
│  ┌──────────────────┐   ┌──────────────────┐                              │
│  │ HTTP Request     │◀──│ If (JobId exists)│                              │
│  │ POST /Pipeline   │   └──────────────────┘                              │
│  │ {fields: {...}}  │                                                     │
│  └──────────────────┘                                                     │
│                                                                             │
│  JobSpy (1d) variant: ADD "Get Profile" node at start                      │
│  JobSpy (1d) variant: "Get Search Queries" replaces "Get Tracked Companies"│
└─────────────────────────────────────────────────────────────────────────────┘
         │                                │
         ▼                                ▼
┌──────────────────┐          ┌──────────────────┐
│   NocoDB         │          │ External APIs    │
│   Data API v3    │          │ (GH/Ashby/Lever  │
│   port 8080      │          │  JobSpy sidecar) │
└──────────────────┘          └──────────────────┘
```

### Data Flow (Greenhouse Scanner 1a)

1. **Get Profile** → HTTP GET to `/api/v3/data/{baseId}/{profileId}/records` → unwrap `records[0].fields` → flat item with `Target Geography`, `Core Skills`, etc.
2. **Get Tracked Companies** → HTTP GET to `/api/v3/data/{baseId}/{companiesId}/records?where=(Enabled,is,true)~and("Scan Method",eq,"Greenhouse API")` → unwrap each `record.fields` → flat items
3. **Loop Companies** → SplitInBatches (unchanged)
4. **Prepare Company Data** → Code node (unchanged)
5. **Fetch Greenhouse API** → HTTP Request to external (unchanged)
6. **Parse & Filter Jobs** → Code node (unchanged, reads Profile via `$('Get Profile').first().json`)
7. **Fetch Job Detail / Merge Descriptions** → Code + HTTP (unchanged)
8. **Wait → Aggregate All Jobs** (unchanged)
9. **Get Existing Job IDs** → HTTP GET to `/api/v3/data/{baseId}/{pipelineId}/records?fields=Job+ID` → unwrap → flat items with `Job ID`
10. **Deduplicate vs Pipeline** → Code node (unchanged, handles flat `record.json['Job ID']` already)
11. **If** (unchanged)
12. **Create Pipeline Records** → HTTP POST to `/api/v3/data/{baseId}/{pipelineId}/records` with body `{ "fields": { "Job ID": "...", ... } }`

### Response Shape Correction

**CONTEXT.md D-06 states:**
> unwrap the `{ list: [...], pageInfo: {...} }` response into flat items

**Actual NocoDB Data API v3 response format** [VERIFIED: Context7 — /openapi/nocodb_apis_v3_swagger-v3_json]:
```json
{
  "records": [
    {
      "id": "rec_id_string",
      "id_fields": { "Id": 1 },
      "fields": {
        "Job ID": "abc123",
        "Job Title": "Software Engineer",
        "Company": "Acme Corp",
        "Location": "Remote",
        "Apply Link": "https://...",
        "Job Description": "...",
        "Source": "Greenhouse",
        "Source Query": "...",
        "Source Tag": "...",
        "Discovery Date": "2026-06-10",
        "Status": "New",
        "Salary Info": null
      }
    }
  ],
  "next": null,
  "prev": null
}
```

The unwrap transform MUST key on `records`, not `list`. The planner MUST adopt this correction.

### Recommended Project Structure

```
workflows/
├── 01a-scanner-greenhouse.json   ← MODIFIED: 4 Airtable → 4 HTTP Request + 3 unwrap nodes
├── 01b-scanner-ashby.json        ← MODIFIED: same pattern as 1a
├── 01c-scanner-lever.json        ← MODIFIED: same pattern as 1a
└── 01d-scanner-jobspy.json       ← MODIFIED: ADD Get Profile, 3 Airtable → HTTP + unwrap, Code edit

docker-compose.example.yml        ← MODIFIED: add NOCODB_* env vars to n8n service
```

### Pattern 1: NocoDB Unwrap Transform Code Node

**What:** A Code node that converts NocoDB's `{ records: [...], next, prev }` response into flat n8n items.

**When to use:** After every NocoDB GET request (Profile, Tracked Companies, Pipeline, Search Queries).

**Example:**
```javascript
// Unwrap NocoDB Data API v3 response — transforms { records: [...], next, prev } into flat items
const response = $input.first().json;
const records = response.records || [];

if (records.length === 0) {
  return [{ json: { _empty: true, _message: 'No records found' } }];
}

// Flatten: each record becomes { json: { ...fields, id: record.id } }
// This allows downstream nodes to access record.json['Job ID'] directly
return records.map(record => ({
  json: {
    ...record.fields,
    id: record.id
  }
}));
```

### Pattern 2: NocoDB `where` Clause — Filter with Space-Containing Field Names

**What:** Use NocoDB v3 quoted where syntax to safely handle field names with spaces.

**NocoDB v3 `where` syntax** [VERIFIED: Context7 — NocoDB docs]:
```text
where=("Field Name",operator,"value")~and("Field 2",eq,"value2")
```

**Scanner filter mappings:**

| Scanner | Airtable filter | NocoDB `where` |
|---------|----------------|----------------|
| Greenhouse | `=AND({Enabled}=TRUE(),{Scan Method}='Greenhouse API')` | `where=(Enabled,is,true)~and("Scan Method",eq,"Greenhouse API")` |
| Ashby | `=AND({Enabled}=TRUE(),{Scan Method}='Ashby API')` | `where=(Enabled,is,true)~and("Scan Method",eq,"Ashby API")` |
| Lever | `=AND({Enabled}=TRUE(),{Scan Method}='Lever API')` | `where=(Enabled,is,true)~and("Scan Method",eq,"Lever API")` |
| JobSpy (Search Queries) | `=AND({Enabled}=TRUE(),{Source Type}='JobSpy')` | `where=(Enabled,is,true)~and("Source Type",eq,"JobSpy")` |

**Key details:**
- Checkbox/boolean: use `(Enabled,is,true)` (NocoDB uses the `is` operator for boolean, or `eq,1`)
- Single select: use quoted string value: `("Scan Method",eq,"Greenhouse API")`
- NocoDB v3 allows double quotes `"value"`, single quotes `'value'`, or backticks `` `value` `` for values with special characters

### Pattern 3: NocoDB Record Creation (POST) Body

**What:** NocoDB Data API v3 wraps fields in a `fields` object for POST record creation.

**n8n HTTP Request node JSON Body** [VERIFIED: Context7 — NocoDB Data API v3]:
```json
{
  "fields": {
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

**JobSpy variant** additionally includes:
```json
"Salary Info": "={{ $json.salaryInfo }}"
```

### Anti-Patterns to Avoid
- **Hardcoding URLs/IDs:** Never hardcode `http://nocodb:8080`, base IDs, or table IDs in HTTP Request node URLs. Always use `{{ $env.NOCODB_URL }}`, `{{ $env.NOCODB_BASE_ID }}`, `{{ $env.NOCODB_TABLE_* }}` expressions.
- **Skipping unwrap transforms:** The raw NocoDB response has a `{ records: [...], next, prev }` structure. Downstream Code nodes expect flat items. Always insert the unwrap transform.
- **Bulk POST without checking:** NocoDB POST creates one record per request body (or accepts arrays). The "Create Pipeline Records" node processes items one-at-a-time from the loop — each item should be a separate POST.
- **Using Bearer token:** The xc-token header (not Bearer) is the standard NocoDB v3 auth mechanism per D-02.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| NocoDB API URL construction | Hardcoded URL strings | `{{ $env.NOCODB_URL }}/api/v3/data/...` expressions | Env vars make the stack portable between local dev and VPS |
| Auth token storage | Hardcoded xc-token value | n8n HTTP Header Auth credential | n8n manages credential secrets; one credential shared across all scanners |
| Response unwrapping | Manual JSON parsing in each Code node | Dedicated Unwrap Transform Code node per GET request | Consistent abstraction — if the API response shape changes, update one node pattern |

## Common Pitfalls

### Pitfall 1: Wrong Response Field Key
**What goes wrong:** The unwrap transform tries `response.list` which is undefined, causing downstream nodes to get empty arrays.
**Why it happens:** CONTEXT.md D-06 describes the incorrect response shape `{ list: [...], pageInfo: {...} }`.
**How to avoid:** Use `response.records` (the actual NocoDB Data API v3 field). The correction is flagged in this research.
**Warning signs:** Downstream Code nodes receive zero items even though data exists in NocoDB.

### Pitfall 2: URL Path Mismatch
**What goes wrong:** HTTP Request node returns 404.
**Why it happens:** API base path differs from documentation. The actual path is `/api/v3/data/{baseId}/{tableId}/records` (note `/data/` segment), not `/api/v3/{base}/{table}/records`.
**How to avoid:** Always use the full path pattern: `{{ $env.NOCODB_URL }}/api/v3/data/{{ $env.NOCODB_BASE_ID }}/{{ $env.NOCODB_TABLE_* }}/records`.
**Warning signs:** 404 errors on the first NocoDB HTTP call.

### Pitfall 3: `where` Clause Fails on Space-Containing Field Names
**What goes wrong:** The where filter returns all records (no filtering) or errors out.
**Why it happens:** Field names like `Scan Method` and `Source Type` contain spaces. Without v3 quoting, the where parser may interpret them incorrectly.
**How to avoid:** Always use NocoDB v3 quoted syntax: `("Field Name",eq,"value")`.
**Warning signs:** Too many records returned (no filtering applied).

### Pitfall 4: POST Body Format
**What goes wrong:** Creating Pipeline records fails with a 400 error.
**Why it happens:** The POST body format is `{ "fields": { ... } }` (nested), not flat column-value pairs like in the Airtable node mapping.
**How to avoid:** Always wrap the column values in a `"fields"` object in the JSON body.
**Warning signs:** 400 Bad Request on the Create Pipeline Records HTTP Request node.

### Pitfall 5: Environment Variable Name Mismatch
**What goes wrong:** HTTP Request nodes fail because `$env.NOCODB_URL` is undefined.
**Why it happens:** The existing docker-compose uses `NOCDB_HOST` (note: `NOCDB` not `NOCODB`, and `HOST` not `URL`). Phase 3 decisions use `NOCODB_URL`. These must be reconciled.
**How to avoid:** Standardize on the `NOCODB_*` naming. Either rename existing `NOCDB_HOST` to `NOCODB_URL`, or add `NOCODB_URL` as a new alias and decide on the canonical name.
**Warning signs:** HTTP Request node URL evaluates to literal `{{ $env.NOCODB_URL }}/api/v3/...` (unresolved expression).

## Per-Scanner-Workflow Analysis

### Workflow 1a — Greenhouse Scanner (Reference Pattern)

**Node count:** 4 Airtable nodes → 4 HTTP Request nodes + 3 unwrap transform Code nodes + 1 n8n HTTP Header Auth credential reference

**Nodes to replace:**

| Current Airtable Node | Replacement | NocoDB Endpoint | Params | Unwrap Needed? |
|-----------------------|-------------|-----------------|--------|----------------|
| Get Profile (Airtable, search Profile table) | HTTP Request GET | `/api/v3/data/{base}/{profile}/records` | none | ✅ — 1 row expected |
| Get Tracked Companies (Airtable, search Tracked Companies, `filterByFormula`) | HTTP Request GET | `/api/v3/data/{base}/{companies}/records` | `where=(Enabled,is,true)~and("Scan Method",eq,"Greenhouse API")` | ✅ — multiple rows |
| Get Existing Job IDs (Airtable, search Pipeline, `fields: ["Job ID"]`) | HTTP Request GET | `/api/v3/data/{base}/{pipeline}/records` | `fields=Job%20ID` | ✅ — multiple rows |
| Create Pipeline Records (Airtable, create, column mapping) | HTTP Request POST | `/api/v3/data/{base}/{pipeline}/records` | Body: `{ "fields": { ... } }` | ❌ — POST returns created record directly |

**Node connections (unchanged):**
- Manual Trigger → **Get Profile** → Get Tracked Companies → Loop Companies → ...
- Schedule Trigger → **Get Profile** → Get Tracked Companies → Loop Companies → ...
- Loop Companies (output 0) → Aggregate All Jobs → **Get Existing Job IDs** → Deduplicate vs Pipeline → If → **Create Pipeline Records**
- Loop Companies (output 1) → Prepare Company Data → Fetch Greenhouse API → Parse & Filter Jobs → ...

**Key detail — Get Profile node:** Currently exists between Manual/Schedule triggers and Get Tracked Companies. With HTTP Request, it stays in the same position. The unwrap transform after it must produce a single flat item with `Target Geography`, `Core Skills`, etc.

**Key detail — Create Pipeline Records:** Currently the n8n Airtable "Create" node receives items from the "If" true branch and maps `{{ $json.jobId }}` → "Job ID" column, etc. The HTTP Request POST must:
1. Receive the same items (still from "If" true branch)
2. Wrap fields in `{ "fields": { ... } }`
3. Send one POST per item (n8n automatically processes items one-at-a-time for nodes in the flow)

### Workflow 1b — Ashby Scanner

**Diff from 1a:** Only the `where` clause filter changes:

| Current Airtable Node | where change |
|-----------------------|--------------|
| Get Tracked Companies | `where=(Enabled,is,true)~and("Scan Method",eq,"Ashby API")` |

Everything else (Get Profile, Get Existing Job IDs, Create Pipeline Records) is identical to 1a.

### Workflow 1c — Lever Scanner

**Diff from 1a:** Only the `where` clause filter changes:

| Current Airtable Node | where change |
|-----------------------|--------------|
| Get Tracked Companies | `where=(Enabled,is,true)~and("Scan Method",eq,"Lever API")` |

Everything else is identical to 1a.

### Workflow 1d — JobSpy Scanner (Most Complex)

**Changes required:**

1. **ADD "Get Profile" HTTP Request node** — New node connected between Schedule/Manual triggers and Get Search Queries. Same pattern as 1a: HTTP GET to Profile table + unwrap transform.

2. **Replace "Get Search Queries"** — Airtable → HTTP GET with where filter:
   - `where=(Enabled,is,true)~and("Source Type",eq,"JobSpy")`
   - Target table: Search Queries (`NOCODB_TABLE_QUERIES`)
   - Unwrap transform needed (produces multiple items)

3. **Replace "Get Existing Job IDs"** — Same HTTP GET + unwrap as 1a.

4. **Replace "Create Pipeline Records"** — Same HTTP POST `{ "fields": { ... } }` as 1a, but includes `"Salary Info"` field.

5. **Update "Parse & Filter Jobs" Code node** — Replace hardcoded `userGeographies` with dynamic Profile read:
   ```javascript
   // Current (hardcoded):
   const userGeographies = ['Canada', 'Remote Global', 'Remote North America'];

   // New (dynamic from Profile):
   const profileData = $('Get Profile').first().json;
   const geoField = profileData['Target Geography'];
   const userGeographies = Array.isArray(geoField) ? geoField : ['Remote Global'];
   ```
   (The existing Code node already has the `GEO_CONFIG` map — only the hardcoded `userGeographies` constant needs replacement.)

6. **Update "Build Batch Payload" Code node** — No change needed (it already reads from `$input.all()` which comes from the unwrapped "Get Search Queries" items).

**JobSpy connection flow (updated):**
```
Manual Trigger ──┐
                 ├──▶ Get Profile → Unwrap Profile → Get Search Queries → Unwrap Search Queries → Build Batch Payload
Schedule Trigger ┘
```

## Environment Variable Requirements

### docker-compose.example.yml Changes

**Current n8n service env vars** (from Phase 1):
```yaml
# Existing (keep):
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

**Note:** The existing env vars use `NOCDB` (NOT `NOCODB` — missing the second 'O'). CONTEXT.md D-03 standardizes on `NOCODB_*`. **The planner must resolve this naming.** Recommended approach: keep `NOCDB_HOST` as-is (already wired) and add `NOCODB_URL` as an alias for Phase 3 references, OR rename all to `NOCODB_*`. Bootstrap script outputs must match.

**Additional env vars needed** (from D-04):
```yaml
# New — NocoDB connectivity (add to n8n service environment):
- NOCODB_URL=http://nocodb:8080           # Canonical name per D-03 (or reuse NOCDB_HOST)
- NOCODB_BASE_ID=<p_xxxxx>                # From bootstrap output
- NOCODB_TABLE_PROFILE=<m_xxxxx>          # From bootstrap output
- NOCODB_TABLE_COMPANIES=<m_xxxxx>        # From bootstrap output
- NOCODB_TABLE_PIPELINE=<m_xxxxx>         # From bootstrap output
- NOCODB_TABLE_QUERIES=<m_xxxxx>          # From bootstrap output
```

**Env var naming:** The bootstrap script (Phase 1) outputs using `NOCODB_*` prefix for base and table IDs (D-05). The API token env var already exists as `NOCDB_API_TOKEN`. The HTTP Header Auth credential stores the token value itself, so the HTTP Request nodes don't reference the token env var directly — they reference the credential.

### HTTP Request Node URL Expression Pattern

All NocoDB HTTP Request nodes use this URL pattern:
```javascript
// GET: read records
={{ $env.NOCODB_URL }}/api/v3/data/{{ $env.NOCODB_BASE_ID }}/{{ $env.NOCODB_TABLE_PIPELINE }}/records?fields=Job+ID

// GET: with where filter
={{ $env.NOCODB_URL }}/api/v3/data/{{ $env.NOCODB_BASE_ID }}/{{ $env.NOCODB_TABLE_COMPANIES }}/records?where=(Enabled,is,true)~and("Scan Method",eq,"Greenhouse API")

// POST: create record
={{ $env.NOCODB_URL }}/api/v3/data/{{ $env.NOCODB_BASE_ID }}/{{ $env.NOCODB_TABLE_PIPELINE }}/records
```

## Credential Setup

### n8n HTTP Header Auth Credential

**Action required in n8n UI** (or via n8n API):

1. Create credential type: **HTTP Header Auth**
2. Name: `NocoDB API` (consistent across all 4 scanners)
3. Header Name: `xc-token`
4. Header Value: The NocoDB API token (from `NOCDB_API_TOKEN` env var / bootstrap output)

**Reference from HTTP Request node:**
```json
"credentials": {
  "httpHeaderAuth": {
    "id": "generated-id",
    "name": "NocoDB API"
  }
}
```

**Retry config** (match existing Airtable behavior):
```json
"retryOnFail": true,
"maxTries": 3,
"waitBetweenTries": 5000,
"alwaysOutputData": true,
"continueOnFail": true
```

## Retry and Error Handling

**All HTTP Request nodes** should match the existing Airtable node retry pattern:

```json
{
  "retryOnFail": true,
  "maxTries": 3,
  "waitBetweenTries": 5000,
  "alwaysOutputData": true,
  "continueOnFail": true
}
```

- **`retryOnFail: true`**: Automatically retry on failure
- **`maxTries: 3`**: Retry up to 3 times (matches Airtable pattern)
- **`waitBetweenTries: 5000`**: 5-second delay between retries
- **`alwaysOutputData: true`**: Always emit output (even on failure) so downstream error handling works
- **`continueOnFail: true`**: On final failure, continue execution rather than crashing

**Graceful degradation:** The "Get Profile" and "Get Tracked Companies" nodes should NOT have `continueOnFail: true` — if these fail, the workflow can't proceed meaningfully (no data to process). Only "Create Pipeline Records" should use `continueOnFail: true` to match the existing pattern where insert failures don't block future jobs.

**Correction:** Actually, the existing Airtable "Create Pipeline Records" node in the scanner workflows does NOT have explicit `continueOnFail` — only the "Fetch Greenhouse API" has `continueOnFail: true` (to skip failed API calls to individual companies). "Get Existing Job IDs" has `alwaysOutputData: true`. The safest approach: match each node's existing retry/error config rather than applying a blanket pattern.

## Field Mapping: Airtable to NocoDB Title Case

Per D-07, NocoDB column names use Title Case matching Airtable fields. The mapping is:

| Airtable Field | NocoDB Column | Accessed in Code As |
|----------------|---------------|---------------------|
| Job ID | Job ID | `record.json['Job ID']` |
| Job Title | Job Title | `record.json['Job Title']` |
| Company | Company | `record.json['Company']` |
| Location | Location | `record.json['Location']` |
| Apply Link | Apply Link | `record.json['Apply Link']` |
| Job Description | Job Description | `record.json['Job Description']` |
| Source | Source | `record.json['Source']` |
| Source Query | Source Query | `record.json['Source Query']` |
| Source Tag | Source Tag | `record.json['Source Tag']` |
| Discovery Date | Discovery Date | `record.json['Discovery Date']` |
| Status | Status | `record.json['Status']` |
| Salary Info | Salary Info | `record.json['Salary Info']` (JobSpy only) |
| Enabled | Enabled | Checkbox field in Tracked Companies, Search Queries |
| Scan Method | Scan Method | Single select in Tracked Companies |
| Source Type | Source Type | Single select in Search Queries |
| API Endpoint | API Endpoint | URL in Tracked Companies |
| Title Keywords | Title Keywords | Text in Tracked Companies |

**Important:** The Code nodes access these fields via bracket notation `record.json['Job ID']` not dot notation `record.json.JobID`. Since Title Case is preserved, no Code node variable renames are needed.

**Status field mapping:** When creating Pipeline records, Status is set to `"New"` (hardcoded in the existing Airtable column mapping). This maps 1:1 in NocoDB as a SingleSelect value.

**Source field mapping:** In the pipeline, Source values include "Greenhouse", "Ashby", "Lever", "LinkedIn", "Indeed" as SingleSelect options. These values are set by the scanner Code nodes and remain unchanged.

## Testing Approach

### Verification Strategy

Since Airtable remains active (cutover at Phase 8), testing compares NocoDB output against Airtable output:

1. **Dry-run comparison:** Run each scanner workflow with NocoDB HTTP nodes while Airtable nodes are still in place and working. Wait—actually the nodes are REPLACED, not running in parallel. So testing must use a separate approach:

2. **Manual trigger + inspection:**
   - Run each workflow manually (click "Execute Workflow" in n8n)
   - For "Get Profile," "Get Tracked Companies," "Get Search Queries," and "Get Existing Job IDs": inspect the output of the unwrap transform node to verify correct field mapping and filtering
   - For "Create Pipeline Records": verify the record appears in NocoDB via the Data API or NocoDB UI

3. **Record count verification:**
   - Note how many new Pipeline records Airtable would create (from previous run's output)
   - Verify NocoDB has the same number of new records
   - Compare field values on 3-5 sample records

4. **JobSpy geography fix verification:**
   - Temporarily enable the hardcoded `console.log` or use n8n's node output inspection to verify `userGeographies` is populated from Profile, not hardcoded

5. **Regression check:**
   - After all 4 scanners are migrated, run a full scanner cycle (manual trigger all 4)
   - Verify no duplicate Pipeline records are created (FNV-1a dedup still works)
   - Verify all new records have correct field values

### Success Criteria Checklist

- [ ] 1a: Greenhouse creates Pipeline records with same fields via NocoDB as before via Airtable
- [ ] 1b: Ashby creates Pipeline records with same fields via NocoDB
- [ ] 1c: Lever creates Pipeline records with same fields via NocoDB
- [ ] 1d: JobSpy creates Pipeline records with same fields + Salary Info via NocoDB
- [ ] 1d: JobSpy geography filtering uses dynamic Profile data (not hardcoded fallback)
- [ ] All unwrap transforms produce flat items consumable by existing Code nodes
- [ ] `where` clause filtering returns correct records (Enabled=TRUE + correct Scan Method / Source Type)
- [ ] Field projection (`?fields=Job+ID`) returns only Job ID field
- [ ] POST record creation sends correct `{ "fields": { ... } }` body
- [ ] No new duplicates introduced (FNV-1a dedup hash still works on flat items)

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| NocoDB response shape differs from CONTEXT.md assumption (D-06) | Unwrap transform broken | HIGH (already confirmed — actual response uses `records`, not `list`) | Research correction documented here; planner MUST use `response.records` |
| Env var naming mismatch (`NOCDB_HOST` vs `NOCODB_URL`) | HTTP Request URLs fail | MEDIUM | Reconciled in research; planner decides canonical name |
| NocoDB `where` clause doesn't filter boolean/select fields as expected | Wrong records returned | LOW (v3 where syntax supports quoted values) | Test run with known data before enabling all scanners |
| POST body format wrong (`{ "fields": { ... } }` vs flat) | Pipeline creation fails | LOW (documented in Context7 API docs) | Use research-provided body template |
| Existing Code node `$('Get Profile')` reference breaks due to new node structure in JobSpy | JobSpy workflow fails | MEDIUM | JobSpy currently lacks Get Profile node entirely — adding it is the fix |
| NocoDB paginates large record sets (Pipeline table) | Incomplete dedup check | LOW (125-150k chars for Job ID-only projection fits in one page) | If pagination occurs, update unwrap node to loop through `next` pages |
| n8n non-self-hosted can't reach `http://nocodb:8080` | Scanner fails on n8n Cloud | LOW (this is a self-hosted feature by design) | Documented requirement — JobSpy sidecar also only works on self-hosted |

## Validation Architecture

> `workflow.nyquist_validation` is explicitly `true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual workflow execution + node output inspection (no automated test harness for n8n workflows) |
| Config file | None — workflows are JSON files, not Node.js modules |
| Quick run command | Open n8n UI → Select workflow → Click "Execute Workflow" → Inspect node outputs |
| Full suite command | Trigger all 4 scanner workflows manually in n8n UI; verify Pipeline records in NocoDB via `GET /api/v3/data/{baseId}/{pipelineId}/records` or NocoDB UI |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCAN-01 | Greenhouse scanner (1a) reads Tracked Companies + Pipeline from NocoDB, inserts new Pipeline records with same fields | Manual run-verify | n8n UI: trigger 1a, inspect "Unwrap Tracked Companies" output for correct filters (Enabled=true, Scan Method=Greenhouse API); inspect "Unwrap Existing Job IDs" for field projection; verify POST creates record in NocoDB | ❌ Wave 0 — no test infrastructure |
| SCAN-02 | Ashby scanner (1b) produces identical Pipeline records against NocoDB | Manual run-verify | n8n UI: trigger 1b, same inspection pattern as 1a, verify where filter targets Ashby API | ❌ Wave 0 |
| SCAN-03 | Lever scanner (1c) produces identical Pipeline records against NocoDB | Manual run-verify | n8n UI: trigger 1c, same inspection pattern as 1a, verify where filter targets Lever API | ❌ Wave 0 |
| SCAN-04 | JobSpy scanner (1d) reads Search Queries from NocoDB, checks Pipeline for duplicates, inserts new records — including dynamic Profile geography | Manual run-verify | n8n UI: trigger 1d, inspect "Unwrap Search Queries" output for correct filters; verify "Parse & Filter Jobs" now reads `userGeographies` from Profile (not hardcoded); verify Salary Info mapping | ❌ Wave 0 |

### Manual Test Cases

Each scanner workflow must pass the following test cases after migration:

**Test Case A: Field projection**
1. Manually trigger the scanner workflow
2. Inspect the "Unwrap Existing Job IDs" node output
3. Verify each item has ONLY `Job ID` and `id` fields (no other Pipeline fields leaked)
4. Verify the FNV-1a hash values match existing Pipeline records

**Test Case B: Where clause filtering**
1. Inspect the "Unwrap Tracked Companies" (1a/1b/1c) or "Unwrap Search Queries" (1d) node output
2. Verify only records with `Enabled=true` are returned
3. Verify only records matching the correct Scan Method (Greenhouse/Ashby/Lever) or Source Type (JobSpy) are returned

**Test Case C: POST body format**
1. Manually trigger the workflow with a net-new job
2. Inspect the "Create Pipeline Records" HTTP Request node's request body
3. Verify body format is `{ "fields": { "Job ID": "...", "Job Title": "...", ... } }`
4. Verify the record appears in NocoDB with correct field values

**Test Case D: JobSpy Profile reading (SCAN-04 only)**
1. Manually trigger the JobSpy scanner
2. Inspect the "Parse & Filter Jobs" Code node output
3. Verify `userGeographies` matches the Profile's Target Geography field, not the hardcoded fallback

**Test Case E: Full scanner cycle (regression)**
1. Run all 4 scanners manually in sequence
2. Count total Pipeline records created in NocoDB
3. Run the same scan cycle again
4. Verify no duplicate Pipeline records are created (FNV-1a dedup prevents re-insertion)

**Test Case F: Empty state handling**
1. Temporarily disable all Tracked Companies (set Enabled=false)
2. Run the scanner — verify it handles zero-tracked-companies gracefully (produces `_empty` sentinel or no errors)
3. Re-enable companies

### Sampling Rate
- **Per task commit:** "Quick run" = inspect node outputs in n8n UI for the specific workflow being modified
- **Per wave merge:** Full manual trigger of all 4 scanners, verify each node output
- **Phase gate:** All 6 test cases pass before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] No automated test suite exists for n8n workflows — all validation is manual via n8n UI inspection
- [ ] No way to programmatically compare Airtable output vs NocoDB output within a single run (Airtable nodes are physically replaced, not dual-wired)
- [ ] Need to verify `NOCODB_*` env vars are present in docker-compose before any scanner runs

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | NocoDB pagination won't be triggered for field-projected dedup queries (only fetching Job ID) | Common Pitfalls | If Pipeline has > ~2000 records, need pagination-aware unwrap; low risk given typical job pipeline size |
| A2 | The NocoDB Data API v3 swagger spec at `data-apis-v3.nocodb.com` is authoritative and stable | Standard Stack | If API changes between NocoDB versions, HTTP Request nodes may break; mitigated by pinning NocoDB image tag |
| A3 | The `where` clause accepts quoted field names with spaces as documented | Standard Stack | Confirmed by NocoDB docs, but not tested against actual running NocoDB instance |
| A4 | Existing "Deduplicate vs Pipeline" Code node handles flat item format with `record.json['Job ID']` correctly | Architecture Patterns | Code node already has fallback for `record.json['Job ID']` when `record.json.fields` is undefined — visually confirmed in workflow JSON |
| A5 | NocoDB checkbox/boolean filtering uses `(Enabled,is,true)` syntax | Architecture Patterns | Docs show `is` operator for boolean; confirmed by comparison operators table |

## Open Questions

1. **Which env var naming convention?**
   - What we know: Existing `NOCDB_HOST` and `NOCDB_API_TOKEN` use `NOCDB` (typo). Phase 3 decisions use `NOCODB_URL`. Bootstrap script outputs use `NOCODB_*`.
   - What's unclear: Should we rename the existing vars for consistency, or keep both?
   - Recommendation: Add `NOCODB_URL=http://nocodb:8080` as a new env var (canonical name per D-03). Keep `NOCDB_HOST` as-is for backward compat. Rename `NOCDB_API_TOKEN` in a separate cleanup phase if desired.

2. **NocoDB pagination for dedup query?**
   - What we know: The "Get Existing Job IDs" node fetches ALL Job IDs with `?fields=Job+ID`. NocoDB returns all records unless pagination is explicitly requested via `limit`/`offset`.
   - What's unclear: Whether large Pipeline tables (>1000 records) will be automatically paginated or returned in one response.
   - Recommendation: Assume no pagination for Phase 3. If issues arise, the unwrap transform can be updated to handle pagination by following the `next` URL.

3. **Unwrap node for single-vs-multi item responses?**
   - What we know: "Get Profile" always returns 1 record. "Get Tracked Companies" returns 0-139 records.
   - What's unclear: Whether a single unwrap node can handle both cases without modification.
   - Recommendation: The pattern shown in this research handles both — it maps `records` regardless of count, and returns `_empty` sentinel for zero records. This matches the existing Code node `_empty` pattern.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| n8n (docker.n8n.io/n8nio/n8n) | All scanner workflow edits | ✓ | latest (via Docker) | n8n Desktop for editing |
| NocoDB (nocodb/nocodb:latest) | Target database | ✓ (Phase 1) | latest | — |
| n8n HTTP Header Auth credential type | Auth for NocoDB API calls | ✓ (n8n-native) | — | — |
| `NOCDB_API_TOKEN` / NOCODB API token | NocoDB API auth | ✓ (Phase 1) | — | Regenerate via bootstrap script |

**Missing dependencies with no fallback:** None — all dependencies are in place from Phases 1-2.

## Security Domain

> Security enforcement: enabled (absent from config). Phase 3 does not introduce new security
> boundaries — it replaces a backend database with a functionally equivalent one behind the existing
> n8n orchestration layer. The `xc-token` credential is managed by n8n's built-in credential store
> and never exposed to browser/client tiers.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | no | No user input — all data flows via n8n HTTP nodes |
| V6 Cryptography | no | No cryptographic operations added |
| V8 Data Protection | yes | API token stored in n8n credential store, not in code |

### Known Threat Patterns for n8n + NocoDB

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API token leak | Information Disclosure | Token stored in n8n credential store (encrypted at rest); only referenced by credential name in workflow JSON |
| NocoDB exposed to external network | Tampering | NocoDB port 8080 is not exposed in docker-compose (no `ports:` mapping); only reachable via n8n's internal Docker network at `http://nocodb:8080` |

## Sources

### Primary (HIGH confidence)
- `/openapi/nocodb_apis_v3_swagger-v3_json` (Context7) — Confirmed response format `{ records: [...], next, prev }`, field projection via `fields` param, POST body `{ "fields": { ... } }`, `where` clause syntax, `xc-token` auth
- `nocodb.com/docs/product-docs/developer-resources/rest-apis` (Web Fetch) — Confirmed `where` clause comparison operators (`is` for boolean), v3 quoted syntax, and `limit`/`offset` pagination
- `workflows/01a-scanner-greenhouse.json` — Reference pattern for all scanner workflows; confirmed existing Code node fallback for both `record.json.fields` and `record.json['Field']` formats
- `workflows/01d-scanner-jobspy.json` — Confirmed hardcoded `userGeographies` TODO, missing Get Profile node

### Secondary (MEDIUM confidence)
- `docker-compose.example.yml` — Confirmed existing `NOCDB_API_TOKEN` and `NOCDB_HOST` env vars (naming mismatch flagged)
- `airtable/AIRTABLE-SCHEMA.md` — Confirmed all field names and types for Title Case mapping

### Tertiary (LOW confidence)
- None — all critical claims are verified against Context7 API docs or codebase inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — NocoDB Data API v3 directly verified via Context7
- Architecture: HIGH — workflow JSON files read and analyzed
- Per-scanner analysis: HIGH — each workflow's Airtable nodes identified via codebase grep
- Pitfalls: MEDIUM — based on API shape differences between Airtable and NocoDB
- Env var naming: MEDIUM — conflict between existing and Phase 3 naming, needs resolution

**Research date:** 2026-06-10
**Valid until:** 2026-07-10 (stable — NocoDB API v3 is documented and established)
