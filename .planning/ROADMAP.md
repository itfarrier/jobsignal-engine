# Roadmap: JobSignal Engine

## Milestones

- ✅ **v1.0 hh.ru Scanner** — Phase 1 (shipped 2026-06-05)
- 🚧 **v2.0 hh.ru Description Enrichment** — Phase 2 (in progress)

## Phases

<details>
<summary>✅ v1.0 hh.ru Scanner (Phase 1) — SHIPPED 2026-06-05</summary>

- [x] **Phase 1: hh.ru RSS Scanner** — Ship `workflows/01e-scanner-hhru.json` with Profile-driven feeds, Search Queries overrides, geography extensions, and Pipeline writes (completed 2026-06-05)

**Plans:** 2/2 complete

- [x] 01-01 — Airtable schema docs: RU geographies, HH RSS columns, Pipeline Source `hh.ru`
- [x] 01-02 — `01e-scanner-hhru.json` workflow, parse fixture/script, SETUP.md

</details>

### Phase 2: hh.ru Full Description Enrichment

**Goal**: Enrich net-new hh.ru Pipeline jobs with full vacancy page text so the 9:00 Evaluator receives complete job descriptions instead of thin RSS summaries.
**Depends on**: Phase 1 (shipped `01e` RSS scanner)
**Requirements**: HH-10
**Canonical refs**: `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `workflows/01e-scanner-hhru.json`, `workflows/01a-scanner-greenhouse.json` (Fetch Job Detail + Merge Descriptions pattern), `airtable/AIRTABLE-SCHEMA.md`
**Success Criteria** (what must be TRUE):

1. `01e` fetches each net-new vacancy's public HTML page via the RSS `link` URL and writes a stripped full description to Pipeline `Job Description`
2. When page fetch or parse fails, the job still lands in Pipeline with the RSS summary as fallback (no silent drops)
3. Rate limiting preserved: wait between page fetches; existing 8:20 schedule and 100 net-new safety brake unchanged
4. No HeadHunter API auth; no Evaluator/Tailor workflow changes required

**Plans**: 2 plans

Plans:
- [ ] 02-01-PLAN.md — TDD: vacancy page fixture, extractVacancyDescriptionHtml, stripHtml, mergeVacancyDescription tests
- [ ] 02-02-PLAN.md — Wire Loop Over Jobs + Fetch + Merge into 01e; SETUP verification docs

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. hh.ru RSS Scanner | 2/2 | Complete | 2026-06-05 |
| 2. hh.ru Full Description Enrichment | 0/2 | Not started | — |
