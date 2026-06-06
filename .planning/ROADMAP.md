# Roadmap: JobSignal Engine

## Milestones

- ✅ **v1.0 hh.ru Scanner** — Phase 1 (shipped 2026-06-05)
- ✅ **v2.0 hh.ru Description Enrichment** — Phase 2 (shipped 2026-06-06)
- 🚧 **v2.1 01e Coverage Improvement** — Phases 3–5 (in progress)

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

### 🚧 v2.1 01e Coverage Improvement (In Progress)

**Milestone Goal:** Improve the hh.ru RSS scanner (01e) to discover 3-10× more vacancies per run through feed diversity, query optimization, and safety/encoding hardening — verified against a measured baseline.

- [ ] **Phase 3: Baseline Diagnosis** — Run 01e once with execution logging to measure current vacancy volume (feeds, items, dedup, net-new) — zero code changes
- [ ] **Phase 4: Feed Diversity Implementation** — Modify Build Feed List and Parse & Filter Jobs nodes; sub-area feeds, query variants, professional_role IDs, experience/work splits, safety/encoding fixes, schedule change
- [ ] **Phase 5: Verification** — Compare post-implementation metrics against baseline; measure marginal yield, overlap ratio, encoding quality, execution time, 7-day 429 monitoring

## Phase Details

### Phase 3: Baseline Diagnosis
**Goal**: Establish baseline vacancy volume metrics for current 01e scanner operation — feeds generated, items per feed, items after geography filter, items after dedup, net-new Pipeline records — using execution logging only (zero code changes)
**Depends on**: Nothing (first phase of v2.1)
**Requirements**: HH-12
**Success Criteria** (what must be TRUE):
  1. User can see execution log output showing feeds generated count, items per feed, items after geography filter, items after dedup, and net-new Pipeline records for a single 01e run
  2. Baseline metrics confirm the known ~160 raw items ceiling, documenting each loss stage from feed generation through Pipeline write
  3. Baseline data is recorded/exported in a form usable as before-measure in Phase 5 comparison
  4. No workflow files (.json) were modified — only execution logging and metric recording
**Plans**: TBD

### Phase 4: Feed Diversity Implementation
**Goal**: 01e scanner discovers 3-10× more vacancies through multi-feed parallelization (sub-areas, EN/RU query synonyms, experience splits, professional_role IDs, work format splits), with safety/encoding/delay hardening
**Depends on**: Phase 3
**Requirements**: HH-13-01, HH-13-02, HH-13-03, HH-13-04, HH-13-05, HH-13-06
**Success Criteria** (what must be TRUE):
  1. Build Feed List node generates up to 40 feeds per run with sub-area variants (Moscow=1, SPb=2, Russia=113), RU/EN query synonyms, experience splits (junior/mid/senior), professional_role IDs, and work format splits (remote/in-office), prioritized by scoring
  2. Parse & Filter Jobs node passes through feedMeta diagnostics (area, experience, role_id, query variant) and skips duplicate vacancy fetches via run-scoped dedup cache on applyLink
  3. Cyrillic vacancy titles and descriptions render correctly in Pipeline — no `&#XXXX;` numeric entity codes, and FNV-1a hashing produces consistent hashes for identical Cyrillic titles (NFC normalization applied)
  4. Safety brake triggers at configurable threshold (cap raised to 300-500 for hh.ru) instead of hard 100, configurable per source
  5. Vacancy page fetches use 3-5s delay with random jitter; 429/403 responses are detected and trigger RSS-only fallback mode for remaining unfetched vacancies
  6. 01e schedule adjusted to 7:30 AM and completes within its time window before Evaluator at 9:00
**Plans**: TBD

### Phase 5: Verification
**Goal**: Quantitatively verify coverage improvement against established HH-12 baseline — compare metrics, measure marginal yield per feed, validate overlap ratio, spot-check encoding, confirm execution timing and zero 429/403 errors over 7 days
**Depends on**: Phase 4
**Requirements**: HH-14
**Success Criteria** (what must be TRUE):
  1. User can see side-by-side comparison of baseline vs post-implementation metrics: feeds generated, items per feed, items after geography filter, items after dedup, net-new Pipeline records per run
  2. Marginal yield per feed is measurable (unique new jobs contributed by each feed variant), enabling data-driven feed pruning
  3. Cross-feed overlap ratio is <30% (feeds return substantially different vacancy sets rather than the same 20 items repeatedly)
  4. Cyrillic text in Pipeline records renders correctly when spot-checked (no `&#XXXX;` artifacts, no hash mismatches causing duplicate Pipeline rows)
  5. Execution completes within 60% of n8n timeout; zero 429/403 errors in execution logs over 7-day monitoring window
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. hh.ru RSS Scanner | v1.0 | 2/2 | Complete | 2026-06-05 |
| 2. hh.ru Full Description Enrichment | v2.0 | 5/5 | Complete | 2026-06-06 |
| 3. Baseline Diagnosis | v2.1 | 0/0 | Not started | - |
| 4. Feed Diversity Implementation | v2.1 | 0/0 | Not started | - |
| 5. Verification | v2.1 | 0/0 | Not started | - |
