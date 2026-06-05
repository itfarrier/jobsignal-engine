---
phase: 2
slug: hh-ru-description-enrichment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-05
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js builtins (no test runner) |
| **Config file** | none |
| **Quick run command** | `node scripts/test_hh_vacancy_parse.mjs` |
| **Full suite command** | `node scripts/test_hh_rss_parse.mjs && node scripts/test_hh_vacancy_parse.mjs` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node scripts/test_hh_vacancy_parse.mjs`
- **After every plan wave:** Run `node scripts/test_hh_rss_parse.mjs && node scripts/test_hh_vacancy_parse.mjs`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | HH-10 | T-02-01 | RED: test script fails before implementation | unit | `node scripts/test_hh_vacancy_parse.mjs; test $? -ne 0` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | HH-10 | T-02-01 | stripHtml + JSON-LD/data-qa extraction + RSS fallback | unit | `node scripts/test_hh_vacancy_parse.mjs` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | HH-10 | T-02-03 | Loop Over Jobs + 1s inter-fetch wait wired | unit | `python3 -m json.tool workflows/01e-scanner-hhru.json` + grep | ✅ workflow | ⬜ pending |
| 02-02-02 | 02 | 2 | HH-10 | T-02-01 / T-02-02 | Merge Descriptions + applyLink whitelist in jsCode | unit | `node scripts/test_hh_vacancy_parse.mjs` + grep | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `fixtures/hh-vacancy-page-sample.html` — anonymized excerpt with JSON-LD + `data-qa="vacancy-description"`
- [ ] `scripts/test_hh_vacancy_parse.mjs` — exports `extractVacancyDescriptionHtml`, `stripHtml`, assertions vs fixture
- [ ] Workflow nodes: `Loop Over Jobs`, `Fetch Vacancy Page`, `Merge Descriptions`, `Wait 1s Vacancy`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pipeline row has enriched Job Description | HH-10 | Requires live n8n + Airtable | Execute 01e on feed with new vacancy; inspect Pipeline `Job Description` length > RSS summary |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
