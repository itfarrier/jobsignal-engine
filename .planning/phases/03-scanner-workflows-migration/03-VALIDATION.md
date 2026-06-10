---
phase: 3
slug: scanner-workflows-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-10
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual workflow execution + node output inspection (no automated test harness for n8n workflows) |
| **Config file** | None — workflows are JSON files, not Node.js modules |
| **Quick run command** | Open n8n UI → Select workflow → Click "Execute Workflow" → Inspect node outputs |
| **Full suite command** | Trigger all 4 scanner workflows manually in n8n UI; verify Pipeline records in NocoDB via `GET /api/v3/data/{baseId}/{pipelineId}/records` or NocoDB UI |
| **Estimated runtime** | ~900 seconds |

---

## Sampling Rate

- **After every task commit:** Run `Quick run` on the specific workflow being modified
- **After every plan wave:** Full manual trigger of all 4 scanners, verify each node output
- **Before `/gsd-verify-work`:** All 6 test cases must pass
- **Max feedback latency:** 300 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | SCAN-01 | T-03-01 / — | API token in n8n credential store, not in code | manual | n8n UI: trigger 1a, verify Tracked Companies + Pipeline reads from NocoDB | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | SCAN-02 | T-03-01 / — | Same credential pattern as 1a | manual | n8n UI: trigger 1b, verify Ashby filter + NocoDB reads | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | SCAN-03 | T-03-01 / — | Same credential pattern as 1a | manual | n8n UI: trigger 1c, verify Lever filter + NocoDB reads | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 2 | SCAN-04 | T-03-01 / — | Profile geography from NocoDB, not hardcoded | manual | n8n UI: trigger 1d, verify Profile + Search Queries + dedup from NocoDB | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] NOCODB_URL, NOCODB_BASE_ID, NOCODB_TABLE_* env vars present in docker-compose
- [ ] HTTP Header Auth credential ("NocoDB API") created in n8n with xc-token
- [ ] Verify NocoDB is accessible from n8n container: `http://nocodb:8080`

*Existing infrastructure covers data access; Wave 0 is env var + credential setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Field projection returns only Job IDs | SCAN-01 to SCAN-04 | n8n has no automated test framework | Trigger scanner, inspect "Unwrap Existing Job IDs" output — verify each item has only `Job ID` and `id` fields |
| Where clause filtering by scan method | SCAN-01, SCAN-02, SCAN-03 | n8n has no automated test framework | Inspect "Unwrap Tracked Companies" — verify only `Enabled=true` + correct Scan Method records returned |
| Pipeline record POST format | SCAN-01 to SCAN-04 | n8n has no automated test framework | Trigger with net-new job, inspect POST request body — verify `{ "fields": { ... } }` format |
| JobSpy Profile reading | SCAN-04 | n8n has no automated test framework | Inspect "Parse & Filter Jobs" output — verify `userGeographies` from Profile, not hardcoded |
| Dedup prevents re-insertion | SCAN-01 to SCAN-04 | n8n has no automated test framework | Run all 4 scanners twice — verify no duplicate records on second run |
| Empty state (zero companies) | SCAN-01 to SCAN-04 | n8n has no automated test framework | Disable all Tracked Companies, run scanner — verify graceful handling |

---

## Validation Sign-Off

- [ ] All tasks have manual verify instructions
- [ ] Sampling continuity: no 3 consecutive tasks without verification step
- [ ] Wave 0 covers env var + credential setup
- [ ] No watch-mode flags
- [ ] Feedback latency < 300s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
