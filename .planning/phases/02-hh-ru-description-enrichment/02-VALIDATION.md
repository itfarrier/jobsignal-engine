---
phase: 2
slug: hh-ru-description-enrichment
status: valid
nyquist_compliant: true
wave_0_complete: true
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
| **Full suite command** | `node scripts/test_hh_rss_parse.mjs && node scripts/test_hh_vacancy_parse.mjs && node scripts/test_hh_workflow_json.mjs && node scripts/test_hh_docs_presence.mjs` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node scripts/test_hh_vacancy_parse.mjs`
- **After every plan wave:** Run `node scripts/test_hh_rss_parse.mjs && node scripts/test_hh_vacancy_parse.mjs`
- **Before `/gsd-verify-work`:** Full suite (all 4 test scripts) must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | HH-10 | T-02-01 | RED: test script fails before implementation | unit | `node scripts/test_hh_vacancy_parse.mjs; test $? -ne 0` | ✅ test_hh_vacancy_parse.mjs | ✅ green |
| 02-01-02 | 01 | 1 | HH-10 | T-02-01 | stripHtml + JSON-LD/data-qa extraction + RSS fallback | unit | `node scripts/test_hh_vacancy_parse.mjs` | ✅ test_hh_vacancy_parse.mjs | ✅ green |
| 02-02-01 | 02 | 2 | HH-10 | T-02-03 | Loop Over Jobs + 1s inter-fetch wait wired | unit | `node scripts/test_hh_workflow_json.mjs` | ✅ scripts/test_hh_workflow_json.mjs | ✅ green |
| 02-02-02 | 02 | 2 | HH-10 | T-02-01 / T-02-02 | Merge Descriptions + applyLink whitelist in jsCode | unit | `node scripts/test_hh_workflow_json.mjs` | ✅ scripts/test_hh_workflow_json.mjs | ✅ green |
| 02-02-03 | 02 | 2 | HH-10 | n/a | SETUP.md references test_hh_vacancy_parse.mjs + pre-flight section | unit | `node scripts/test_hh_docs_presence.mjs` | ✅ scripts/test_hh_docs_presence.mjs | ✅ green |
| 02-04-01 | 04 | 2 | HH-10 | T-02-04-01 | Fetch Vacancy Page has followRedirect + Accept-Language + alwaysOutputData | unit | `node scripts/test_hh_workflow_json.mjs` | ✅ scripts/test_hh_workflow_json.mjs | ✅ green |
| 02-04-02 | 04 | 2 | HH-10 | T-02-04-02 | Merge Descriptions: _fetchHtmlBytes, _fetchStatus, _fetchHint diagnostics | unit | `node scripts/test_hh_workflow_json.mjs` | ✅ scripts/test_hh_workflow_json.mjs | ✅ green |
| 02-04-03 | 04 | 2 | HH-10 | T-02-04-04 | Merge Descriptions: extractVacancyDescriptionHtml + stripHtml + 50k truncation | unit | `node scripts/test_hh_workflow_json.mjs` | ✅ scripts/test_hh_workflow_json.mjs | ✅ green |
| 02-05-01 | 05 | 2 | HH-10 | T-02-05-01 | SETUP.md has 01e pre-flight checklist with schema refresh + AIRTABLE link | unit | `node scripts/test_hh_docs_presence.mjs` | ✅ scripts/test_hh_docs_presence.mjs | ✅ green |
| 02-05-02 | 05 | 2 | HH-10 | n/a | AIRTABLE-SCHEMA.md has Source=LinkedIn troubleshooting | unit | `node scripts/test_hh_docs_presence.mjs` | ✅ scripts/test_hh_docs_presence.mjs | ✅ green |
| 02-05-03 | 05 | 2 | HH-10 | n/a | Docs cross-link: SETUP.md ↔ AIRTABLE-SCHEMA.md | unit | `node scripts/test_hh_docs_presence.mjs` | ✅ scripts/test_hh_docs_presence.mjs | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `fixtures/hh-vacancy-page-sample.html` — anonymized excerpt with JSON-LD + `data-qa="vacancy-description"`
- [x] `scripts/test_hh_vacancy_parse.mjs` — exports `extractVacancyDescriptionHtml`, `stripHtml`, assertions vs fixture
- [x] `scripts/test_hh_workflow_json.mjs` — validates 01e workflow JSON structure (8 checks)
- [x] `scripts/test_hh_docs_presence.mjs` — validates documentation cross-references
- [x] Workflow nodes: `Loop Over Jobs`, `Fetch Vacancy Page`, `Merge Descriptions`, `Wait 1s Vacancy`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pipeline row has enriched Job Description | HH-10 | Requires live n8n + Airtable | Execute 01e on feed with new vacancy; inspect Pipeline `Job Description` length > RSS summary |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending — requires manual UAT verification (n8n pipeline) before final sign-off
