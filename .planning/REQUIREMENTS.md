# Requirements: JobSignal Engine — Airtable to NocoDB Migration

**Defined:** 2026-06-09
**Core Value:** Discover, score, and prep every relevant job opportunity without manual effort — with a fully self-hosted database backend.

## v1 Requirements

### Infrastructure

- [ ] **INFR-01**: Add NocoDB service to docker-compose.example.yml with PostgreSQL backend and local attachment storage
- [ ] **INFR-02**: Configure NocoDB environment variables (API tokens, JWT secret, attachment size limits)

### Automated Bootstrap

- [ ] **BOOT-01**: Create `scripts/nocodb_bootstrap.py` — single-command script that creates all 4 tables (Profile, Tracked Companies, Pipeline, Search Queries) with correct field types, select options, descriptions via NocoDB Meta API v3
- [ ] **BOOT-02**: Translate `airtable/schema.json` to equivalent NocoDB schema definition
- [ ] **BOOT-03**: Script supports `--import-data` flag to seed records from CSV or Airtable export
- [ ] **BOOT-04**: Script supports `--table` flag for incremental table creation (not just full bootstrap)

### Data Migration

- [ ] **DATA-01**: Migrate existing Airtable data to NocoDB (authenticated via Airtable PAT + shared base ID, or via CSV export + import)
- [ ] **DATA-02**: Verify all migrated records have correct field types, select values, and linked record references

### Workflow Migration — Scanners (Wf 1a, 1b, 1c, 1d)

- [ ] **SCAN-01**: Replace Airtable nodes in Greenhouse scanner (1a) with NocoDB HTTP Request nodes — reading Tracked Companies, checking Pipeline for duplicates via FNV-1a hash, inserting new Pipeline records
- [ ] **SCAN-02**: Same replacement for Ashby scanner (1b)
- [ ] **SCAN-03**: Same replacement for Lever scanner (1c)
- [ ] **SCAN-04**: Same replacement for JobSpy scanner (1d) — including reading Search Queries from NocoDB

### Workflow Migration — Evaluator (Wf 2)

- [ ] **EVAL-01**: Replace Airtable nodes — reading Profile, reading Pipeline records with Status="New", updating scores/interview prep back to Pipeline
- [ ] **EVAL-02**: High Fit email alert logic unchanged — still reads from Pipeline records

### Workflow Migration — Tailor (Wf 3)

- [ ] **TAIL-01**: Replace Airtable nodes — reading Profile + Pipeline records with Status="Evaluated" + High Fit
- [ ] **TAIL-02**: Adapt CV DOCX upload to NocoDB storage API: `POST /api/v2/storage/upload` → update Pipeline record attachment field with response array
- [ ] **TAIL-03**: Verify CV attachment appears in NocoDB UI with preview and download

### Workflow Migration — Housekeeper (Wf 4) + Alerter (Wf 6)

- [ ] **MAINT-01**: Replace Airtable nodes in Housekeeper — archive stale, close ghosted, alert stuck
- [ ] **MAINT-02**: Replace Airtable nodes in Alerter — read pipeline stats for daily digest

### Documentation

- [ ] **DOC-01**: Update SETUP.md — replace Airtable setup steps with NocoDB setup + bootstrap script
- [ ] **DOC-02**: Create `docs/NOCODB-SCHEMA.md` documenting all 4 tables with field types, relationships, and sample values
- [ ] **DOC-03**: Update README architecture diagrams (replace Airtable with NocoDB), badges, tech stack table
- [ ] **DOC-04**: Update COST-GUIDE.md — remove Airtable free tier record limits section, add NocoDB hosting costs
- [ ] **DOC-05**: Update CUSTOMIZATION.md — replace Airtable-specific UI instructions with NocoDB equivalents
- [ ] **DOC-06**: Update `docs/AIRTABLE-SCHEMA.md` with deprecation notice pointing to NOCODB-SCHEMA.md

### Verification

- [ ] **VER-01**: All 8 workflows execute end-to-end against NocoDB with identical output (same scores, same CVs, same alerts)
- [ ] **VER-02**: NocoDB bootstrap script works on a clean deployment — one command creates all tables with correct types
- [ ] **VER-03**: New deployment scenario: fresh NocoDB → run bootstrap → import workflows → works immediately
- [ ] **VER-04**: CV DOCX attachment visible and downloadable from NocoDB Pipeline record

## v2 Requirements

- **OAuth/provider auth plugins** — Not part of this migration
- **Multi-user support** — Remains single-user pipeline

## Out of Scope

| Feature | Reason |
|---------|--------|
| Workflow logic changes | Only the database backend is swapped — prompts, schedules, pipeline flow stay identical |
| JobSpy replacement | Scraping sidecar pattern is unchanged |
| AI provider changes | The workflow still uses OpenAI-compatible credential |
| Custom frontend | NocoDB provides its own spreadsheet UI |
| Performance optimization | Existing sequential pipeline timing not addressed by this migration |
| MinIO/S3 object storage | NocoDB's local Docker volume storage is sufficient for single-node deployment |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFR-01 | Phase 1 | Pending |
| INFR-02 | Phase 1 | Pending |
| BOOT-01 | Phase 1 | Pending |
| BOOT-02 | Phase 1 | Pending |
| BOOT-03 | Phase 1 | Pending |
| BOOT-04 | Phase 1 | Pending |
| DATA-01 | Phase 2 | Pending |
| DATA-02 | Phase 2 | Pending |
| SCAN-01 | Phase 3 | Pending |
| SCAN-02 | Phase 3 | Pending |
| SCAN-03 | Phase 3 | Pending |
| SCAN-04 | Phase 3 | Pending |
| EVAL-01 | Phase 4 | Pending |
| EVAL-02 | Phase 4 | Pending |
| TAIL-01 | Phase 5 | Pending |
| TAIL-02 | Phase 5 | Pending |
| TAIL-03 | Phase 5 | Pending |
| MAINT-01 | Phase 6 | Pending |
| MAINT-02 | Phase 6 | Pending |
| DOC-01 | Phase 7 | Pending |
| DOC-02 | Phase 7 | Pending |
| DOC-03 | Phase 7 | Pending |
| DOC-04 | Phase 7 | Pending |
| DOC-05 | Phase 7 | Pending |
| DOC-06 | Phase 7 | Pending |
| VER-01 | Phase 8 | Pending |
| VER-02 | Phase 8 | Pending |
| VER-03 | Phase 8 | Pending |
| VER-04 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-09*
*Last updated: 2026-06-09 after initial definition*
