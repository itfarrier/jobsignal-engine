---
phase: 02
slug: data-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-10
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification (data migration — no code to unit test) |
| **Config file** | none |
| **Quick run command** | `python scripts/nocodb_bootstrap.py --password <pwd> --workspace-only` |
| **Full suite command** | Quick run + import in NocoDB UI + verification checks |
| **Estimated runtime** | ~15 minutes (mostly human verification time) |

---

## Sampling Rate

- **After every task commit:** Run quick bootstrap test
- **After every plan wave:** Run full suite (import + verify)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~900 seconds (human verification is the bottleneck)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | DATA-01 | T-02-01 / — | PAT scoped to `data.records:read` only | manual | `python scripts/nocodb_bootstrap.py --password test123 --workspace-only` | ✅ nocodb_bootstrap.py | ⬜ pending |
| 02-01-02 | 01 | 1 | DATA-01 | — | Import runs over HTTPS | manual | Trigger import in NocoDB UI. Verify 4 tables exist with data. | ❌ W0 | ⬜ pending |
| 02-02-01 | 01 | 1 | DATA-02 | — | N/A | manual | curl + jq to NocoDB Data API for record counts | ❌ W0 | ⬜ pending |
| 02-02-02 | 01 | 1 | DATA-02 | — | N/A | manual | Open NocoDB UI + Airtable UI side-by-side. Verify random records. | ❌ W0 | ⬜ pending |
| 02-02-03 | 01 | 1 | DATA-02 | T-02-01 | Shared URL has random shr_ token | manual | Use NocoDB API to retrieve Profile row, compare to Airtable | ❌ W0 | ⬜ pending |
| 02-02-04 | 01 | 1 | DATA-02 | — | N/A | manual | Find Pipeline record with Tailored CV in Airtable. Verify in NocoDB. | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/nocodb_bootstrap.py` — add `--workspace-only` flag

*All verification is manual (data migration phase). No test framework needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bootstrap creates workspace+base only | DATA-01 | CLI command output + NocoDB UI verification | Run `python scripts/nocodb_bootstrap.py --password test123 --workspace-only`. Verify in NocoDB UI: "JobSignal Engine" base exists with 0 tables. |
| Import from Airtable creates 4 tables with data | DATA-01 | Requires NocoDB UI interaction (paste PAT + Shared Base URL) | Open NocoDB UI → open "JobSignal Engine" base → ... menu → Import Data → Airtable Base → enter PAT + URL → verify advanced toggles → Import Base. Verify 4 tables appear. |
| Record counts match per table | DATA-02 | Requires Airtable UI + NocoDB API comparison | Get Airtable counts from UI toolbar. Get NocoDB counts via `curl` to Data API. Compare all 4 tables. |
| Spot-check 10+ records per table | DATA-02 | Human visual comparison | Open Airtable grid + NocoDB table side-by-side. Compare field values, select options, dates for 10+ records each. |
| Profile table full field-by-field match | DATA-02 | Critical single row — must be exact | Retrieve Profile row from NocoDB API: `curl localhost:8080/api/v2/tables/{TABLE_ID}/records?limit=1`. Compare all 14 fields. |
| Attachments preserved | DATA-02 | Visual verification of DOCX file | Find Pipeline record with Tailored CV in Airtable. Confirm same record has attachment in NocoDB with preview/download. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 900s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** {pending}
