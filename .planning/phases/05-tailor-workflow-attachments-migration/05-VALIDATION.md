---
phase: 5
slug: tailor-workflow-attachments-migration
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-11
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual workflow execution + node output inspection (no automated n8n test harness) |
| **Config file** | None |
| **Quick run command** | n8n UI → "JobSignal - Workflow 3 - Tailor" → Execute Workflow → inspect node outputs |
| **Full suite command** | Manual trigger with ≥1 Evaluated+High Fit job with blank Tailored CV Text; verify NocoDB record via UI + API |
| **Estimated runtime** | ~5 minutes per full manual run |

---

## Sampling Rate

- **After every task commit:** Inspect modified node outputs in n8n UI
- **After every plan wave:** Full manual test cases A–E (see below)
- **Before `/gsd-verify-work`:** TAIL-03 UI verification required
- **Max feedback latency** | ~300 seconds (manual n8n execution)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | TAIL-01 | — | NocoDB reads via xc-token credential only | structural | `node -e "…03-tailor.json…"` (Task 1 verify script) | ✅ | ⬜ pending |
| 05-01-02 | 01 | 1 | TAIL-02 | T-05-01 | Upload uses multipart; token not in URL | structural | `node -e "…03-tailor.json…"` (Task 2 verify script) | ✅ | ⬜ pending |
| 05-01-03 | 01 | 1 | TAIL-02 | — | PATCH includes defensive attachmentArray extraction | structural | Task 2 verify asserts attachmentArray + uploadJson?.data | ✅ | ⬜ pending |
| 05-01-04 | 01 | 1 | TAIL-03 | — | DOCX preview/download in NocoDB UI | manual | Open Pipeline record in NocoDB UI | ❌ W0 | ⬜ pending |
| 05-01-05 | 01 | 1 | D-06 | — | Upload fail still saves text + cost | manual | Break upload URL; verify PATCH partial | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] No automated test suite for n8n workflows — manual verification only
- [ ] Upload response shape must be confirmed against running NocoDB instance (array vs wrapped)
- [ ] Filter `(is,blank)` on `Tailored CV Text` must be verified against running NocoDB

*Existing infrastructure does not cover n8n workflow verification — all behaviors are manual.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| NocoDB reads (Profile + filtered Pipeline) | TAIL-01 | No n8n test harness | Test Case A: Execute workflow; inspect Unwrap nodes for flat items + correct filter |
| DOCX upload + PATCH attachment | TAIL-02 | Requires live NocoDB + cv-renderer | Test Case B: Trace Parse → Render → Convert → Upload → PATCH |
| Attachment visible in NocoDB UI | TAIL-03 | UI preview requires browser | Test Case C: Open Pipeline record — preview + download DOCX |
| Graceful degradation on upload fail | D-06 | Requires induced failure | Test Case D: Break upload URL; verify text+cost still saved |
| Empty state (no untailored jobs) | TAIL-01 | Requires seeded data state | Test Case E: All jobs tailored; Unwrap returns `_empty` |

---

## Validation Sign-Off

- [ ] All tasks have manual verify instructions or Wave 0 dependencies documented
- [ ] Sampling continuity: manual inspect after each task
- [ ] Wave 0 gaps documented (upload shape, blank filter)
- [ ] No watch-mode flags
- [ ] Feedback latency < 300s
- [ ] `nyquist_compliant: true` set in frontmatter after first successful manual run

**Approval:** pending
