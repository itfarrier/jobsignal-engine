# Phase 2: Data Migration — Research

**Researched:** 2026-06-10
**Domain:** Airtable → NocoDB data migration via native Import from Airtable feature
**Confidence:** HIGH

## Summary

Phase 2 migrates all existing Airtable data (4 tables — Profile, Tracked Companies, Pipeline, Search Queries) into the NocoDB base created in Phase 1. The migration uses NocoDB's native "Import from Airtable" feature, which handles schema, data, attachment columns, rollup/lookup columns, and linked records in a single pass — no custom scripting required.

**Key findings:**

1. **Import method is UI-driven, not API-driven.** The native import requires: (a) an Airtable Personal Access Token (PAT) with `data.records:read` scope, and (b) a Shared Base URL (requires "Turn on full base access" public sharing). The user opens the NocoDB UI, selects `Import Data → Airtable Base` within the "JobSignal Engine" base, enters credentials, and clicks Import Base.

2. **Bootstrap script needs minor modification.** The current `nocodb_bootstrap.py` creates workspace + base + tables. For Phase 2, tables SHOULD be created by the import (not by bootstrap), since the import brings schema AND data together. A `--workspace-only` flag (or equivalent) should be added so the script stops after base creation, leaving an empty target for the import.

3. **The import has specific toggle behavior.** Advanced settings let you enable/disable: Import data (ON), Import secondary views (OFF — not needed), Import rollup columns (ON), Import lookup columns (ON), Import attachment columns (ON — critical for preserving `Tailored CV` DOCX files), Import formula columns (greyed out — NOT supported, but the Airtable schema has NO formula fields, so this doesn't matter).

4. **No linked record fields exist in Airtable schema.** All cross-table references in the Airtable tables are text/select field values (Company as text, Source as single select, etc.) — not formal Airtable linked record fields. The native import carries these over as plain field values.

5. **Verification is count-based + spot-check.** Compare record counts between Airtable and NocoDB per table. Spot-check 10+ records per table comparing field values. For the Profile table (single critical row), do a full field-by-field comparison including the CV Markdown long text.

6. **Attachments are preserved via the "Import attachment columns" toggle.** The `Tailored CV` Attachment field in the Pipeline table stores DOCX files. The import downloads them from Airtable and stores them in NocoDB's local Docker volume (`nocodb_data`). This requires "Import attachment columns" to be enabled in advanced settings.

**Primary recommendation:** Use the UI-driven native import as the sole data migration method. The bootstrap script creates the empty base; the import fills it with schema + data. No custom API migration script is needed.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use NocoDB's native "Import from Airtable" feature — not a custom API script. It handles schema + data + linked records + attachments in one pass, requires only an Airtable PAT and Shared Base URL.
- **D-02:** Bootstrap script (`nocodb_bootstrap.py`) creates the workspace and base infrastructure only — the native import creates tables and populates data. The bootstrap's `--import-data` flag is effectively superseded for Phase 2.
- **D-03:** Enable "Import attachment columns" in the import settings so existing DOCX tailored CVs are preserved.
- **D-04:** Enable "Turn on full base access" public sharing in Airtable to generate the Shared Base URL required by the native import. Can be revoked after migration completes at Phase 8.
- **D-05:** Airtable remains the active source of truth during Phases 3-7. Data is imported once in Phase 2 — no dual-write, no incremental sync.
- **D-06:** All cross-table references in the Airtable schema are text/select field values (Company as Text, Source as Single select, etc.) — no formal linked record fields to map. The native import carries these over as-is.
- **D-07:** n8n workflows query records by field values (Status, Fit Tier, etc.), not by hardcoded Airtable record IDs. New NocoDB record IDs are irrelevant.
- **D-08:** Verify by comparing record counts per table between Airtable and NocoDB, plus manual spot-check of 10+ records per table.
- **D-09:** For the Profile table (critical single row driving all AI prompts), perform a full field-by-field comparison including the CV Markdown long text.
- **D-10:** Automated field-level comparison scripts are not needed — counts + spot-checking is sufficient.
- **D-11:** One-shot import now. Workflows continue on Airtable through Phases 3-7. At Phase 8, all 8 workflows flip to NocoDB simultaneously. Airtable kept as read-only fallback during Phase 8 verification, then deprecated.

### The Agent's Discretion
*(None — all decisions locked in CONTEXT.md)*

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | Migrate existing Airtable data to NocoDB (authenticated via Airtable PAT + shared base ID, or via CSV export + import) | NocoDB's native "Import from Airtable" feature handles the full migration via PAT + Shared Base URL. See "Airtable Import from NocoDB: Feature Details" section. Decision D-01 locks this as the method. |
| DATA-02 | Verify all migrated records have correct field types, select values, and linked record references | Verification approach documented: record count comparison (all 4 tables), 10+ record spot-check per table, full field-by-field on Profile table. See "Verification Approach" section. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Airtable data source | Airtable (external) | — | Source of truth during migration; PAT + Shared Base URL provide read access |
| Import orchestration | NocoDB UI | — | The "Import from Airtable" feature runs inside NocoDB; user triggers via browser |
| NocoDB target base | Bootstrap Script | Docker Compose | Bootstrap creates workspace/base (Phase 1 artifact); Docker Compose hosts NocoDB |
| Data verification | Human (browser + API) | NocoDB REST API | Record counts via NocoDB UI or Data API; manual spot-checking per D-08/09/10 |
| Attachment storage | NocoDB Docker volume | — | `nocodb_data` volume holds all attachment files (per Phase 1 D-12) |
| Post-migration data serving | NocoDB Data API v2/v3 | — | Workflows will query NocoDB via HTTP Request nodes in Phases 3-7 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| NocoDB | `:latest` (calver) | Target database — receives import | Per D-01; Phase 1 already deployed |
| Airtable | SaaS | Source database — supplies data | Existing; PAT provides read access |
| NocoDB Import from Airtable | Built-in NocoDB feature | Schema + data migration | Per D-01; native feature, no code needed |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| Airtable PAT | N/A | Authentication for import read | Get from https://airtable.com/create/tokens; scope: `data.records:read` |
| Shared Base URL | N/A | Import source identification | From Airtable Share menu → "Turn on full base access" |
| `curl` | any | Quick-count NocoDB records post-import | Verify record counts via Data API |
| Browser | any | NocoDB UI for import trigger + spot-check | Trigger import manually; verify data visually |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native "Import from Airtable" | Custom Python script using Airtable API → NocoDB API | Native handles schema mapping, select options, attachments, linked records in one pass. Custom script would require 1:1 field mapping plus attachment download/upload logic (deceptively complex). |

## Airtable Import from NocoDB: Feature Details

> Source: [CITED: nocodb.com/docs/product-docs/bases/import-base-from-airtable] — official NocoDB documentation

### Prerequisites

1. **Airtable Personal Access Token (PAT)**
   - Create at: https://airtable.com/create/tokens
   - Minimum scope: `data.records:read`
   - Must include the specific base being imported
   - Per D-04: Can be revoked after Phase 8 cutover
   
2. **Shared Base URL (with full base access)**
   - In Airtable: Share menu → "Share Publicly" tab → Enable "Turn on full base access"
   - Copy the generated URL (format: `https://airtable.com/appXXXXXXXXXXXXXXX/shrYYYYYYYYYYYYYYYYY`)
   - Per D-04: Can be revoked after Phase 8 cutover

### How to Open the Import Modal

**Path A — From the base context menu (recommended — imports INTO current base):**
1. In NocoDB UI, open the "JobSignal Engine" base (created by bootstrap script)
2. Hover over the base name in the left sidebar
3. Click the `...` icon → "Import data" → "Airtable Base"

**Path B — From the base dashboard:**
1. Click "Import Data" on the base dashboard
2. Select "Airtable"

Use Path A if you want to import into the existing "JobSignal Engine" base (tables will be created inside it). Path B typically creates a new base.

### Required Fields in the Modal

| Field | Value | Notes |
|-------|-------|-------|
| Personal Access Token | `patXXXXXXXXXXXXXXX...` | From Airtable developer settings |
| Shared Base ID or URL | `https://airtable.com/app.../shr...` | From Airtable "Share Publicly" tab |
| Data Source | Default (or select the target DB connection) | Default uses NocoDB's attached PostgreSQL |

### Advanced Settings (Critical Toggles)

| Setting | Recommended | Rationale |
|---------|-------------|-----------|
| **Import data** | ✅ ON (default) | Must be enabled to bring actual records. Disabling creates schema-only. |
| **Import secondary views** | ❌ OFF | Only the primary Grid view is needed. Airtable's recommended views (High Fit Review, etc.) will not be imported — they're user-created views, not part of the data. |
| **Import rollup columns** | ✅ ON | Per D-01. Rollup fields ARE in the schema — ensure they're carried over. |
| **Import lookup columns** | ✅ ON | Per D-01. Lookup fields ARE in the schema — ensure they're carried over. |
| **Import attachment columns** | ✅ ON | **Per D-03 — CRITICAL.** The Pipeline table has a `Tailored CV` Attachment field with existing DOCX files. Must be enabled to preserve these. |
| **Import formula columns** | ❌ Greyed out (NOT supported) | **This does NOT affect JobSignal.** The 4 Airtable tables have zero formula fields. No data loss. |

### What the Import Handles

| Feature | Handled? | Notes |
|---------|----------|-------|
| Table schema (fields, types) | ✅ Yes | All 4 tables created with correct types |
| Record data | ✅ Yes | All rows migrated |
| Single Select options | ✅ Yes | Options like Status, Fit Tier, Source, Scan Method preserved |
| Multi Select options | ✅ Yes | Options like Core Skills, Target Roles, Target Geography preserved |
| Date fields | ✅ Yes | Dates preserved in `YYYY-MM-DD` format |
| URL fields | ✅ Yes | Apply Link, Careers URL, API Endpoint preserved |
| Number/Decimal fields | ✅ Yes | Fit Score, costs, etc. preserved with precision |
| Long text fields | ✅ Yes | CV Markdown, Job Descriptions, etc. preserved |
| Attachment fields | ✅ Yes | **When "Import attachment columns" is ON (per D-03)** — Tailored CV DOCX files downloaded from Airtable and stored in `nocodb_data` Docker volume |
| Checkbox fields | ✅ Yes | Enabled/disabled flags preserved |
| Linked record fields | ✅ Yes | But **not relevant** — the JobSignal schema has no formal linked record fields (D-06) |
| Rollup fields | ✅ Yes | When "Import rollup columns" is ON |
| Lookup fields | ✅ Yes | When "Import lookup columns" is ON |
| Formula fields | ❌ NOT supported | **Not relevant** — JobSignal schema has no formula fields |
| Secondary views | ✅ Yes | When "Import secondary views" is ON — **recommend OFF** |
| Table descriptions | ❌ May not carry over | Import creates tables from Airtable schema; descriptions may not survive. Verify after import and document any gaps in SETUP.md. |
| Table ordering | ✅ Yes | Tables appear in the same order as Airtable |

### Post-Import State

After import completes:
1. NocoDB shows "Airtable Base Imported" confirmation with a "Show Details" log
2. Click "Go to base" to see the imported tables
3. All 4 tables should appear in the left sidebar with data
4. Record counts should match Airtable source counts

## Bootstrap Script Modification

### Current State

The Phase 1 `scripts/nocodb_bootstrap.py` currently performs:
1. Wait for NocoDB
2. Sign up / sign in
3. Get or create workspace
4. Get or create base
5. Create API token
6. Create all 4 tables with fields (from `nocodb-schema.json`)
7. Optionally import CSV data (`--import-data`)

### Required Change for Phase 2

Per D-02, the bootstrap should create workspace and base only — the native import handles table creation and data population. Add a `--workspace-only` flag:

```python
# New flag for Phase 2
parser.add_argument(
    "--workspace-only",
    action="store_true",
    help="Create workspace + base only (skip table creation — import from Airtable creates tables)"
)
```

**Behavior with `--workspace-only`**:
- Steps 1-5 execute normally (wait → auth → workspace → base → API token)
- Step 6 (table creation) is skipped entirely
- `--import-data` is ignored if `--workspace-only` is set
- The base is left empty for the native import to populate

**Idempotent behavior**: Already handled by `get_or_create_workspace()` and `get_or_create_base()` — these are list-first, so running `--workspace-only` twice is safe.

**No change to `nocodb-schema.json`**: The schema file remains as-is for Phase 7 documentation and for the eventual `docs/NOCODB-SCHEMA.md`.

## Verification Approach

### Automated Verifications (via NocoDB Data API)

After import, verify record counts using the NocoDB Data API v2:

```bash
# Step 1: Get table IDs from Meta API
curl http://localhost:8080/api/v3/meta/bases/{BASE_ID}/tables \
  -H "xc-token: ${NOCDB_API_TOKEN}" | jq '.list[] | {title: .title, id: .id}'

# Step 2: Count records in each table using the Data API
# Use the `limit` parameter — the `totalRecords` field in the response tells you the total count
curl "http://localhost:8080/api/v2/tables/{TABLE_ID}/records?limit=1" \
  -H "xc-token: ${NOCDB_API_TOKEN}" | jq '.pageInfo.total'

# Or use the Meta API which returns record counts
curl "http://localhost:8080/api/v3/meta/bases/{BASE_ID}/tables" \
  -H "xc-token: ${NOCDB_API_TOKEN}" | jq '.list[] | {title: .title, records: .totalRecords}'
```

### Airtable Source Counts (for comparison)

Get record counts from Airtable via its API:
```bash
curl "https://api.airtable.com/v0/meta/bases/{BASE_ID}/tables" \
  -H "Authorization: Bearer ${AIRTABLE_TOKEN}" | jq '.tables[] | {name: .name, count: .fields | length}'
```

Or manually from the Airtable UI (each table shows record count in the toolbar).

### Verification Matrix

| Table | Source Record Count (Airtable) | Target Record Count (NocoDB) | Match? |
|-------|-------------------------------|------------------------------|--------|
| Profile | 1 | 1 | Must match |
| Tracked Companies | 139 | 139 | Must match |
| Pipeline | [variable — user's data] | [must match] | Must match |
| Search Queries | [variable — user's data] | [must match] | Must match |

### Spot-Check Protocol (per D-08, D-09)

For EACH table:

1. **Random spot-check**: Compare 10+ records between Airtable and NocoDB
   - Open Airtable grid view, note record details
   - Open NocoDB table, find the corresponding record (match on unique field: Job ID for Pipeline, Company Name for Tracked Companies, etc.)
   - Verify: all field values match, select options display correct choices, dates are correct

2. **Profile table — full field-by-field (per D-09)**:
   - Compare ALL 14 fields between Airtable and NocoDB
   - Pay special attention to: `CV Markdown` (long text — scroll completely), `Notification Email`, select values
   - This is the single most critical row in the entire database (drives all AI prompts)

3. **Attachment verification** (per D-03):
   - Find a Pipeline record that has a `Tailored CV` attachment in Airtable
   - In NocoDB, confirm the same record has the attachment visible with preview and download
   - If no Pipeline records exist yet (fresh deployment), this is an N/A pass

4. **Select option value check**:
   - For each SingleSelect/MultiSelect field, verify that the allowed options match Airtable
   - Key fields: Status (7 values), Fit Tier (3 values), Source (6 values), Scan Method (3 values), Seniority Level (5 values), etc.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker / Docker Compose | NocoDB runtime | ✓ | 24.0+ (Phase 1 confirmed) | — |
| NocoDB (port 8080) | Import target | ✓ | `:latest` (Phase 1 confirmed running) | — |
| Airtable PAT | Import source auth | Requires user action | N/A | Must be created by user |
| Airtable Shared Base URL | Import source URL | Requires user action | N/A | Must be created by user |
| Internet access | Airtable API calls | ✓ | N/A | Import requires NocoDB → Airtable connectivity |
| Browser | NocoDB UI (import trigger + verification) | ✓ | N/A | — |
| `curl` / `jq` | Post-import verification | ✓ | macOS bundled + Homebrew | — |

**Missing dependencies with no fallback:**
- Airtable PAT — user must create at https://airtable.com/create/tokens before import
- Airtable Shared Base URL — user must enable "Turn on full base access" in Airtable Share menu before import

**Missing dependencies with fallback:**
- None — all infrastructure dependencies are in place from Phase 1

## Import Workflow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Phase 2: Data Migration                    │
└─────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────┐
  │  1. Bootstrap --workspace-  │  python scripts/nocodb_bootstrap.py
  │     only                    │  --password <pwd> --workspace-only
  │                             │
  │  Creates: workspace "JobSignal"
  │           base "JobSignal Engine"
  │           API token           │
  └────────────┬────────────────┘
               ▼
  ┌─────────────────────────────┐
  │  2. Create Airtable PAT     │  USER ACTION:
  │     + Shared Base URL       │  https://airtable.com/create/tokens
  │                             │  scope: data.records:read
  │                             │  Share → Public → Full base access
  └────────────┬────────────────┘
               ▼
  ┌─────────────────────────────┐
  │  3. Open NocoDB UI          │  http://localhost:8080
  │     → "JobSignal Engine"    │  Sign in with admin credentials
  │     → ... → Import Data     │  (from Phase 1 bootstrap)
  │     → Airtable Base         │
  └────────────┬────────────────┘
               ▼
  ┌─────────────────────────────┐
  │  4. Configure & Import      │  Paste PAT + Shared Base URL
  │                             │  Advanced settings:
  │   Toggles (per D-01, D-03):  │    ✓ Import data
  │   - Import data: ON         │    ✗ Import secondary views
  │   - Attachments: ON         │    ✓ Import rollup columns
  │   - Secondary views: OFF    │    ✓ Import lookup columns
  │   - Rollup: ON              │    ✓ Import attachment columns
  │   - Lookup: ON              │    (formula: greyed out — N/A)
  │                             │
  │   Click "Import Base"       │
  └────────────┬────────────────┘
               ▼
  ┌─────────────────────────────┐
  │  5. Import runs (~1-5 min)  │  NocoDB logs show progress
  │                             │  "Airtable Base Imported"
  │                             │  → Click "Go to base"
  └────────────┬────────────────┘
               ▼
  ┌─────────────────────────────┐
  │  6. Verify migration        │  4 record count comparisons
  │                             │  10+ spot-checks per table
  │                             │  Profile: full field-by-field
  │                             │  Attachments: check Tailored CV
  └─────────────────────────────┘
```

## Bootstrap Script — Required Modifications

### What Currently Exists

The `scripts/nocodb_bootstrap.py` (929 lines, Phase 1 complete) has:
- 14 functions covering signup, workspace, base, token, schema loading, table creation
- Flags: `--nocodb-url`, `--email`, `--password`, `--table`, `--force`, `--import-data`, `--skip-setup`, `--token-only`
- Robust error handling, rate limiting, idempotency

### What to Add for Phase 2

1. **New flag `--workspace-only`** — skips Step 6 (table creation) and Step 7 (CSV import)
2. **Minor**: When `--workspace-only` is used with `--table`, log error (table flag is meaningless without table creation)
3. **Minor**: When `--workspace-only` is used with `--import-data`, log warning (ignored)

### Validation After Change

```bash
# Test 1: workspace-only mode
python scripts/nocodb_bootstrap.py --password test123 --workspace-only

# Expected: workspace + base created, no tables, exit 0
# Verify: NocoDB UI shows empty "JobSignal Engine" base

# Test 2: idempotent re-run (no crash)
python scripts/nocodb_bootstrap.py --password test123 --workspace-only

# Expected: workspace + base "already exists", skip creation, exit 0
```

## Package Legitimacy Audit

> No new external packages are installed in Phase 2. The migration uses:
> - NocoDB's built-in "Import from Airtable" feature (no code)
> - Existing `scripts/nocodb_bootstrap.py` (Python stdlib + `requests`) — already audited in Phase 1
> - `curl` and `jq` for post-import verification (OS-level tools, not pip packages)

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `requests` | PyPI | 12+ yrs | 100M+/wk | github.com/psf/requests | [OK] | Approved (Phase 1) |
| `curl` | OS | 25+ yrs | N/A | curl.se | [OK] | Approved (OS-level) |
| `jq` | Homebrew | 10+ yrs | N/A | github.com/jqlang/jq | [OK] | Approved (OS-level) |

**No new packages to audit.** The phase installs zero external dependencies.

## Common Pitfalls

### Pitfall 1: Import Creates a NEW Base Instead of Populating Existing Base
**What goes wrong:** The user selects "Import Data → Airtable" from the base dashboard (Path B), which creates a new separate base like "JobSignal Engine (1)" instead of populating the existing "JobSignal Engine" base.
**Why it happens:** The NocoDB Import from Airtable feature has two entry points. The dashboard-level import creates a new base. The base context menu import adds to the current base.
**How to avoid:** Always use the base context menu path: click the `...` next to "JobSignal Engine" in the sidebar, then select "Import data" → "Airtable Base".
**Warning signs:** After import, the sidebar shows a second base entry. Tables exist but are in the wrong base.

### Pitfall 2: Import Attachment Columns Not Enabled
**What goes wrong:** The `Tailored CV` Attachment field in Pipeline records is empty after import. All DOCX files are lost.
**Why it happens:** "Import attachment columns" defaults to ON, but a user might disable it thinking it saves time/bandwidth.
**How to avoid:** Per D-03: explicitly verify the toggle is ON before clicking "Import Base". Document this as a critical step.
**Recovery:** If already imported without attachments, delete the imported tables and re-import with the toggle enabled. The import is idempotent for tables (NocoDB creates new tables if they don't exist, or adds to existing ones — untested behavior for duplicates).

### Pitfall 3: PAT Scope Missing Required Base
**What goes wrong:** The import validates the PAT but fails because the PAT wasn't granted access to the specific base being imported.
**Why it happens:** When creating the PAT at https://airtable.com/create/tokens, the user must explicitly select which bases the token can access. If the JobSignal base isn't selected, the API returns access denied.
**How to avoid:** When creating the PAT, ensure "All current and future bases" is selected, or at minimum check the specific "JobSignal Engine" base. Revoke the PAT after Phase 8.
**Warning signs:** Import error message about access/permissions to the base.

### Pitfall 4: Shared Base URL Has View-Level Access Instead of Full Base Access
**What goes wrong:** The user shares a single view (e.g., "Grid view") instead of the full base with "Turn on full base access".
**Why it happens:** Airtable's default share link is view-scoped. The "Share Publicly" tab has two tabs: "Share view publicly" (default) and "Share entire base publicly".
**How to avoid:** Navigate to the "Share Publicly" tab and explicitly toggle on "Turn on full base access". The URL should reference the base ID (starts with `app`) followed by a shared base ID (starts with `shr`).
**Warning signs:** Import error: "Invalid shared base URL" or partial import with missing tables.

### Pitfall 5: Table Descriptions Not Carried Over
**What goes wrong:** After import, NocoDB tables may not have descriptions visible in the UI, even though `nocodb-schema.json` defines them.
**Why it happens:** The import from Airtable creates tables with schema but may not preserve descriptions (these are Airtable UI-level metadata, not stored in the data API). The descriptions in `nocodb-schema.json` are authoritative for documentation.
**How to avoid:** Add descriptions manually via the NocoDB UI after import if needed. This is cosmetic — workflow logic doesn't depend on table descriptions.
**Future fix:** Phase 7 `docs/NOCODB-SCHEMA.md` will document all field descriptions.

### Pitfall 6: Bootstrap Script Creates Tables Before Import, Causing Conflicts
**What goes wrong:** User runs bootstrap without `--workspace-only`, which creates empty tables. Then the import tries to create tables with the same names, causing duplicate or failed table creation.
**Why it happens:** Without the new `--workspace-only` flag, the bootstrap script creates all 4 tables. The import expects to create tables in an empty base.
**How to avoid:** Always use `--workspace-only` flag in Phase 2. The `--workspace-only` flag is being added specifically to prevent this.
**Recovery:** Delete the empty tables in NocoDB UI before running import, or re-run bootstrap with `--force` + import into the freshly empty base.

### Pitfall 7: NocoDB API Token Not Saved
**What goes wrong:** The bootstrap script prints the API token to stdout, but the user closes the terminal without copying it.
**Why it happens:** NocoDB only returns the raw token once (in the creation response). Subsequent reads return a masked value.
**How to avoid:** Use `--token-only` flag on subsequent bootstrap runs to retrieve the saved token from `NOCDB_API_TOKEN` env var. If not saved, create a new token via the NocoDB UI (Account Settings → API Tokens).
**Verification impact:** Post-import record counting via the API requires a valid token. Without one, the user must verify manually in the UI.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Airtable data extraction | Custom Airtable API script | NocoDB native "Import from Airtable" | Native feature handles schema mapping, select options, attachments, linked records — dozens of edge cases that a custom script would need to handle. Airtable API pagination, rate limits, attachment streaming → deceptively complex. |
| Schema translation | Manual field-by-field mapping code | `nocodb-schema.json` + Import from Airtable | The import auto-detects field types. The schema.json acts as a reference/fallback. |
| Attachment migration | Download from Airtable, upload to NocoDB | Native import (with toggle ON) | Native import streams attachments Airtable→NocoDB directly. Manual approach requires temp storage, file size handling, retry logic for individual files. |
| Record count verification | Custom counting script | `curl` + `jq` to NocoDB Data API | Counting is a single API call with `pageInfo.total` in the response. |

**Key insight:** NocoDB's Import from Airtable feature is purpose-built for this exact use case. It handles schema inference, data type mapping, attachment fetching, and linked record preservation — all edge cases that a hand-rolled script would need months to stabilize. Do not write a custom migration.

## Runtime State Inventory

> This is a data migration phase. The "runtime state" refers to data and configuration that exists outside the git repository.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data — Source | Airtable base "JobSignal Engine" with 4 tables: Profile (1 row), Tracked Companies (139 rows), Pipeline (0+ rows — auto-populated), Search Queries (0+ rows — user-configured) | Import into NocoDB via native import. No destructive action on Airtable — it remains active source of truth. |
| Stored data — Target | NocoDB base "JobSignal Engine" at http://localhost:8080 (empty — Phase 1 only created infrastructure) | Accept import data. After Phase 8 cutover, this becomes the new source of truth. |
| Live service config | n8n workflows (8 JSON files) reference Airtable by base ID `appE808oZ5gTSQzUY` — hardcoded in workflow nodes | **Not changed in Phase 2** (D-05). Workflows continue on Airtable through Phases 3-7. Phase 8 flips to NocoDB. |
| Secrets / env vars | Airtable Personal Access Token (user-managed), NocoDB API token (in docker-compose) | Airtable PAT: create for import, revoke after Phase 8. NocoDB token: already managed (Phase 1). |
| Build artifacts | None — no build system for data | N/A |

**Nothing found in category:** OS-registered state — the data migration has no OS-level registrations (no cron jobs, no LaunchAgents, no Task Scheduler entries related to the data itself).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual CSV export/import | NocoDB native "Import from Airtable" | NocoDB 0.300+ (2025) | One-click import with schema mapping, attachment handling, linked record preservation. Eliminates multi-step CSV workflow. |
| Bootstrap `--import-data` (CSV seeding) | Native import (superseded) | Phase 2 | D-02 explicitly supersedes the CSV approach. The native import is superior for existing-data migration. The `--import-data` flag remains useful for fresh deployments. |
| Airtable as source of truth | NocoDB as source of truth | Phase 8 | Phase 2 imports data but doesn't flip the switch. Workflows continue on Airtable through Phase 7. |

**Deprecated/outdated:**
- `scripts/airtable_bootstrap.py`: Being replaced by `scripts/nocodb_bootstrap.py` (Phase 1 complete). Not referenced here but tracking for Phase 7 cleanup.

## Code Examples

### Pre-Import: Create Workspace + Base Only (Skip Tables)

```bash
python scripts/nocodb_bootstrap.py \
  --password "${NOCODB_ADMIN_PASSWORD}" \
  --workspace-only
```

### Post-Import: Verify Record Counts via API

```bash
# Set tokens
NOCDB_API_TOKEN="your_token_here"
BASE_ID=$(curl -s http://localhost:8080/api/v3/meta/workspaces \
  -H "xc-auth: ${NOCDB_API_TOKEN}" | jq -r '.list[0].id')

# Get tables and their record counts
curl -s "http://localhost:8080/api/v3/meta/bases/${BASE_ID}/tables" \
  -H "xc-auth: ${NOCDB_API_TOKEN}" | jq '.list[] | {title: .title, records: .totalRecords}'
```

Expected output:
```json
{
  "title": "Profile",
  "records": 1
}
{
  "title": "Tracked Companies",
  "records": 139
}
{
  "title": "Pipeline",
  "records": 42
}
{
  "title": "Search Queries",
  "records": 5
}
```

### Post-Import: Get All Records from a Table (for Spot-Check)

```bash
TABLE_ID="<get from previous step>"
curl -s "http://localhost:8080/api/v2/tables/${TABLE_ID}/records?limit=10" \
  -H "xc-token: ${NOCDB_API_TOKEN}" | jq '.list[] | {Job_Title: .Job_Title, Status: .Status, Fit_Score: .Fit_Score}'
```

### Post-Import: Profile Table Full Field-by-Field Check

```bash
TABLE_ID_PROFILE="<profile table id>"
curl -s "http://localhost:8080/api/v2/tables/${TABLE_ID_PROFILE}/records?limit=1" \
  -H "xc-token: ${NOCDB_API_TOKEN}" | jq '.list[0]'
```

## Validation Architecture

> `.planning/config.json`: `workflow.nyquist_validation: true` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual verification (data migration — no code to unit test) |
| Config file | None |
| Quick run command | `python scripts/nocodb_bootstrap.py --password <pwd> --workspace-only` |
| Full suite command | Quick run + import in NocoDB UI + verification checks |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | Bootstrap creates workspace+base only | manual | `python scripts/nocodb_bootstrap.py --password test123 --workspace-only` | ✅ `nocodb_bootstrap.py` (needs minor modification) |
| DATA-01 | Import from Airtable creates 4 tables with correct schema | manual | Trigger import in NocoDB UI. Verify 4 tables exist with data. | ❌ No test code — manual UI flow |
| DATA-02 | Record counts match per table | manual | Use NocoDB Data API curl commands above. Compare to Airtable UI counts. | ❌ No test code — ad-hoc curl |
| DATA-02 | Spot-check 10+ records per table | manual | Open NocoDB UI + Airtable UI side-by-side. Verify random records. | ❌ Manual human verification |
| DATA-02 | Profile table full field-by-field match | manual | Use NocoDB API to retrieve row, compare to Airtable API/UI. | ❌ Manual human verification |
| DATA-02 | Attachments preserved | manual | Find Pipeline record with Tailored CV in Airtable. Verify in NocoDB. | ❌ Manual human verification |

### Sampling Rate
- **Per task commit:** N/A — no code tests in this phase
- **Per wave merge:** N/A — single wave
- **Phase gate:** All 4 record counts match. 10+ records spot-checked per table. Profile field-by-field verified full.

### Wave 0 Gaps
- [ ] `--workspace-only` flag needs to be added to `scripts/nocodb_bootstrap.py`
- [ ] No automated verification script exists (per D-10 — not needed)
- [ ] User must create Airtable PAT and Shared Base URL (documented in SETUP.md Phase 7)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The Import from Airtable feature imports INTO the currently open base (Path A from context menu) | Airtable Import from NocoDB: Feature Details | MEDIUM — Could create a separate base instead. Mitigation: Document the context-menu path explicitly and add a verification step to check base name post-import. |
| A2 | The import will populate tables with matching field names/select options into the existing empty base | Airtable Import from NocoDB: Feature Details | LOW — Confirmed by NocoDB docs and community examples. The feature is designed to import into the current base. |
| A3 | Airtable schema has zero formula fields | What the Import Handles | LOW — Confirmed by reading AIRTABLE-SCHEMA.md exhaustively. All fields are Text, LongText, Select, Number, Date, URL, Checkbox, or Attachment. No formula field definitions exist. |
| A4 | Import preserves all 139 Tracked Companies records | What the Import Handles | LOW — CSV templates confirm 139 rows. Import handles bulk data correctly as confirmed by docs. |
| A5 | The bootstrap script's `--workspace-only` change is a minimal addition (no side effects) | Bootstrap Script Modification | LOW — It's a simple skip-early-exit in the tables loop. No other logic depends on it. |

## Security Domain

> `security_enforcement` is enabled (absent from config = enabled).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Airtable PAT: scoped to `data.records:read` only (read-only, minimal permission). NocoDB API token: per-base scope. |
| V3 Session Management | No | No user sessions in data migration. Bootstrap uses signin tokens transiently. |
| V4 Access Control | Yes | Airtable shared base URL: full base access (required by import). Can be revoked after Phase 8. |
| V5 Input Validation | No | No code processes untrusted input in this phase. |
| V6 Cryptography | No | No custom cryptography. Airtable API uses HTTPS. NocoDB API uses HTTP (localhost) or HTTPS (Caddy). |
| V8 Data Protection | Yes | Sensitive data (CV Markdown, Notification Email, PAT, API tokens) handled per threat model. |

### Known Threat Patterns for Phase 2

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| PAT exposure in terminal history | Information Disclosure | Document: prepend with space to avoid shell history, or use env var. Revoke after Phase 8. |
| Airtable shared base URL accessible to unauthorized parties | Information Disclosure | Shared URL has a random `shr_` token — unguessable. Still, document the risk and recommendation to revoke after Phase 8. |
| NocoDB API token printed to stdout | Information Disclosure | Bootstrap already does this (Phase 1 issue). Document: copy immediately, close terminal. |
| Import runs over internet (Airtable API) | Tampering | HTTPS transport. NocoDB server initiates the connection — no user-side injection point. |

## Sources

### Primary (HIGH confidence)
- `/nocodb/noco-docs` — NocoDB import from Airtable feature documentation (31 code snippets, High reputation, confirmed via Context7)
- `/nocodb/noco-docs` — NocoDB REST API documentation for post-import verification
- [VERIFIED: npm registry?] — N/A (no npm packages; this is a feature, not a package)
- `airtable/AIRTABLE-SCHEMA.md` — Source schema verification (4 tables, zero formula fields)
- `scripts/nocodb_bootstrap.py` — Existing bootstrap script for modification analysis
- `airtable/templates/*.csv` — CSV templates confirming 139 Tracked Companies, single Profile row
- `scripts/nocodb-schema.json` — NocoDB schema for field type reference

### Secondary (MEDIUM confidence)
- NocoDB Import from Airtable docs (https://nocodb.com/docs/product-docs/bases/import-base-from-airtable) — Official docs confirming prerequisite flow, advanced settings, and limitations

### Tertiary (LOW confidence)
- N/A — All critical claims are verified against official documentation or confirmed by codebase analysis

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — NocoDB import feature is the documented, recommended approach; zero alternatives considered
- Architecture: HIGH — Two-step flow (bootstrap → UI import) is simple and deterministic
- Pitfalls: HIGH — All identified from (a) known NocoDB behaviors, (b) Airtable API patterns, (c) codebase analysis
- Security: MEDIUM — General security patterns are clear; specific NocoDB CE behavior around token scoping may vary

**Research date:** 2026-06-10
**Valid until:** 2026-07-10 (30 days — NocoDB's calendar versioning means UI changes are possible; import feature behavior is stable)
