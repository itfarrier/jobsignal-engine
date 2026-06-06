---
phase: 02
slug: hh-ru-description-enrichment
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-06
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Fixture → test script | Local file read only; no network | Anonymized vacancy HTML |
| Parse logic → Airtable (downstream) | stripHtml sanitizes before persistence (extends T-01-04) | Job descriptions (plain text, 50k capped) |
| hh.ru vacancy HTML → n8n Fetch | Untrusted external HTML crosses into workflow | Full vacancy page HTML |
| RSS applyLink → HTTP Request URL | User-influenced URL via hh.ru RSS link field | hh.ru vacancy URL |
| Merge Descriptions → Airtable Create | Sanitized plain text written to Pipeline | Job descriptions, metadata |
| n8n → hh.ru | Untrusted HTML fetched from public vacancy pages | GET requests to hh.ru/vacancy URLs |
| Merge Descriptions | Parses untrusted HTML; SSRF whitelist limits URL shape | Extracted HTML, diagnostics |
| Operator → Airtable UI | Manual field-option changes require authenticated human | Pipeline.Source option |
| n8n → Airtable API | Create node writes depend on schema matching live base | Pipeline records |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-02-01 | Tampering | Vacancy page HTML | mitigate | `stripHtml` in `mergeVacancyDescription`; 50k cap (extends T-01-04) | closed |
| T-02-SC | Tampering | npm installs (02-01) | accept | Node builtins only; no package-manager install tasks | closed |
| T-02-02 | Spoofing | SSRF via applyLink | mitigate | Whitelist `^https://hh\.ru/vacancy/\d+` in Merge before using fetch result | closed |
| T-02-03 | Denial of service | hh.ru rate limiting | mitigate | Loop Over Jobs batch=1 + Wait 1s Vacancy between fetches; 10s HTTP timeout; existing feed Wait 1s | closed |
| T-02-04 | Information disclosure | n8n execution logs | accept | Job titles/descriptions in logs — AR-01-02 precedent from Phase 1 | closed |
| T-02-SC (02-02) | Tampering | npm installs (02-02) | accept | No new packages in this plan | closed |
| T-02-03-01 | Tampering | scripts/test_hh_rss_parse.mjs | accept | Test fixture is local-only; no runtime trust boundary | closed |
| T-02-03-SC | Tampering | npm installs (02-03) | accept | No package installs in this plan | closed |
| T-02-04-01 | Spoofing | Fetch Vacancy Page | mitigate | Browser-like User-Agent + Accept headers; only GET whitelisted hh.ru/vacancy URLs used downstream | closed |
| T-02-04-02 | Tampering | Merge Descriptions | mitigate | SSRF whitelist `^https://hh.ru/vacancy/\d+` before using fetch HTML; stripHtml removes tags | closed |
| T-02-04-03 | Denial of Service | Fetch Vacancy Page | mitigate | 10s timeout preserved; 1s Wait 1s Vacancy pacing unchanged | closed |
| T-02-04-04 | Information Disclosure | _fetchHint diagnostics | accept | Internal n8n-only fields; not written to Airtable | closed |
| T-02-04-SC | Tampering | npm installs (02-04) | accept | No package installs in this plan | closed |
| T-02-05-01 | Tampering | Pipeline.Source field | mitigate | Document manual hh.ru option; invalid select causes visible wrong Source — troubleshooting guides operator fix | closed |
| T-02-05-02 | Information Disclosure | SETUP.md | accept | No secrets in docs; only field names and setup steps | closed |
| T-02-05-SC | Tampering | npm installs (02-05) | accept | No package installs in this plan | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-02-01 | T-02-SC | Test script uses only `node:fs`, `node:url`, `node:path` — no supply-chain install surface. Confirmed imports: `readFileSync`, `fileURLToPath`, `dirname`, `join`. | gsd-security-audit | 2026-06-06 |
| AR-02-02 | T-02-04 | n8n execution logs may contain job titles and descriptions during debugging; consistent with all prior scanner workflows (AR-01-02, Phase 1). | gsd-security-audit | 2026-06-06 |
| AR-02-03 | T-02-SC (02-02) | Plan 02 added workflow nodes and SETUP docs only; no npm/pip/cargo packages introduced. | gsd-security-audit | 2026-06-06 |
| AR-02-04 | T-02-03-01 | `scripts/test_hh_rss_parse.mjs` reads local fixture file only; no network access, no runtime data flow crossing a trust boundary. | gsd-security-audit | 2026-06-06 |
| AR-02-05 | T-02-03-SC | Plan 03 removed a console.log line only; no new packages introduced. | gsd-security-audit | 2026-06-06 |
| AR-02-06 | T-02-04-04 | `_fetchHint`, `_fetchStatus`, `_fetchHtmlBytes` are set in Merge Descriptions output but are NOT mapped to any Airtable column in Create Pipeline Records. Internal to n8n execution debugging only. | gsd-security-audit | 2026-06-06 |
| AR-02-07 | T-02-04-SC | Plan 04 modified workflow JSON only (Fetch node config, Merge Descriptions jsCode); no new packages introduced. | gsd-security-audit | 2026-06-06 |
| AR-02-08 | T-02-05-02 | `docs/SETUP.md` contains only field names, setup steps, and deployment instructions. No credentials, PATs, or secrets. | gsd-security-audit | 2026-06-06 |
| AR-02-09 | T-02-05-SC | Plan 05 modified documentation files only (`docs/SETUP.md`, `airtable/AIRTABLE-SCHEMA.md`); no new packages introduced. | gsd-security-audit | 2026-06-06 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-06 | 16 | 16 | 0 | gsd-secure-phase (Codex) |

