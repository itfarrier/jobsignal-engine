# JobSignal Engine

## What This Is

An autonomous job search pipeline that scans 139+ company career pages daily, AI-scores every role against your profile (1-10), generates tailored CVs as DOCX files, preps interview questions and STAR responses, and emails you daily digests — all running unattended on a schedule via n8n workflows with Airtable as the source of truth.

Currently being migrated from Airtable to NocoDB as the backend database, eliminating the external dependency on Airtable's free-tier record limits and enabling fully self-hosted operation.

## Core Value

Discover, score, and prep every relevant job opportunity without manual effort — so the user only needs to review and apply.

## Requirements

### Validated

- ✓ **Multi-source job scanning** — Greenhouse, Ashby, and Lever API scanners discover jobs from 139+ verified companies daily — existing
- ✓ **JobSpy sidecar scanning** — LinkedIn and Indeed scraping via Python Flask sidecar (self-hosted only) — existing
- ✓ **AI fit scoring** — Every job scored 1-10 against user profile with detailed reasoning, matched/missing skills — existing
- ✓ **Interview prep generation** — 15 tailored questions + 5 STAR responses per High Fit job — existing
- ✓ **CV tailoring via AI** — AI rewrites CV per job description with markdown output — existing
- ✓ **DOCX CV rendering** — Python sidecar converts markdown CV to DOCX format — existing
- ✓ **High Fit email alerts** — Instant email when 8+ score job is found — existing
- ✓ **Daily digest email** — Evening summary with pipeline stats and job cards — existing
- ✓ **Auto-housekeeping** — Archive stale Low Fit (>7d), close ghosted Applied (>30d), alert stuck New (>3d) — existing
- ✓ **Cost tracking** — Every AI call logs exact token cost per job record — existing
- ✓ **Provider-agnostic AI** — Any OpenAI-compatible provider via single credential swap — existing
- ✓ **Dynamic geography filtering** — Filter by country/region from Profile, no code changes — existing
- ✓ **Deduplication via FNV-1a hash** — Same job from multiple sources = one Pipeline record — existing
- ✓ **Airtable bootstrap script** — `scripts/airtable_bootstrap.py` schema-as-code setup with `airtable/schema.json` — existing
- ✓ **Scanner workflows on NocoDB** — All 4 scanner workflows (Greenhouse, Ashby, Lever, JobSpy) use NocoDB HTTP Request nodes; 16 HTTP nodes + 11 Unwrap Code nodes deployed — Phase 3

### Active

- [ ] **MIGR-01**: Deploy NocoDB as Docker service alongside existing stack with PostgreSQL backend
- [ ] **MIGR-02**: Migrate Airtable schema (4 tables) to NocoDB — Profile, Tracked Companies, Pipeline, Search Queries
- [ ] **MIGR-03**: Migrate existing Airtable data to NocoDB via import or bootstrap script
- [/] **MIGR-04**: Replace Airtable nodes in all 8 n8n workflows with NocoDB nodes or HTTP Request nodes (4/8 done — scanner workflows 1a-1d complete)
- [ ] **MIGR-05**: Adapt CV attachment workflow to use NocoDB's storage/upload API instead of Airtable attachment fields
- [ ] **MIGR-06**: Update docker-compose.example.yml to include NocoDB service
- [ ] **MIGR-07**: Update documentation (SETUP.md, AIRTABLE-SCHEMA.md, README architecture diagrams, costs)
- [ ] **MIGR-08**: Create NocoDB bootstrap script (replacing airtable_bootstrap.py)
- [ ] **MIGR-09**: Remove or deprecate Airtable-specific files and references
- [ ] **MIGR-10**: End-to-end verification of all 8 workflows against NocoDB

### Out of Scope

- **Structural workflow changes** — The n8n workflow logic, prompts, schedules, and pipeline flow remain unchanged. Only the database backend is swapped
- **JobSpy replacement** — The scraping sidecar pattern stays
- **AI provider changes** — Not changing how AI routing works
- **UI/frontend** — NocoDB provides its own spreadsheet UI; no custom frontend
- **Multi-user support** — Remains single-user pipeline
- **Performance optimization** — Not addressing the sequential pipeline timing or Airtable rate-limit issues (these are existing tech debt tracked in codebase/CONCERNS.md)

## Current State

Phase 1-3 complete. NocoDB infrastructure deployed, schema and data imported, 4 scanner workflows migrated. Next: evaluator (02), tailor (03), housekeeper (04), alerter (06) workflow migrations.

## Context

This is an existing production system built and used by the developer for their own job search. The codebase has 8 n8n workflow JSON files, 3 Python scripts (CV renderer, JobSpy service, render library), Docker Compose infrastructure (n8n, PostgreSQL, Caddy), and Airtable as database.

The migration to NocoDB is motivated by:
- Airtable free tier caps at 1,000 records per base — tight for active job searches
- Desire for fully self-hosted stack with no external database dependency
- Open-source commitment — NocoDB is Apache-licensed
- NocoDB has native n8n integration and REST API v3 for programmatic access

Research findings from codebase analysis:
- Airtable base ID `appE808oZ5gTSQzUY` and table IDs are hardcoded across all 8 workflows (identified as tech debt in CONCERNS.md)
- Airtable credentials are hardened into workflow JSON credential references
- The Airtable schema is already documented as code in `airtable/schema.json` with a bootstrap script
- NocoDB supports attachment fields with a two-step upload API: `POST /api/v2/storage/upload` → array in attachment field

## Constraints

- **Backend**: NocoDB will run alongside existing Docker Compose stack with its own PostgreSQL database (separate from n8n's Postgres)
- **Attachments**: Use NocoDB's native storage (local Docker volume) — no MinIO/S3 required for single-node deployment
- **Migration**: Cutover approach — set up NocoDB, import data, update workflows, remove Airtable
- **Compatibility**: All 8 workflows must produce identical output after migration (same job scoring, same CV generation, same alerts)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| NocoDB native attachments | No extra services needed; NocoDB stores files in its Docker volume; full attachment UI support | — Pending |
| Cutover migration | Cleanest approach; no dual-write complexity; Airtable can be kept as read-only fallback briefly | — Pending |
| NocoDB in docker-compose | Simplest deployment; shares network with n8n and sidecars; consistent with existing infra | — Pending |
| Replace Airtable nodes in-place | Each Airtable node in workflows gets replaced by NocoDB or HTTP Request node without changing workflow structure | — Pending |
| Unwrap Code nodes after each GET | NocoDB Data API v3 returns `{ records: [...] }` — Code node unwraps to flat items for downstream compatibility | ✓ Validated in Phase 3 |
| Code nodes reference Unwrap, not HTTP | Code/Set nodes referencing `$('Get X')` must use `$('Unwrap X')` instead to get flat items, not raw NocoDB response | ✓ Discovered via code review in Phase 3 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-10 after Phase 3 completion*
