---
phase: 04
slug: evaluator-workflow-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-10
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual — n8n UI node output inspection (no automated test harness for n8n workflows) |
| **Config file** | None — Wave 0 installs nothing |
| **Quick run command** | Open n8n UI → Workflow 2 (Evaluator) → Execute → Inspect node outputs |
| **Full suite command** | Trigger evaluator workflow manually; verify Pipeline records in NocoDB via API or UI; compare with Airtable output for same input data |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `quick run command` — inspect the specific modified section
- **After every plan wave:** Full manual trigger of evaluator workflow, verify all 6 test cases
- **Before `/gsd-verify-work`:** All 6 test cases must pass
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | EVAL-01 | — | N/A | manual | n8n UI: inspect "Unwrap Profile" output (1 flat item) | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | EVAL-01 | — | N/A | manual | n8n UI: inspect "Unwrap New Jobs" output (only Status=New, limit 5) | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | EVAL-01 | — | N/A | manual | n8n UI: inspect Parse AI Response output (recordId = string UUID) | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 1 | EVAL-01 | — | N/A | manual | n8n UI: inspect "Update Job Record" PATCH body `{id, fields}` | ❌ W0 | ⬜ pending |
| 04-01-05 | 01 | 1 | EVAL-01 | — | N/A | manual | n8n UI: inspect "Update Interview Prep" PATCH body `{id, fields}` | ❌ W0 | ⬜ pending |
| 04-01-06 | 01 | 1 | EVAL-02 | — | N/A | manual | n8n UI: verify High Fit branch fires, email sent with correct details | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No automated test harness, config files, or framework installation needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| NocoDB reads return correct data | EVAL-01 | No n8n workflow test harness | Inspect "Unwrap Profile" (1 item with profile fields), "Unwrap New Jobs" (only Status=New, max 5, each with string UUID `id`) |
| Scoring PATCH writes to Pipeline | EVAL-01 | No dual-write comparison | Inspect "Update Job Record" request body: `{ "id": "rec_xxx", "fields": { "Status": "Evaluated", "Fit Score": ..., ... } }`; verify in NocoDB UI |
| High Fit email triggers correctly | EVAL-02 | Requires external email provider | Ensure 8+ score job exists; verify email sent with correct Job Title, Company, Score |
| Interview Prep PATCH writes to Pipeline | EVAL-01 | No automated test harness | Inspect "Update Interview Prep" request body: `{ "id": "rec_xxx", "fields": { "Interview Questions": ..., ... } }`; verify in NocoDB UI |
| Graceful degradation on prep failure | EVAL-01 | AI node output not predictable | Cause AI prep to fail; verify Parse & Save Interview Prep stores error; PATCH still succeeds |
| Empty state handling | EVAL-01 | Depends on Pipeline state | Set all Pipeline records to Status!=New; verify workflow handles zero items gracefully |

---

## Validation Sign-Off

- [ ] All tasks have manual inspect verify steps
- [x] Sampling continuity: tasks without automated verify have manual equivalents
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