### Security Audit 2026-06-06

| Metric | Count |
|--------|-------|
| Threats found | 16 |
| Closed | 16 |
| Open | 0 |

#### Threat Verification Evidence

| Threat ID | Category | Disposition | Evidence |
|-----------|----------|-------------|----------|
| T-02-01 | Tampering | mitigate | `scripts/test_hh_vacancy_parse.mjs:18` — `stripHtml` exported; `:76-83` — `mergeVacancyDescription` calls stripHtml and applies 50k cap (`:79-81`). `workflows/01e-scanner-hhru.json` Merge Descriptions — identical stripHtml + 50k cap present. |
| T-02-SC | Tampering | accept | `scripts/test_hh_vacancy_parse.mjs:8-10` — imports only `node:fs`, `node:url`, `node:path`. No npm packages. AR-02-01. |
| T-02-02 | Spoofing | mitigate | `workflows/01e-scanner-hhru.json` Merge Descriptions jsCode — SSRF whitelist: `if (!/^https:\/\/hh\.ru\/vacancy\/\d+/.test(applyLink))` returns RSS fallback + `_descriptionSource: "rss"`. |
| T-02-03 | Denial of service | mitigate | `workflows/01e-scanner-hhru.json` — Loop Over Jobs `batchSize:1` (line 166), `Wait 1s Vacancy` `amount:1` (line 238-248), Fetch Vacancy Page `timeout:10000` (line 199), existing `Wait 1s` feed-level node (line 250-262). |
| T-02-04 | Information disclosure | accept | Consistent with Phase 1 AR-01-02. n8n execution logs contain job metadata. AR-02-02. |
| T-02-SC (02-02) | Tampering | accept | Plan 02 modified `workflows/01e-scanner-hhru.json` and `docs/SETUP.md` only. No new packages. AR-02-03. |
| T-02-03-01 | Tampering | accept | `scripts/test_hh_rss_parse.mjs` — reads local fixture only (`node:fs`). No runtime trust boundary. AR-02-04. |
| T-02-03-SC | Tampering | accept | Plan 03 modified `scripts/test_hh_rss_parse.mjs` (removed one console.log line). No new packages. AR-02-05. |
| T-02-04-01 | Spoofing | mitigate | `workflows/01e-scanner-hhru.json` Fetch Vacancy Page — User-Agent (`:186`), Accept (`:189-191`), Accept-Language (`:193-194`) headers; `followRedirects: true` (`:207`). SSRF whitelist downstream in Merge Descriptions. |
| T-02-04-02 | Tampering | mitigate | `workflows/01e-scanner-hhru.json` Merge Descriptions — SSRF whitelist regex `^https://hh\.ru/vacancy/\d+` before processing fetch HTML; `stripHtml()` called on extracted HTML to remove tags. |
| T-02-04-03 | Denial of Service | mitigate | `workflows/01e-scanner-hhru.json` — Fetch Vacancy Page `timeout:10000` (line 199); `Wait 1s Vacancy` `amount:1` (line 238-248). |
| T-02-04-04 | Information Disclosure | accept | `_fetchHint`, `_fetchStatus`, `_fetchHtmlBytes` present in Merge Descriptions output but NOT mapped in Create Pipeline Records schema (lines 382-397 map only Job ID, Job Title, Company, Location, Apply Link, Job Description, Source, Source Query, Source Tag, Discovery Date, Status, Salary Info). AR-02-06. |
| T-02-04-SC | Tampering | accept | Plan 04 modified `workflows/01e-scanner-hhru.json` only. No new packages. AR-02-07. |
| T-02-05-01 | Tampering | mitigate | `docs/SETUP.md:94-103` — "1.7 01e hh.ru Pre-flight" checklist with step 1 "manually add single-select option `hh.ru`". `airtable/AIRTABLE-SCHEMA.md:177-185` — "Troubleshooting 01e Pipeline writes" table documents Source=LinkedIn symptom + fix. |
| T-02-05-02 | Information Disclosure | accept | `docs/SETUP.md` — contains only field names, deployment instructions, setup steps. No credentials or secrets. AR-02-08. |
| T-02-05-SC | Tampering | accept | Plan 05 modified `docs/SETUP.md` and `airtable/AIRTABLE-SCHEMA.md` only. No new packages. AR-02-09. |

### Unregistered Flags

None — no `## Threat Flags` entries in plan summaries.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-06
