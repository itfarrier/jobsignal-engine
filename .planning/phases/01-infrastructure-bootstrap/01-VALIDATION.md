---
phase: 1
slug: infrastructure-bootstrap
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-09
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Shell scripts + pytest-style assertions via Python |
| **Config file** | none — Wave 0 creates `scripts/test_bootstrap.py` |
| **Quick run command** | `python scripts/test_bootstrap.py --smoke` |
| **Full suite command** | `docker compose up -d && sleep 10 && python scripts/test_bootstrap.py` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `python scripts/test_bootstrap.py --smoke`
- **After every plan wave:** Run full suite `python scripts/test_bootstrap.py`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | INFR-01 | T-01-01 / — | Exposed ports limited to 8080 | health | `docker compose ps --status running | grep nocodb` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | INFR-02 | T-01-01 / — | Secrets via env vars, not in image | unit | `grep NC_ATTACHMENT_FIELD_SIZE docker-compose.example.yml` | ❌ W0 | ⬜ pending |
| 01-02-01 | 01 | 2 | BOOT-01 | — | N/A | unit | `python scripts/nocodb_bootstrap.py --dry-run && echo OK` | ❌ W0 | ⬜ pending |
| 01-02-02 | 01 | 2 | BOOT-02 | — | N/A | verify | `python -c "import json; json.load(open('scripts/nocodb-schema.json'))"` | ❌ W0 | ⬜ pending |
| 01-03-01 | 01 | 3 | BOOT-03 | — | N/A | verify | `python scripts/nocodb_bootstrap.py --import-data --dry-run` | ❌ W0 | ⬜ pending |
| 01-03-02 | 01 | 3 | BOOT-04 | — | N/A | unit | `python scripts/nocodb_bootstrap.py --table Pipeline --dry-run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/test_bootstrap.py` — smoke test harness
- [ ] `scripts/test_bootstrap.py` — full suite (Docker health check + API endpoint + schema validation)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| NocoDB UI accessible at configured port via Caddy | INFR-01 | Requires browser or curl against Caddy proxy | `curl -L http://localhost:8080/api/health` — check for 200 response |
| created tables visible in NocoDB UI | BOOT-01 | Visual confirmation of field types, select options | Open NocoDB UI at http://localhost:8080, verify 4 tables exist with correct field types |
| CV attachment upload and preview | BOOT-01 indirect | NocoDB UI-based verification | Upload a test file to a Pipeline record's attachment field, verify preview and download work |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** {pending / approved YYYY-MM-DD}
