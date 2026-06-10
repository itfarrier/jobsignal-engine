# Phase 2: Data Migration - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Import all existing Airtable data (4 tables — Profile, Tracked Companies, Pipeline, Search Queries) into NocoDB via the native "Import from Airtable" feature, preserving field types, select values, linked references, and attachments. The data sits ready in NocoDB but workflows continue running on Airtable during Phases 3-7. Cutover happens at Phase 8.

</domain>

<decisions>
## Implementation Decisions

### Import Method
- **D-01:** Use NocoDB's native "Import from Airtable" feature — not a custom API script. It handles schema + data + linked records + attachments in one pass, requires only an Airtable PAT and Shared Base URL.
- **D-02:** Bootstrap script (`nocodb_bootstrap.py`) creates the workspace and base infrastructure only — the native import creates tables and populates data. The bootstrap's `--import-data` flag is effectively superseded for Phase 2.
- **D-03:** Enable "Import attachment columns" in the import settings so existing DOCX tailored CVs are preserved.

### Airtable Access
- **D-04:** Enable "Turn on full base access" public sharing in Airtable to generate the Shared Base URL required by the native import. Can be revoked after migration completes at Phase 8.
- **D-05:** Airtable remains the active source of truth during Phases 3-7. Data is imported once in Phase 2 — no dual-write, no incremental sync.

### Linked Record Handling
- **D-06:** All cross-table references in the Airtable schema are text/select field values (Company as Text, Source as Single select, etc.) — no formal linked record fields to map. The native import carries these over as-is.
- **D-07:** n8n workflows query records by field values (Status, Fit Tier, etc.), not by hardcoded Airtable record IDs. New NocoDB record IDs are irrelevant.

### Verification
- **D-08:** Verify by comparing record counts per table between Airtable and NocoDB, plus manual spot-check of 10+ records per table.
- **D-09:** For the Profile table (critical single row driving all AI prompts), perform a full field-by-field comparison including the CV Markdown long text.
- **D-10:** Automated field-level comparison scripts are not needed — counts + spot-checking is sufficient.

### Cutover Timing
- **D-11:** One-shot import now. Workflows continue on Airtable through Phases 3-7. At Phase 8 (Verification & Cleanup), all 8 workflows flip to NocoDB simultaneously. Airtable kept as read-only fallback during Phase 8 verification, then deprecated.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — Requirements DATA-01, DATA-02
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria (4 items), depends-on Phase 1
- `.planning/PROJECT.md` — Key decisions table (cutover migration, local attachments, in-place node replacement)

### Airtable Schema (source data)
- `airtable/AIRTABLE-SCHEMA.md` — Full schema for all 4 tables — field types, select options, and relationships to migrate

### Phase 1 Decisions
- `.planning/phases/01-infrastructure-bootstrap/01-CONTEXT.md` — Infrastructure decisions (NocoDB port 8080, Docker Compose, Postgres backend, API token, env vars, volumes)

### NocoDB References
- NocoDB Import from Airtable docs — Native import feature (requires Shared Base URL + PAT): https://nocodb.com/docs/product-docs/bases/import-base-from-airtable
- NocoDB Meta API v3 Swagger — https://meta-apis-v3.nocodb.com/ (for any post-import reconciliation if needed)
- NocoDB Data API v3 Swagger — https://data-apis-v3.nocodb.com/ (for record verification/querying)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/nocodb_bootstrap.py` (Phase 1) — Will need minor modification: workspace+base creation only, skip table creation, add instructions for triggering native import
- `docker-compose.example.yml` (Phase 1) — Already has NocoDB service defined
- `airtable/AIRTABLE-SCHEMA.md` — Complete field definitions to verify against after import

### Established Patterns
- Docker Compose with named volumes — already in place from Phase 1
- Python scripts in `scripts/` directory with CLI argument handling
- Environment variables for configuration via docker-compose

### Integration Points
- Native import runs through NocoDB UI (manual step documented in SETUP.md)
- After import, data available at NocoDB Data API v3 for workflow nodes to query (Phase 3+)
- NocoDB UI at http://localhost:8080 for verification and spot-checking

</code_context>

<specifics>
## Specific Ideas

- The native import flow is: bootstrap creates workspace/base → user triggers Import from Airtable in NocoDB UI → import creates 4 tables with data → verify counts + spot-check
- Import advanced settings: enable Import data, Import attachment columns, disable Import secondary views (unless needed), enable Import rollup/lookup columns
- Formulas are not supported by the import — verify if Airtable uses formula fields in any table that would need manual recreation
- Document the import steps in SETUP.md (Phase 7) including: how to get Shared Base URL, which toggle on/off

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 2-Data Migration*
*Context gathered: 2026-06-10*
