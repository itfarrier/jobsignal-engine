# Requirements: JobSignal Engine — hh.ru Description Enrichment

**Defined:** 2026-06-05
**Milestone:** v2.0 hh.ru Description Enrichment
**Core Value:** Every morning, relevant new jobs land in Airtable already deduplicated and ready for AI scoring — with full job descriptions for hh.ru vacancies so the Evaluator can score accurately.

## v2.0 Requirements

### hh.ru Full Description

- [x] **HH-10**: After RSS discovery in `01e`, fetch the public vacancy HTML page for each net-new job and replace the thin RSS summary with a stripped full description before writing to Pipeline

## Future Requirements

### hh.ru / JobSpy Enhancements

- **HH-11**: Read Profile `Target Geography` dynamically in JobSpy `01d` parse node (existing TODO in 01d) — deferred to a later milestone

## Out of Scope

| Feature | Reason |
|---------|--------|
| HeadHunter authenticated API (`hh.ru/api`) | User cannot obtain credentials; public HTML only |
| Browser automation / Playwright scraping | Complexity, maintenance, and ToS risk; HTTP + HTML parse sufficient |
| Retroactive backfill of existing Pipeline `hh.ru` rows | New-discovery enrichment only in v2.0; backfill is a separate operator task if needed |
| Evaluator / Tailor / Housekeeper / Alerter changes | Consume richer `Job Description` as-is; no workflow changes |
| HH-11 JobSpy geography dynamic read | Explicitly deferred — not in v2.0 milestone |
| Russian negative-filter heuristics in scanner | User preference; Evaluator enforces Profile `Negative Filters` |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| HH-10 | Phase 2 | Complete |

**Coverage:**

- v2.0 requirements: 1 total
- Mapped to phases: 1
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-05*
*Last updated: 2026-06-05 after roadmap creation*
