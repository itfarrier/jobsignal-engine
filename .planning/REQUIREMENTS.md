# Requirements: JobSignal Engine — hh.ru Scanner

**Defined:** 2026-06-05
**Core Value:** Every morning, relevant new jobs land in Airtable already deduplicated and ready for AI scoring — including roles from hh.ru that match your skills, roles, and geography.

## v1 Requirements

### hh.ru RSS Scanner

- [ ] **HH-01**: n8n workflow `workflows/01e-scanner-hhru.json` discovers vacancies via public hh.ru RSS (`/search/vacancy/rss`) — no OAuth / employer API
- [ ] **HH-02**: Auto-build RSS feeds from Profile (`Target Roles`, `Core Skills`, `Target Geography`) — one feed per role, bilingual `text=` where Profile is mixed RU/EN, cap ~8 auto feeds
- [ ] **HH-03**: Merge enabled **Search Queries** rows with `Source Type = HH RSS` (override / extra queries); `Location` field stores hh `area` ID when set, else derive from Profile
- [ ] **HH-04**: Parse RSS items (title, link, company, region, salary from description HTML); post-filter by Profile geography substrings (Russian + English); optional per-query **Title Keywords**; no extra Russian negative-filter logic in scanner
- [ ] **HH-05**: Write net-new jobs to Pipeline with `source: hh.ru`, `jobId` suffix `-hhr`, same dedup / create pattern as 1d; schedule daily **8:20** + manual trigger
- [ ] **HH-06**: v1 uses RSS summary as `Job Description`; public vacancy-page scrape deferred to a later phase
- [ ] **HH-07**: Extend **Target Geography** in Airtable schema/docs and scanner `GEO_MAP`: Russia (`113`), Moscow (`1`), Saint Petersburg (`2`), Remote Russia; sync schema doc with geographies already in 1a–1c code
- [ ] **HH-08**: Document Search Queries **HH RSS** column usage; add `hh.ru` to Pipeline **Source** single-select options
- [ ] **HH-09**: Skip auto hh feeds when Profile has no RU-relevant geography (manual HH RSS Search Queries may still run)

## v2 Requirements

### hh.ru Enhancements

- **HH-10**: Fetch full vacancy description from public vacancy HTML page (post-RSS enrichment)
- **HH-11**: Read Profile `Target Geography` dynamically in JobSpy 1d parse node (existing TODO in 01d)

## Out of Scope

| Feature | Reason |
|---------|--------|
| HeadHunter authenticated API (`hhru/api`) | User cannot obtain credentials; API docs reference-only for area IDs |
| Browser automation / auto-apply (hh.ru-parser) | Different product surface; apply remains manual |
| hh.ru employer-only or application APIs | Not needed for discovery |
| Evaluator / Tailor / Housekeeper / Alerter changes | Accept `hh.ru` Source only; no behavior changes |
| Workflow 5 Optimizer | Pre-existing roadmap item, not this milestone |
| Russian negative-filter heuristics in scanner | User preference; Evaluator enforces Profile `Negative Filters` |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| HH-01 | Phase 1 | Pending |
| HH-02 | Phase 1 | Pending |
| HH-03 | Phase 1 | Pending |
| HH-04 | Phase 1 | Pending |
| HH-05 | Phase 1 | Pending |
| HH-06 | Phase 1 | Pending |
| HH-07 | Phase 1 | Pending |
| HH-08 | Phase 1 | Pending |
| HH-09 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-05*
*Last updated: 2026-06-05 after roadmap creation*
