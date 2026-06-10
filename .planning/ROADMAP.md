# Roadmap: JobSignal Engine — Airtable to NocoDB Migration

## Overview

Migrate JobSignal Engine's backend database from Airtable to self-hosted NocoDB, eliminating external dependency on Airtable's free-tier record limits. Starting with NocoDB infrastructure and a bootstrap script for automated table creation, we import existing data, then systematically replace Airtable nodes across all 8 n8n workflows with NocoDB HTTP Request nodes — one workflow group at a time. Documentation updates and end-to-end verification cap the migration.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Infrastructure & Bootstrap** - Deploy NocoDB via Docker Compose and create the bootstrap script for automated table creation
- [ ] **Phase 2: Data Migration** - Import existing Airtable data into NocoDB with field integrity
- [ ] **Phase 3: Scanner Workflows Migration** - Replace Airtable nodes in all 4 scanner workflows (Greenhouse, Ashby, Lever, JobSpy)
- [ ] **Phase 4: Evaluator Workflow Migration** - Replace Airtable nodes in the Evaluator workflow
- [ ] **Phase 5: Tailor Workflow & Attachments Migration** - Replace Airtable nodes in Tailor and adapt CV DOCX upload to NocoDB storage API
- [ ] **Phase 6: Housekeeper & Alerter Migration** - Replace Airtable nodes in Housekeeper and Alerter workflows
- [ ] **Phase 7: Documentation** - Update all documentation to reflect NocoDB as the backend
- [ ] **Phase 8: Verification & Cleanup** - End-to-end verification and Airtable reference cleanup

## Phase Details

### Phase 1: Infrastructure & Bootstrap

**Goal**: NocoDB is deployed as a Docker service and the bootstrap script can create all 4 tables with correct field types via a single command
**Depends on**: Nothing (first phase)
**Requirements**: INFR-01, INFR-02, BOOT-01, BOOT-02, BOOT-03, BOOT-04
**Success Criteria** (what must be TRUE):

  1. `docker-compose up -d` starts NocoDB with PostgreSQL backend and local attachment storage; NocoDB UI is accessible at configured port
  2. `python scripts/nocodb_bootstrap.py` creates all 4 tables (Profile, Tracked Companies, Pipeline, Search Queries) with correct field types, select options, and descriptions via NocoDB Meta API v3
  3. `python scripts/nocodb_bootstrap.py --table Pipeline` creates a single table without affecting others
  4. `python scripts/nocodb_bootstrap.py --import-data` seeds tables from CSV/export data
  5. docker-compose.example.yml includes NocoDB service with API token, JWT secret, and attachment size limit configuration

**Plans**: 4 plans

**Wave 1**

- [x] 01-01-PLAN.md — NocoDB Docker infrastructure + Schema definition

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Bootstrap script (nocodb_bootstrap.py)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 01-03-PLAN.md — End-to-end verification

**Wave 4** (gap closure — idempotency fix)

- [x] 01-04-PLAN.md — Idempotent workspace + base creation (gap closure)

**Cross-cutting constraints:**

- docker-compose up -d starts NocoDB and nocodb-postgres containers
- NocoDB UI is accessible at http://localhost:8080

### Phase 2: Data Migration

**Goal**: All existing Airtable data is migrated to NocoDB with correct field types and linked record references
**Depends on**: Phase 1 (needs NocoDB running with tables created)
**Requirements**: DATA-01, DATA-02
**Success Criteria** (what must be TRUE):

  1. Record counts in all 4 NocoDB tables match the source Airtable tables
  2. Field types, select option values, and linked record references are preserved (no data type coercion errors)
  3. Data migration runs via the bootstrap script's `--import-data` flag or a standalone migration script using Airtable PAT authentication
  4. Spot-check of 10+ records per table confirms values, selects, and links match originals

**Plans**: TBD

### Phase 3: Scanner Workflows Migration

**Goal**: All 4 scanner workflows (Greenhouse, Ashby, Lever, JobSpy) read/write to NocoDB instead of Airtable, producing identical results
**Depends on**: Phase 2 (needs data for duplicate checking via FNV-1a hash)
**Requirements**: SCAN-01, SCAN-02, SCAN-03, SCAN-04
**Success Criteria** (what must be TRUE):

  1. Greenhouse scanner (1a) reads Tracked Companies and Pipeline from NocoDB, inserts new Pipeline records with same fields — identical output to pre-migration run
  2. Ashby scanner (1b) produces identical Pipeline records against NocoDB
  3. Lever scanner (1c) produces identical Pipeline records against NocoDB
  4. JobSpy scanner (1d) reads Search Queries from NocoDB, checks Pipeline for duplicates via FNV-1a hash, inserts new records — identical output

