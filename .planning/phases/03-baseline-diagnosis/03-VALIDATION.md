---
phase: 03
slug: baseline-diagnosis
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-07
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual n8n execution verification |
| **Config file** | none — n8n workflows are verified by running in n8n |
| **Quick run command** | `Execute Workflow (03-measurement-workflow)` in n8n UI after 01e completes |
| **Full suite command** | Two back-to-back 01e runs + measurement workflow execution |
| **Estimated runtime** | ~120 seconds (two 01e runs at ~60s each) |

---

## Sampling Rate

- **After every task commit:** Inspect `${PADDED_PHASE}-PLAN.md` for correctness
- **After every plan wave:** Run 01e manually in n8n, verify measurement workflow runs
- **Before `/gsd-verify-work`:** Both runs complete with matching metrics recorded in Airtable
- **Max feedback latency:** 300 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | HH-12 | T-03-01 / — | N/A — no external input accepted | verify | Inspect measurement workflow JSON + Airtable table | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | HH-12 | T-03-02 / — | N/A — no external input accepted | verify | Run 01e + measure — 1 run, inspect Airtable | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | HH-12 | T-03-03 / — | N/A — no external input accepted | verify | Run 01e + measure — 2nd run, compare metrics | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Existing infrastructure covers all phase requirements. No test framework to install — verification is via n8n execution.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Measurement workflow triggers after 01e completes (success) | HH-12 | Requires n8n runtime — workflow triggers are event-driven | Run 01e manually → verify measurement workflow ran by checking Airtable Baseline Metrics table |
| Measurement workflow triggers after 01e errors | HH-12 | Requires error condition in n8n | Force 01e error (e.g., disable Airtable cred) → verify measurement workflow still records error metrics |
| Per-node item counts are correct | HH-12 | Requires visual inspection of n8n execution history vs measurement output | Compare counts in Airtable records against n8n execution history UI for same execution ID |
| Baseline Metrics table contains Profile snapshot | HH-12 | Schema correctness check | Verify Airtable Baseline Metrics table has Profile fields populated alongside metrics |

---

## Validation Sign-Off

- [ ] All tasks have manual verify instructions
- [ ] Sampling continuity: no 3 consecutive tasks without verify reference
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 300s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
