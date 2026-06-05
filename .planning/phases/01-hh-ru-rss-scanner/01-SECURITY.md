---
phase: 01
slug: hh-ru-rss-scanner
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-05
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Doc → operator | `AIRTABLE-SCHEMA.md` instructs manual Airtable configuration | Area IDs, field semantics (non-secret) |
| Doc → workflow | 01e implementer trusts documented area IDs and field names | Schema contract |
| hh.ru RSS → n8n | Untrusted external XML/HTML in RSS descriptions | Job titles, company, salary, HTML descriptions |
| Build Feed List → RSS URL | User Query String becomes URL `text=` query param | Search terms (operator-controlled) |
| n8n → Airtable | PAT writes Pipeline records | Job metadata, stripped descriptions |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-01-01 | Tampering | `AIRTABLE-SCHEMA.md` area ID table | mitigate | Verified hh area IDs (113, 1, 2); whitelist `{1, 2, 113}` documented for Location field | closed |
| T-01-02 | Information disclosure | Example Query String in docs | accept | Example uses generic terms only (`python developer`, `Python, FastAPI`) | closed |
| T-01-03 | Spoofing | Operator typos wrong area ID in Location | mitigate | Schema documents allowed IDs; `Build Feed List` validates via `VALID_AREAS` Set with fallback to `113` | closed |
| T-01-04 | Tampering | RSS description HTML | mitigate | `stripHtml` before Airtable; `jobDescription` truncated at 50,000 chars; no eval/innerHTML | closed |
| T-01-05 | Spoofing | SSRF via malicious feed URL | mitigate | `makeFeedUrl` uses only `https://hh.ru/search/vacancy/rss` template + `encodeURIComponent(text)` + whitelisted area IDs — never user-supplied full URL | closed |
| T-01-06 | Tampering | Airtable formula injection | mitigate | Fixed `filterByFormula` string; user Query String only passed through `encodeURIComponent` into `text=` param | closed |
| T-01-07 | Denial of service | hh.ru rate limiting | mitigate | `Wait 1s` between feeds; max ~8 auto + manual queries per run | closed |
| T-01-08 | Elevation | Safety brake bypass | mitigate | `Deduplicate vs Pipeline` throws when net-new exceeds 100 (copied from 01d) | closed |
| T-01-09 | Information disclosure | n8n execution logs | accept | Job titles in logs — same operational tradeoff as existing scanners (01a–01d) | closed |
| T-01-SC | Tampering | npm/pip/cargo installs | accept | No new packages; `scripts/test_hh_rss_parse.mjs` uses Node builtins only | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01-01 | T-01-02 | Schema example row uses generic job-search terms; no PATs, credentials, or personal data | gsd-security-audit | 2026-06-05 |
| AR-01-02 | T-01-09 | n8n execution logs may contain job titles during debugging; consistent with all prior scanner workflows | gsd-security-audit | 2026-06-05 |
| AR-01-03 | T-01-SC | Phase adds documentation and workflow JSON only; parse test uses `node:fs`, `node:url`, `node:path` — no supply-chain install surface | gsd-security-audit | 2026-06-05 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-05 | 10 | 10 | 0 | gsd-secure-phase (Cursor) |

### Security Audit 2026-06-05

| Metric | Count |
|--------|-------|
| Threats found | 10 |
| Closed | 10 |
| Open | 0 |

#### Threat Verification Evidence

| Threat ID | Category | Disposition | Evidence |
|-----------|----------|-------------|----------|
| T-01-01 | Tampering | mitigate | `airtable/AIRTABLE-SCHEMA.md` — area table rows 113/1/2; Location allowed IDs `{1, 2, 113}` |
| T-01-02 | Information disclosure | accept | `airtable/AIRTABLE-SCHEMA.md:165` — example `python developer` / `Python, FastAPI` |
| T-01-03 | Spoofing | mitigate | `workflows/01e-scanner-hhru.json` Build Feed List — `VALID_AREAS = new Set(['1','2','113'])`, `resolveArea()` |
| T-01-04 | Tampering | mitigate | `workflows/01e-scanner-hhru.json` Parse & Filter — `stripHtml()`, `jobDescription.length > 50000` truncate |
| T-01-05 | Spoofing | mitigate | `workflows/01e-scanner-hhru.json` Build Feed List — `makeFeedUrl` hardcoded hh.ru RSS template + `encodeURIComponent` |
| T-01-06 | Tampering | mitigate | `workflows/01e-scanner-hhru.json` Get Search Queries — fixed `filterByFormula`; text via `encodeURIComponent` only |
| T-01-07 | Denial of service | mitigate | `workflows/01e-scanner-hhru.json` — `Wait 1s` node in feed loop |
| T-01-08 | Elevation | mitigate | `workflows/01e-scanner-hhru.json` Deduplicate vs Pipeline — `netNew.length > 100` throws |
| T-01-09 | Information disclosure | accept | Inherited from 01a–01d scanner pattern; documented AR-01-02 |
| T-01-SC | Tampering | accept | `scripts/test_hh_rss_parse.mjs` — Node builtins only; AR-01-03 |

**Platform note (defense-in-depth):** n8n supports `N8N_SSRF_PROTECTION_ENABLED` for HTTP-requesting nodes (Context7: n8n SSRF protection docs). Application-level URL templating (T-01-05) is the primary control; enable platform SSRF protection in production hosting.

### Unregistered Flags

None — no `## Threat Flags` entries in plan summaries.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-05