**Plans**: TBD

### Phase 4: Evaluator Workflow Migration

**Goal**: Evaluator workflow reads Profile and Pipeline from NocoDB, writes scores and interview prep back, triggers High Fit alerts
**Depends on**: Phase 2 (needs Profile and Pipeline data in NocoDB)
**Requirements**: EVAL-01, EVAL-02
**Success Criteria** (what must be TRUE):

  1. Evaluator reads Profile record and Pipeline records with Status="New" from NocoDB
  2. AI fit scores (1-10), matched/missing skills, and interview prep are written back to Pipeline records in NocoDB
  3. High Fit email alerts trigger correctly for 8+ score jobs read from NocoDB Pipeline records
  4. Output Pipeline records match pre-migration (same scores, same reasoning, same interview questions)

**Plans**: TBD

### Phase 5: Tailor Workflow & Attachments Migration

**Goal**: Tailor workflow reads from NocoDB, generates CVs, and uploads DOCX attachments via NocoDB storage API
**Depends on**: Phase 4 (needs Evaluated/High Fit Pipeline records from NocoDB)
**Requirements**: TAIL-01, TAIL-02, TAIL-03
**Success Criteria** (what must be TRUE):

  1. Tailor reads Profile and Pipeline records (Status="Evaluated", High Fit) from NocoDB
  2. CV markdown generation and DOCX rendering produce identical output to pre-migration
  3. CV DOCX uploads successfully via `POST /api/v2/storage/upload` and the response array is stored in the Pipeline record's attachment field
  4. CV attachment is visible, previewable, and downloadable from the NocoDB Pipeline record UI

**Plans**: TBD

### Phase 6: Housekeeper & Alerter Migration

**Goal**: Housekeeper and Alerter workflows operate on NocoDB data for archiving, cleanup, and daily digests
**Depends on**: Phase 2 (needs data in NocoDB for housekeeping operations)
**Requirements**: MAINT-01, MAINT-02
**Success Criteria** (what must be TRUE):

  1. Housekeeper archives stale Low Fit records (>7d), closes ghosted Applied records (>30d), and alerts on stuck New records (>3d) — all against NocoDB Pipeline table
  2. Alerter reads pipeline stats from NocoDB and produces the daily digest email with correct counts and job cards
  3. Housekeeping and alerting behavior matches pre-migration (same records affected, same alerts sent)

**Plans**: TBD

### Phase 7: Documentation

**Goal**: All project documentation reflects NocoDB as the database backend with no outdated Airtable references
**Depends on**: Phase 3, Phase 4, Phase 5, Phase 6 (all migration work complete before documenting)
**Requirements**: DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, DOC-06
**Success Criteria** (what must be TRUE):

  1. SETUP.md guides user through NocoDB Docker setup, bootstrap script execution, and workflow import — replaces all Airtable setup steps
  2. `docs/NOCODB-SCHEMA.md` documents all 4 tables with field types, relationships, and sample values
  3. README architecture diagrams show NocoDB replacing Airtable; badges and tech stack table updated
  4. COST-GUIDE.md, CUSTOMIZATION.md updated with NocoDB equivalents; AIRTABLE-SCHEMA.md has deprecation notice pointing to NOCODB-SCHEMA.md

**Plans**: TBD

### Phase 8: Verification & Cleanup

**Goal**: All 8 workflows execute end-to-end against NocoDB with identical output; Airtable references deprecated
**Depends on**: Phase 7 (documentation reflects current state)
**Requirements**: VER-01, VER-02, VER-03, VER-04
**Success Criteria** (what must be TRUE):

  1. All 8 workflows execute end-to-end against NocoDB producing identical output (same job scores, same CVs, same email alerts) as the pre-migration Airtable-based run
  2. Bootstrap script works on a clean NocoDB deployment — one command creates all tables, import workflows, system runs immediately
  3. CV DOCX attachment is visible and downloadable from NocoDB Pipeline record
  4. Airtable-specific files deprecated/removed; no functional references to Airtable remain in workflow configurations

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infrastructure & Bootstrap | 3/4 | In Progress|  |
| 2. Data Migration | 0/0 | Not started | - |
| 3. Scanner Workflows Migration | 0/0 | Not started | - |
| 4. Evaluator Workflow Migration | 0/0 | Not started | - |
| 5. Tailor Workflow & Attachments | 0/0 | Not started | - |
| 6. Housekeeper & Alerter Migration | 0/0 | Not started | - |
| 7. Documentation | 0/0 | Not started | - |
| 8. Verification & Cleanup | 0/0 | Not started | - |
