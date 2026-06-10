# Phase 3: Scanner Workflows Migration - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace Airtable nodes in all 4 scanner workflows (Greenhouse 1a, Ashby 1b, Lever 1c, JobSpy 1d) with HTTP Request nodes targeting NocoDB Data API v3. Code node logic (parsing, deduplication via FNV-1a, geography filtering) remains unchanged — only the database backend is swapped. Airtable remains active during this phase; cutover happens at Phase 8.

</domain>

<decisions>
## Implementation Decisions

### NocoDB Integration Method
- **D-01:** Use n8n HTTP Request nodes to call NocoDB Data API v3 — NOT the n8n native NocoDB node (which targets API v2 and has a stalled v3 migration PR). Raw HTTP is more flexible and works regardless of n8n version.
- **D-02:** Authenticate via n8n "HTTP Header Auth" credential with `xc-token` header. One credential shared across all 4 scanner workflows — consistent with the existing `httpHeaderAuth` pattern used for sidecar services.
- **D-03:** NocoDB internal URL referenced via `NOCODB_URL` env var in docker-compose (e.g., `http://nocodb:8080`). Not hardcoded per node.
- **D-04:** Base and table IDs referenced via env vars: `NOCODB_BASE_ID`, `NOCODB_TABLE_PROFILE`, `NOCODB_TABLE_COMPANIES`, `NOCODB_TABLE_PIPELINE`, `NOCODB_TABLE_QUERIES`. Bootstrap script outputs these on completion.

### Table Reference Strategy
- **D-05:** Bootstrap script prints env var assignments to stdout on completion (e.g., `export NOCODB_TABLE_PIPELINE=xxx`). User copies into docker-compose env vars. No `.env` file generation.

### Code Node Data Access Pattern
- **D-06:** Add an n8n Code or Set node after each NocoDB HTTP Request to unwrap the `{ list: [...], pageInfo: {...} }` response into flat items. Existing downstream Code nodes remain unchanged — they continue to access data via the same pattern (`$input.first().json`).
- **D-07:** NocoDB column names use Title Case (matching Airtable fields: "Job Title", "Job ID", "Company", "Apply Link", "Job Description"). Existing Code node variable references work without renaming.
- **D-08:** Each scanner workflow keeps its own "Get Profile" HTTP Request node (separate from database reads). Simple, self-contained per workflow.
- **D-09:** Fix the existing JobSpy TODO — add Profile reading with Target Geography to workflow 1d (currently hardcoded). Same pattern as 1a/1b/1c.

### Dedup Query Pattern
- **D-10:** Use NocoDB field projection to fetch only the "Job ID" column: `GET /api/v3/{base}/{pipeline}/records?fields=Job+ID`. Matches current Airtable pattern (fetch all IDs, filter in Code node).

### JobSpy Scanner Enhancements
- **D-11:** JobSpy scanner (1d) gains a "Get Profile" HTTP Request node and corresponding geography filtering — fixing the existing hardcoded geography TODO found in the "Parse & Filter Jobs" Code node.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — Requirements SCAN-01, SCAN-02, SCAN-03, SCAN-04
- `.planning/ROADMAP.md` — Phase 3 goal, success criteria (4 items), depends-on Phase 2
- `.planning/PROJECT.md` — Key decisions (in-place node replacement, cutover migration)

### Prior Phase Context
- `.planning/phases/01-infrastructure-bootstrap/01-CONTEXT.md` — NocoDB port 8080, env vars, API token pattern
- `.planning/phases/02-data-migration/02-CONTEXT.md` — Data already in NocoDB, Airtable remains active

### Scanner Workflows (source workflows to modify)
- `workflows/01a-scanner-greenhouse.json` — Airtable "Get Profile" + "Get Tracked Companies" + "Get Existing Job IDs" + "Create Pipeline Records"
- `workflows/01b-scanner-ashby.json` — Same Airtable nodes as 1a, filter by "Ashby API"
- `workflows/01c-scanner-lever.json` — Same Airtable nodes as 1a, filter by "Lever API"
- `workflows/01d-scanner-jobspy.json` — "Get Search Queries" + "Get Existing Job IDs" + "Create Pipeline Records". No "Get Profile" (TODO).

### NocoDB API References
- NocoDB Data API v3 Swagger: `https://data-apis-v3.nocodb.com/` — Record CRUD endpoints (GET, POST for Pipeline records)
- NocoDB Meta API v3 Swagger: `https://meta-apis-v3.nocodb.com/` — Table/field discovery if needed

### Existing Schema
- `airtable/AIRTABLE-SCHEMA.md` — Source schema for all 4 tables (field types, select options, relationships)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `workflows/01a-scanner-greenhouse.json` — Reference pattern for scanner workflow structure (most complex, has all Airtable node types)
- `workflows/01d-scanner-jobspy.json` — Different pattern (reads Search Queries, not Tracked Companies; uses batch payload)
- `airtable/AIRTABLE-SCHEMA.md` — Complete field definitions to match Title Case column names in NocoDB

### Established Patterns
- All 4 scanners follow: READ config → FETCH jobs → PARSE & FILTER → DEDUPE → CREATE Pipeline records
- FNV-1a dedup hash: 8-char hex, title+company+applyLink lowercased. JobSpy appends `-spy` suffix.
- Safety brakes: throw error if >100 net-new jobs per run
- Airtable node retry: 3 tries, 5s intervals (`retryOnFail: true`, `maxTries: 3`, `waitBetweenTries: 5000`)
- Geography filtering code uses Title Case variables pulled from Profile and matched against location strings

### Integration Points
- 4 HTTP Request nodes replace 4-5 Airtable nodes per scanner workflow
- Unwrap transform node inserted after each NocoDB HTTP Request (response shape changes)
- `NOCODB_URL`, `NOCODB_BASE_ID`, `NOCODB_TABLE_*` env vars added to docker-compose n8n service
- HTTP Header Auth credential created in n8n (name: "NocoDB API")
- JobSpy scanner adds a new "Get Profile" HTTP Request node + geography filtering in Parse & Filter Jobs Code node

</code_context>

<specifics>
## Specific Ideas

- Pipeline record creation mapping from scanner Code nodes matches current Airtable column names (Title Case): Job ID, Job Title, Company, Location, Apply Link, Job Description, Source, Source Query, Source Tag, Discovery Date, Status="New"
- JobSpy additionally maps Salary Info field
- Transform node should handle both single-record and multi-record responses (Code node's `$input.first()` vs `$input.all()`)
- Retry configuration on HTTP Request nodes should match existing Airtable behavior: 3 retries at 5s intervals

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 3-Scanner Workflows Migration*
*Context gathered: 2026-06-10*
