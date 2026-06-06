# Roadmap: JobSignal Engine

## Milestones

- ✅ **v1.0 hh.ru Scanner** — Phase 1 (shipped 2026-06-05)
- ✅ **v2.0 hh.ru Description Enrichment** — Phase 2 (shipped 2026-06-06)

## Phases

<details>
<summary>✅ v1.0 hh.ru Scanner (Phase 1) — SHIPPED 2026-06-05</summary>

- [x] **Phase 1: hh.ru RSS Scanner** — Ship `workflows/01e-scanner-hhru.json` with Profile-driven feeds, Search Queries overrides, geography extensions, and Pipeline writes (completed 2026-06-05)

**Plans:** 2/2 complete

- [x] 01-01 — Airtable schema docs: RU geographies, HH RSS columns, Pipeline Source `hh.ru`
- [x] 01-02 — `01e-scanner-hhru.json` workflow, parse fixture/script, SETUP.md

</details>

<details>
<summary>✅ v2.0 hh.ru Description Enrichment (Phase 2) — SHIPPED 2026-06-06</summary>

- [x] **Phase 2: hh.ru Full Description Enrichment** — Enrich net-new hh.ru Pipeline jobs with full vacancy page text so the 9:00 Evaluator receives complete job descriptions instead of thin RSS summaries (completed 2026-06-06)

**Plans:** 5/5 complete

**Wave 1**
- [x] 02-01-PLAN.md — TDD: vacancy page fixture, extractVacancyDescriptionHtml, stripHtml, mergeVacancyDescription tests

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 02-02-PLAN.md — Wire Loop Over Jobs + Fetch + Merge into 01e; SETUP verification docs

**Gap closure** *(UAT failures — executed 2026-06-06)*
- [x] 02-03-PLAN.md — Remove RSS test debug JSON stdout (UAT test 2)
- [x] 02-04-PLAN.md — Harden Fetch/Merge enrichment path (UAT test 3 enrichment)
- [x] 02-05-PLAN.md — Airtable pre-flight docs + troubleshooting (UAT test 3 Airtable)

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. hh.ru RSS Scanner | v1.0 | 2/2 | Complete | 2026-06-05 |
| 2. hh.ru Full Description Enrichment | v2.0 | 5/5 | Complete | 2026-06-06 |
