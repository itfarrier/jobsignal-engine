# Roadmap: JobSignal Engine — hh.ru Scanner

## Overview

Add hh.ru as a fifth discovery source for the Russian job market. Phase 1 delivers the full RSS-based scanner workflow (`01e`), Airtable schema/docs updates, and integration with the existing Pipeline → Evaluator path. No HeadHunter API auth; public RSS only in v1.

## Milestones

- 🚧 **v1.0 hh.ru Scanner** — Phase 1 (in progress)

## Phases

- [ ] **Phase 1: hh.ru RSS Scanner** — Ship `workflows/01e-scanner-hhru.json` with Profile-driven feeds, Search Queries overrides, geography extensions, and Pipeline writes

## Phase Details

### Phase 1: hh.ru RSS Scanner
**Goal**: Daily hh.ru vacancy discovery via public RSS feeds, writing deduplicated net-new jobs to Airtable Pipeline with `source: hh.ru`, ready for the existing 9:00 Evaluator run.
**Depends on**: Nothing (brownfield extension of shipped 1a–1d scanners)
**Requirements**: HH-01, HH-02, HH-03, HH-04, HH-05, HH-06, HH-07, HH-08, HH-09
**Canonical refs**: `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `airtable/AIRTABLE-SCHEMA.md`, `workflows/01d-scanner-jobspy.json`, `workflows/01a-scanner-greenhouse.json`
**Success Criteria** (what must be TRUE):
  1. Manual or scheduled (8:20) run of `01e` fetches hh.ru RSS feeds and creates net-new Pipeline records with `source: hh.ru` and `-hhr` job IDs
  2. Profile `Target Roles` auto-generate up to ~8 RSS feeds when RU-relevant geography is set; run skips auto feeds when none
  3. Enabled Search Queries with `Source Type = HH RSS` merge with Profile feeds and respect per-query `Location` (area ID) and Title Keywords
  4. Parsed jobs include title, company, region, salary (when in RSS description), apply link, and RSS summary as Job Description
  5. Airtable schema docs list RU geography options and HH RSS Search Query columns; Pipeline Source includes `hh.ru`
**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md — Airtable schema docs: RU geographies, HH RSS columns, Pipeline Source `hh.ru` (HH-07, HH-08)
- [ ] 01-02-PLAN.md — `01e-scanner-hhru.json` workflow, parse fixture/script, SETUP.md (HH-01–HH-06, HH-09)

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. hh.ru RSS Scanner | 0/2 | Not started | - |
