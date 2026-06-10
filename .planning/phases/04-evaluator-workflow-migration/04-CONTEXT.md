# Phase 4: Evaluator Workflow Migration - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace 2 Airtable read nodes (Get Profile, Get New Jobs) and 2 Airtable update nodes (Update Job Record, Update Interview Prep) in `workflows/02-evaluator.json` with NocoDB HTTP Request nodes. AI scoring logic, interview prep generation, email alerting (Resend), rate-limiting wait node, and schedule trigger remain unchanged. Only the database backend is swapped.

Requirements: EVAL-01, EVAL-02

</domain>

<decisions>
## Implementation Decisions

### NocoDB Record ID for Updates
- **D-01:** Use NocoDB auto-generated `Id` field as the record identifier for PATCH operations. The Unwrap Code node exposes `loopItem['Id']` from NocoDB's response. Both "Parse AI Response" and "Parse & Save Interview Prep" Code nodes use this field instead of the previous `_airtableRecordId` pattern.

### Node Naming Convention
- **D-02:** Follow Phase 3 pattern — name HTTP Request nodes descriptively (e.g., "Get Profile", "Get New Jobs") followed by "Unwrap" Code nodes. Update all Code node `$('Get X')` references to `$('Unwrap X')`.

### NocoDB Filter Syntax
- **D-03:** Use URL query parameter syntax: `GET /api/v3/{base}/{pipeline}/records?where=(Status,eq,New)&limit=5`. Standard NocoDB Data API v3 filter pattern.

### PATCH Payload Structure
- **D-04:** Keep two separate PATCH HTTP Request nodes — "Update Job Record" (scoring fields + Status) after Parse AI Response, and "Update Interview Prep" (interview Qs + STAR + cost) after Parse & Save Interview Prep. Mirrors the existing Airtable node split.

### Code Node Record ID Flow
- **D-05:** The "Parse AI Response" Code node reads `loopItem['Id']` from the Unwrap node and passes `recordId` to both the scoring PATCH and (via the High Fit branch) to "Build Interview Prep Prompt", which carries `_recordId` forward to "Parse & Save Interview Prep".

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — Requirements EVAL-01, EVAL-02 (Pipeline record creation for evaluator)
- `.planning/ROADMAP.md` — Phase 4 goal, success criteria (4 items), depends-on Phase 2
- `.planning/PROJECT.md` — Key decisions (in-place node replacement, cutover migration, NocoDB env vars)

### Prior Phase Decisions
- `.planning/phases/03-scanner-workflows-migration/03-CONTEXT.md` — Phase 3 decisions: HTTP Request nodes not native NocoDB node (D-01), `xc-token` auth (D-02), Unwrap pattern (D-06), Title Case columns (D-07), env vars (D-03/D-04)
- `.planning/phases/01-infrastructure-bootstrap/01-CONTEXT.md` — NocoDB port 8080, env var conventions, API token

### Evaluator Workflow (source to modify)
- `workflows/02-evaluator.json` — The evaluator workflow with 4 Airtable nodes to replace, Code node record ID patterns, AI scoring + interview prep logic

### NocoDB API References
- NocoDB Data API v3 Swagger: `https://data-apis-v3.nocodb.com/` — Record CRUD endpoints (GET, PATCH for Pipeline records)
- NocoDB Meta API v3 Swagger: `https://meta-apis-v3.nocodb.com/` — Table/field discovery if needed

### Schema
- `airtable/AIRTABLE-SCHEMA.md` — Pipeline table field types, select options to match Title Case column names in NocoDB

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `workflows/01a-scanner-greenhouse.json` — Reference pattern for NocoDB HTTP Request + Unwrap Code node flow (Phase 3 pattern)
- `.planning/phases/03-scanner-workflows-migration/03-CONTEXT.md` — Documented Phase 3 decisions that carry forward

### Established Patterns
- HTTP Request nodes with `xc-token` header auth targeting NocoDB Data API v3
- Unwrap Code/Set node after each NocoDB HTTP GET: `{ list: [...] }` → flat items
- Title Case column names matching Airtable field names (no renaming needed)
- Env vars via docker-compose: `NOCODB_URL`, `NOCODB_BASE_ID`, `NOCODB_TABLE_PROFILE`, `NOCODB_TABLE_PIPELINE`
- Graceful degradation: interview prep failures store error message instead of crashing

### Integration Points
- 2 Airtable read nodes replaced with HTTP GET + Unwrap: "Get Profile", "Get New Jobs"
- 2 Airtable update nodes replaced with HTTP PATCH: "Update Job Record", "Update Interview Prep"
- Parse AI Response Code node: `loopItem['Id']` replaces `loopItem._airtableRecordId || loopItem.id`
- Build Interview Prep Prompt Code node: carries `_recordId` forward as NocoDB `Id`
- All Code node `$('Get X')` references updated to `$('Unwrap X')`

</code_context>

<specifics>
## Specific Ideas

- The evaluator loop structure remains unchanged — splitInBatches processes 5 jobs, each job goes through scoring → update → (if High Fit) interview prep → update
- Resend email node stays as-is — it references `$('Get Profile').item.json` and `$('Get New Jobs').item.json` which will become `$('Unwrap Profile')` and `$('Unwrap New Jobs')`
- The "Wait 2s" node after each loop iteration stays unchanged (rate limiting)
- "Schedule Trigger" and "Manual Trigger" stay unchanged

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 4-Evaluator Workflow Migration*
*Context gathered: 2026-06-10*
