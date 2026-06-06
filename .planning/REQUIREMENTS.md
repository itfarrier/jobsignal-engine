# Requirements: JobSignal Engine

**Defined:** 2026-06-07
**Core Value:** Every morning, relevant new jobs land in Airtable already deduplicated and ready for AI scoring — including roles from hh.ru that match your skills, roles, and geography — so you spend time applying to good fits, not searching job boards.

## v2.1 Requirements

Requirements for 01e coverage improvement. Each maps to roadmap phases.

### Baseline Diagnosis

- [ ] **HH-12**: Establish baseline metrics for current 01e vacancy volume — feeds generated, items per feed, items after geography filter, items after dedup, net-new Pipeline records per run using execution logging only (zero code changes)

### Feed Diversity Implementation

- [ ] **HH-13-01**: Modify `Build Feed List` node to generate multiple feeds per role — sub-areas (Moscow=1, SPb=2, Russia=113), RU/EN query synonyms, experience-split feeds, professional_role ID feeds, work format split, with 40-feed hard cap and priority scoring
- [ ] **HH-13-02**: Modify `Parse & Filter Jobs` node to pass through feedMeta diagnostics and add run-scoped dedup cache to skip duplicate vacancy fetches
- [ ] **HH-13-03**: Fix Cyrillic encoding — extend stripHtml to decode numeric HTML entities, add String.normalize('NFC') to FNV-1a hasher
- [ ] **HH-13-04**: Adjust safety brake threshold to 300–500 for hh.ru, make configurable
- [ ] **HH-13-05**: Increase vacancy fetch delay from 1s to 3–5s with random jitter; add 429/403 response monitoring with RSS-only fallback mode
- [ ] **HH-13-06**: Adjust 01e schedule to 7:30 AM to avoid execution timeout collision with Evaluator at 9:00

### Verification

- [ ] **HH-14**: Compare post-implementation metrics against HH-12 baseline — marginal yield per feed, overlap ratio (<30% target), Cyrillic rendering spot-check, execution time verification, 7-day 429/403 monitoring

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

- **HH-11**: Read Profile `Target Geography` dynamically in JobSpy 1d parse node (deferred from v1.0)
- Workflow 5 Optimizer (pre-existing roadmap item — closed-loop scoring analytics)
- Full sub-area expansion beyond Moscow/SPb (10+ Russian cities) — low marginal yield vs complexity
- Shadow Ledger audit trail
- No-code Airtable setup via importable template workflow

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Paid scrapers / Apify actors for hh.ru | Violates $0 marginal cost constraint; RSS is free |
| Browser automation (Playwright/Puppeteer) | Out of scope per PROJECT.md; different product surface |
| HeadHunter authenticated API | User cannot obtain API credentials |
| Full sub-area expansion beyond Moscow/SPb | Lower marginal yield; Moscow/SPb capture majority of IT jobs |
| JobSpy geography fix (HH-11) | Separate issue affecting 01d, not 01e |
| Workflow 5 Optimizer | Pre-existing roadmap item, not this milestone |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| HH-12 | Phase 3 | Pending |
| HH-13-01 | Phase 4 | Pending |
| HH-13-02 | Phase 4 | Pending |
| HH-13-03 | Phase 4 | Pending |
| HH-13-04 | Phase 4 | Pending |
| HH-13-05 | Phase 4 | Pending |
| HH-13-06 | Phase 4 | Pending |
| HH-14 | Phase 5 | Pending |

**Coverage:**
- v2.1 requirements: 8 total
- Mapped to phases: 8
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-07*
*Last updated: 2026-06-07 after initial definition*
