# Phase 2: hh.ru Full Description Enrichment - Research

**Researched:** 2026-06-05
**Domain:** n8n HTTP fetch + HTML extraction (brownfield extension of `01e`)
**Confidence:** HIGH

## Summary

Phase 2 extends the shipped RSS scanner `workflows/01e-scanner-hhru.json` so each parsed vacancy gets its **full page description** before aggregation. Live verification on `https://hh.ru/vacancy/133572268` (2026-06-05) shows the full HTML description is available in **both** JSON-LD `JobPosting.description` and SSR markup `data-qa="vacancy-description"` (~2,390 characters vs ~102 characters in `og:description` and ~200 characters in RSS summary). Extraction should prefer JSON-LD (schema.org, entity-encoded HTML string), fall back to the `data-qa` block, then fall back to the existing RSS-stripped `jobDescription`.

Mirror the **Greenhouse 01a** fetch+merge pattern, but add a **`Loop Over Jobs`** (`splitInBatches`, batch size 1) inside the existing feed loop to honor the locked **1 second wait between vacancy page fetches** — stricter than 01a, which only waits 1s after processing all jobs in a company batch. Public HTML pages accept browser-like, minimal, and curl User-Agents with HTTP 200 in testing; the HeadHunter **API** enforces `User-Agent: App/Version (email@example.com)` but that endpoint is out of scope.

**Primary recommendation:** Insert `Loop Over Jobs` → `Fetch Vacancy Page` (HTTP GET `$json.applyLink`, response format Text, 10s timeout, browser User-Agent) → `Merge Descriptions` (JSON-LD → `data-qa` → RSS fallback, `stripHtml`, 50k cap) → `Wait 1s Vacancy` between `Parse & Filter Jobs` and the existing feed-level `Wait 1s`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Fetch mechanism
- Use **public vacancy page HTML** via HTTP Request on the RSS item `link` URL — same URL users apply from
- **No HeadHunter API** (`/vacancies/{id}`) — credentials unavailable; API docs are reference-only
- Mirror **Greenhouse 01a pattern**: per-job HTTP fetch → merge/strip node → continue to aggregate/dedup/Pipeline

#### Workflow placement
- Insert fetch + merge **after** `Parse & Filter Jobs` (per feed) and **before** `Aggregate All Jobs`
- Parsed jobs must carry `applyLink` (RSS link) for the fetch URL; reuse existing field from 01e parse output
- `alwaysOutputData: true` + `onError: continueRegularOutput` on HTTP node (01a precedent)

#### HTML extraction
- Extract description body from vacancy page HTML (selector TBD in research — likely `vacancy-description` or JSON-LD in page)
- Reuse **stripHtml** approach from 01e parse / 01a Merge Descriptions (entity decode + tag walk + whitespace collapse)
- Cap `jobDescription` at **50,000 characters** (01e/01d precedent)

#### Failure handling
- If fetch fails, timeout, or parse yields empty text: **keep RSS stripped summary** as `jobDescription` — job still proceeds to Pipeline
- Log/marker field optional (`_descriptionSource: rss|page`) for debugging — Claude's discretion whether to expose in workflow

#### Rate limiting & safety
- **1 second wait** between vacancy page fetches (matches existing 1s wait between RSS feeds)
- Do not change 8:20 schedule, 100 net-new safety brake, or dedup logic
- Set a reasonable HTTP timeout (01a uses 10s)

#### HTTP headers
- Send browser-like **User-Agent** on hh.ru requests — research should confirm hh.ru expectations without API token

#### Testing
- Add fixture: sample vacancy HTML snippet for parse unit test / manual script
- Extend or add parse script under `scripts/` mirroring phase 1 `hh-rss-parse` pattern if applicable

### Claude's Discretion
- Exact CSS selector or JSON-LD path for description extraction
- Whether to share stripHtml via duplicated code vs inline in merge node (prefer match 01a style unless trivial extract)
- Single plan vs split (schema docs likely unnecessary — workflow-only phase)

### Deferred Ideas (OUT OF SCOPE)
- Retroactive backfill of existing Pipeline hh.ru rows with full descriptions
- HH-11 dynamic geography in JobSpy 01d
- HeadHunter authenticated detail API
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HH-10 | After RSS discovery in `01e`, fetch the public vacancy HTML page for each net-new job and replace the thin RSS summary with a stripped full description before writing to Pipeline | JSON-LD + `data-qa` extraction verified on live page; 01a fetch/merge node pattern; insertion point after Parse inside feed loop; `Loop Over Jobs` + 1s wait for rate safety; RSS fallback on failure; `test_hh_vacancy_parse.mjs` fixture strategy |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Vacancy page HTTP fetch | n8n workflow (HTTP Request node) | — | Server-side fetch from n8n Cloud; no browser automation |
| HTML description extraction | n8n Code node (`Merge Descriptions`) | — | Regex + JSON.parse in sandboxed JS; no DOM parser available |
| HTML stripping / sanitization | n8n Code node | — | Same trust boundary as Phase 1 T-01-04 |
| Rate limiting between fetches | n8n Wait + SplitInBatches | — | Operational control, not hh.ru client SDK |
| Dedup / net-new filtering | n8n workflow (post-aggregate) | — | Unchanged; fetch runs pre-aggregate per locked placement |
| Pipeline persistence | Airtable node | — | `Job Description` field only; no schema change |

## Standard Stack

### Core

| Component | Version/Pattern | Purpose | Why Standard |
|-----------|-----------------|---------|--------------|
| n8n HTTP Request | `n8n-nodes-base.httpRequest` v4.2+ (01a uses v4.4) | GET public vacancy HTML | Same node as 01a `Fetch Job Detail` |
| n8n Code | v2 | Extract + strip + merge | Matches 01a `Merge Descriptions` |
| n8n SplitInBatches | v3, batch=1 | Per-job fetch with 1s wait | Required for inter-fetch delay (01a lacks this) |
| n8n Wait | v1.1 | 1s between vacancy fetches | Phase 1 precedent for feed pacing |
| Node.js test script | v24+ (env verified) | Offline parse fixture test | Phase 1 `test_hh_rss_parse.mjs` pattern |

### Supporting

| Component | Version | Purpose | When to Use |
|-----------|---------|---------|-------------|
| `fixtures/hh-vacancy-page-sample.html` | — | Anonymized SSR snippet | Nyquist automated parse test |
| `scripts/test_hh_vacancy_parse.mjs` | — | `extractVacancyDescription` + `stripHtml` | Per-commit verification |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Public HTML + regex/JSON-LD | HH API `GET /vacancies/{id}` | **Rejected (locked)** — no credentials; API requires valid `User-Agent: App/Version (email)` [CITED: github.com/hhru/api/docs/errors.md] |
| JSON-LD primary | `data-qa="vacancy-description"` only | JSON-LD is schema.org standard; both verified identical length on live page — use JSON-LD first, `data-qa` fallback |
| Pre-aggregate fetch (locked) | Fetch only after dedup | Saves HTTP calls but breaks 01a mirror; locked to pre-aggregate placement |
| cheerio/jsdom | Regex in Code node | No new packages (Phase 1 security precedent); regex sufficient for two stable markers |

**Installation:** None — Node builtins only (`node:fs`, `node:path`, `node:url`).

**Version verification:** No external packages to install. Node v24.16.0 available in research environment.

## Package Legitimacy Audit

> Phase installs **no external packages**. Node builtins only (same as Phase 1 T-01-SC).

| Package | Registry | slopcheck | Disposition |
|---------|----------|-----------|-------------|
| *(none)* | — | — | N/A |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck unavailable at research time — moot because no packages recommended.*

## Architecture Patterns

### System Architecture Diagram

```text
[Triggers] → Get Profile → Get Search Queries → Build Feed List
       ↓
Loop Over Feeds (batch=1)
       ↓
RSS Feed Read → Parse & Filter Jobs  ← applyLink + RSS jobDescription
       ↓
Loop Over Jobs (batch=1)                    ← NEW (per-job pacing)
       ↓
Fetch Vacancy Page (GET applyLink)          ← NEW
       ↓
Merge Descriptions (JSON-LD → data-qa → RSS) ← NEW
       ↓
Wait 1s Vacancy                             ← NEW
       ↓ (loop back)
Loop Over Jobs [done] → Wait 1s Feed → Loop Over Feeds [done]
       ↓
Aggregate All Jobs → Get Existing Job IDs → Deduplicate vs Pipeline
       ↓
If → Create Pipeline Records (Job Description = enriched text)
```

### Exact Insertion Point (01e node graph)

**Current connections (feed loop):**
`Parse & Filter Jobs` → `Wait 1s` → `Loop Over Feeds`

**Target connections:**
`Parse & Filter Jobs` → `Loop Over Jobs` → (batch output 1) → `Fetch Vacancy Page` → `Merge Descriptions` → `Wait 1s Vacancy` → `Loop Over Jobs` → (batch output 0) → `Wait 1s` → `Loop Over Feeds`

**Unchanged downstream:** `Aggregate All Jobs` and everything after it.

**Note on HH-10 wording vs placement:** HH-10 says "net-new" jobs; locked CONTEXT places fetch **before** Pipeline dedup (mirroring 01a). This may fetch pages for jobs already in Pipeline — acceptable tradeoff for graph simplicity; worst case ~160 fetches/run (8 feeds × ~20 items) with 1s pacing ≈ +2.7 min.

### Recommended Project Structure

```text
workflows/
  01e-scanner-hhru.json     # extend in place
fixtures/
  hh-rss-sample.xml         # existing (Phase 1)
  hh-vacancy-page-sample.html  # NEW — anonymized vacancy page excerpt
scripts/
  test_hh_rss_parse.mjs     # existing (Phase 1)
  test_hh_vacancy_parse.mjs # NEW — page description extraction
```

### Pattern 1: Fetch Vacancy Page (mirror 01a `Fetch Job Detail`)

**What:** HTTP GET each job's `applyLink` with error continuation.
**When to use:** Every non-`_empty` parsed job item inside feed loop.

```json
{
  "parameters": {
    "url": "={{ $json.applyLink }}",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "User-Agent",
          "value": "Mozilla/5.0 (compatible; JobSignalEngine/2.0; +https://github.com/jobsignal-engine)"
        }
      ]
    },
    "options": {
      "timeout": 10000,
      "response": {
        "response": {
          "responseFormat": "text",
          "outputPropertyName": "data"
        }
      }
    }
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "alwaysOutputData": true,
  "onError": "continueRegularOutput"
}
```

Source: 01a `Fetch Job Detail` node + n8n HTTP Request response format Text [CITED: github.com/n8n-io/n8n-docs — HTTP Request node options]

**Response field:** With `responseFormat: text` and `outputPropertyName: data`, HTML is at `$json.data`. Merge must also tolerate `$json.body` / string body for robustness (01a reads Greenhouse JSON `.content` — different API shape).

### Pattern 2: Merge Descriptions (extraction + strip + fallback)

**What:** Extract full description HTML, strip tags, cap length, fall back to RSS summary.
**When to use:** Immediately after fetch, one item per job iteration.

```javascript
// Source: verified against live hh.ru/vacancy/133572268 (2026-06-05)
const extractVacancyDescriptionHtml = (rawHtml) => {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  // Primary: JSON-LD JobPosting.description
  const ldRe = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = ldRe.exec(rawHtml)) !== null) {
    try {
      const data = JSON.parse(m[1].trim());
      const postings = Array.isArray(data) ? data : [data];
      for (const item of postings) {
        if (item && item['@type'] === 'JobPosting' && item.description) {
          return String(item.description);
        }
      }
    } catch (_) { /* try next block */ }
  }

  // Fallback: SSR vacancy-description block
  const qaRe = /data-qa="vacancy-description"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i;
  const qa = rawHtml.match(qaRe);
  if (qa && qa[1]) return qa[1];

  return '';
};

// stripHtml — duplicate from 01e Parse / 01a Merge (entity decode + tag walk)
// ... same implementation as workflows/01e-scanner-hhru.json ...

const job = $('Loop Over Jobs').item.json;
const fetchResult = $input.first().json;
const rawHtml = fetchResult.data || fetchResult.body || '';
const rssFallback = job.jobDescription || '';

// SSRF guard: only hh.ru vacancy URLs from RSS
const applyLink = job.applyLink || '';
if (!/^https:\/\/hh\.ru\/vacancy\/\d+/.test(applyLink)) {
  return [{ json: { ...job, jobDescription: rssFallback, _descriptionSource: 'rss' } }];
}

const extractedHtml = extractVacancyDescriptionHtml(rawHtml);
let jobDescription = extractedHtml ? stripHtml(extractedHtml) : rssFallback;
let _descriptionSource = extractedHtml ? 'page' : 'rss';

if (jobDescription.length > 50000) {
  jobDescription = jobDescription.substring(0, 50000) + '\n\n[Description truncated]';
}

return [{ json: { ...job, jobDescription, _descriptionSource } }];
```

**Verified extraction sources (live page 133572268, 2026-06-05):**

| Source | Present | Content length | Usable for Evaluator |
|--------|---------|----------------|----------------------|
| JSON-LD `JobPosting.description` | Yes | 2,390 chars (HTML) | Yes (after stripHtml) |
| `data-qa="vacancy-description"` | Yes | 2,390 chars (HTML) | Yes (after stripHtml) |
| `og:description` meta | Yes | 102 chars | No — too thin |
| RSS stripped summary | Yes | ~200 chars | Fallback only |

### Pattern 3: Loop Over Jobs (rate limiting)

**What:** `splitInBatches` batch size 1 wrapping fetch/merge/wait inside each feed iteration.
**When to use:** Required to satisfy locked 1s **between** vacancy fetches (01a's single post-batch Wait is insufficient).

Feed `Wait 1s` stays at end of feed iteration (unchanged). New `Wait 1s Vacancy` sits inside job loop.

### Anti-Patterns to Avoid

- **Using HH API without registered User-Agent:** Returns `400 bad_user_agent blacklisted` [VERIFIED: `curl https://api.hh.ru/vacancies/133572268` 2026-06-05]
- **Trusting `og:description`:** Meta tag is salary/location blurb only (~102 chars on live sample)
- **Removing feed-level Wait 1s:** Still needed between RSS fetches (T-01-07)
- **Parallel HTTP without job loop:** Violates 1s inter-fetch constraint
- **innerHTML / eval in Code node:** Forbidden by Phase 1 security model

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML tag stripping | DOMParser / cheerio | Existing `stripHtml` char-walk | n8n sandbox; Phase 1 audited pattern |
| HTTP client | Custom fetch script | n8n HTTP Request node | Retry, timeout, error continuation built-in |
| Full HTML parser dependency | npm install cheerio | Regex JSON-LD + `data-qa` | No supply-chain surface (T-01-SC) |
| HH API client | OAuth / API wrapper | Public page GET | Locked: no credentials |

**Key insight:** Two stable, verified markers (JSON-LD + `data-qa`) make a DOM library unnecessary for this phase.

## Common Pitfalls

### Pitfall 1: Assuming `data-qa="vacancy-description"` always in initial HTML
**What goes wrong:** Older cached samples or edge-case pages may only expose JSON-LD.
**Why it happens:** hh.ru uses SSR + React hydration; marker presence verified on live 2026-06-05 sample but not exhaustive.
**How to avoid:** Dual extraction (JSON-LD first, `data-qa` second, RSS third).
**Warning signs:** `jobDescription` length stays ~200 chars after deploy.

### Pitfall 2: Wrong HTTP response property name
**What goes wrong:** Merge reads `.content` (Greenhouse JSON) but HTML text lands in `.data`.
**Why it happens:** 01a copies Greenhouse API response shape, not raw HTML.
**How to avoid:** Set `responseFormat: text`, `outputPropertyName: data`; read `fetchResult.data || fetchResult.body`.
**Warning signs:** All jobs fall back to RSS despite HTTP 200.

### Pitfall 3: Missing per-job Wait loop
**What goes wrong:** Burst of 20 HTTP requests per feed triggers DDoS-Guard / rate limits.
**Why it happens:** 01a pattern alone only waits after entire company batch.
**How to avoid:** `Loop Over Jobs` batch=1 + `Wait 1s Vacancy`.
**Warning signs:** HTTP 429/403 spikes in n8n execution log.

### Pitfall 4: SSRF via tampered RSS link
**What goes wrong:** Malicious `link` in RSS could target internal URLs.
**Why it happens:** HTTP Request follows `applyLink` verbatim.
**How to avoid:** Validate `^https://hh\.ru/vacancy/\d+` before fetch (defense-in-depth; extends T-01-05).
**Warning signs:** Requests to non-hh.ru hosts in execution data.

### Pitfall 5: Mempalace stale API-based 01e design
**What goes wrong:** Planner implements employer_id API + `/vacancies/{id}` instead of public HTML.
**Why it happens:** Mempalace drawer dated 2026-06-04 predates RSS shipping.
**How to avoid:** Follow shipped `01e-scanner-hhru.json` + Phase 2 CONTEXT; ignore API-based drawer.
**Warning signs:** Tasks mention Tracked Companies or `Scan Method='hh.ru API'`.

## Code Examples

### Extract + strip (test script export)

```javascript
// Source: verified live hh.ru vacancy HTML 2026-06-05
export const extractVacancyDescriptionHtml = (rawHtml) => { /* see Pattern 2 */ };

export const stripHtml = (html) => { /* mirror 01e/01a */ };

export const mergeVacancyDescription = (rawHtml, rssFallback) => {
  const html = extractVacancyDescriptionHtml(rawHtml);
  const stripped = html ? stripHtml(html) : rssFallback;
  if (stripped.length > 50000) {
    return stripped.substring(0, 50000) + '\n\n[Description truncated]';
  }
  return stripped;
};
```

### n8n HTTP timeout

```javascript
// Source: n8n HTTP Request docs — timeout in milliseconds
{ "options": { "timeout": 10000 } }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HH API detail fetch (Mempalace 2026-06-04) | RSS + public HTML page | Phase 1 shipped 2026-06-05 | No API auth needed |
| RSS summary only (`HH-06`) | Full page text (`HH-10`) | Phase 2 (this) | Evaluator gets rich descriptions |
| Single Wait after job batch (01a) | Per-job Wait inside SplitInBatches | Phase 2 constraint | Safer hh.ru pacing |

**Deprecated/outdated:**
- Mempalace drawer "Company-ATS scanner / Fetch hh.ru API" — superseded by RSS 01e shipped drawer (2026-06-05)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | JSON-LD `JobPosting.description` present on all active vacancy pages | Pattern 2 | Need more fallback selectors; RSS fallback prevents data loss |
| A2 | Browser-like User-Agent sufficient for public HTML (API format not required) | Standard Stack | May need HH-formatted UA if blocks appear — monitor 429/403 |
| A3 | `outputPropertyName: data` for n8n HTTP text response | Pattern 1 | Merge reads wrong field → all RSS fallbacks |
| A4 | Pre-dedup fetch acceptable despite HH-10 "net-new" wording | Insertion Point | Extra HTTP load; dedup-after-fetch is optimization deferred |

## Open Questions

1. **Should `_descriptionSource` be written to Airtable or kept internal?**
   - What we know: Useful for debugging; no Airtable column today.
   - What's unclear: Operator visibility vs schema purity.
   - Recommendation: Omit from Airtable create mapping; optional console.log in Code node only (Claude's discretion).

2. **Exact browser User-Agent string**
   - What we know: Public HTML returns 200 with browser, empty, and curl UAs in testing.
   - What's unclear: Long-term DDoS-Guard behavior for n8n Cloud egress IPs.
   - Recommendation: Use descriptive browser-compatible string; monitor failures; do not use API `HH-User-Agent` format unless switching to API (out of scope).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `test_hh_vacancy_parse.mjs` | ✓ | v24.16.0 | — |
| curl / network | Research verification | ✓ | — | — |
| hh.ru public pages | Fetch Vacancy Page | ✓ | HTTP 200 on live sample | RSS fallback |
| n8n Cloud | Workflow execution | ✓ (project assumption) | — | Self-hosted per Phase 1 |
| slopcheck | Package audit | ✗ | — | No packages to audit |

**Missing dependencies with no fallback:** none (phase is workflow + scripts only)

**Missing dependencies with fallback:** slopcheck unavailable — moot (no npm installs)

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js builtins (no test runner) |
| Config file | none |
| Quick run command | `node scripts/test_hh_vacancy_parse.mjs` |
| Full suite command | `node scripts/test_hh_rss_parse.mjs && node scripts/test_hh_vacancy_parse.mjs` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HH-10 | Extract full description from vacancy page HTML | unit | `node scripts/test_hh_vacancy_parse.mjs` | ❌ Wave 0 |
| HH-10 | stripHtml removes tags from extracted description | unit | `node scripts/test_hh_vacancy_parse.mjs` | ❌ Wave 0 |
| HH-10 | Fallback to RSS text when HTML empty | unit | `node scripts/test_hh_vacancy_parse.mjs` | ❌ Wave 0 |
| HH-10 | 50k truncation | unit | `node scripts/test_hh_vacancy_parse.mjs` | ❌ Wave 0 |
| HH-10 | Workflow creates Pipeline rows with enriched description | manual | n8n Execute Workflow + Airtable inspect | ✅ workflow exists |

### Sampling Rate

- **Per task commit:** `node scripts/test_hh_vacancy_parse.mjs`
- **Per wave merge:** `node scripts/test_hh_rss_parse.mjs && node scripts/test_hh_vacancy_parse.mjs`
- **Phase gate:** Full suite green + manual n8n execution before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `fixtures/hh-vacancy-page-sample.html` — anonymized excerpt with JSON-LD + `data-qa="vacancy-description"`
- [ ] `scripts/test_hh_vacancy_parse.mjs` — exports `extractVacancyDescriptionHtml`, `stripHtml`, assertions vs fixture
- [ ] Workflow nodes: `Loop Over Jobs`, `Fetch Vacancy Page`, `Merge Descriptions`, `Wait 1s Vacancy`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Validate `applyLink` host/path before HTTP; stripHtml before Airtable |
| V6 Cryptography | no | — |

### Known Threat Patterns for n8n + external HTML

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| HTML injection via vacancy page | Tampering | `stripHtml` before Airtable (extends T-01-04) |
| SSRF via RSS `link` field | Spoofing | Whitelist `https://hh.ru/vacancy/{id}` in Merge before fetch |
| Rate-limit / DoS to hh.ru | Denial of service | 1s inter-fetch Wait + existing feed Wait; 10s timeout |
| Supply-chain via npm parse libs | Tampering | No new packages (extends T-01-SC) |
| n8n execution log disclosure | Information disclosure | Accept (AR-01-02 precedent) |

**New threats for Phase 2 security audit:**
- **T-02-01:** Untrusted vacancy page HTML → mitigate with stripHtml + 50k cap
- **T-02-02:** SSRF via applyLink → mitigate with URL whitelist
- **T-02-03:** Vacancy fetch rate DoS → mitigate with Loop Over Jobs + Wait 1s

## Sources

### Primary (HIGH confidence)
- Live HTML fetch `https://hh.ru/vacancy/133572268` — JSON-LD + `data-qa` extraction verified 2026-06-05
- Live RSS fetch `https://hh.ru/search/vacancy/rss?text=python&area=113` — applyLink format verified
- `workflows/01e-scanner-hhru.json` — current node graph
- `workflows/01a-scanner-greenhouse.json` — Fetch Job Detail + Merge Descriptions
- `/n8n-io/n8n-docs` (Context7) — HTTP Request timeout, response format Text

### Secondary (MEDIUM confidence)
- [github.com/hhru/api/docs/errors.md](https://github.com/hhru/api/blob/master/docs/errors.md) — `bad_user_agent` for API (not HTML pages)
- [github.com/hhru/api/docs/cache.md](https://github.com/hhru/api/blob/master/docs/cache.md) — User-Agent format example for API
- Mempalace wing `jobsignal-engine` — confirms stale API-based 01e drawer vs current RSS drawer

### Tertiary (LOW confidence)
- WebSearch community notes on HH User-Agent — verified for API only, not public HTML

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — brownfield n8n patterns, no new deps
- Architecture: HIGH — live HTML verified, 01a/01e graphs inspected
- Pitfalls: MEDIUM — DDoS-Guard long-term behavior not fully characterized

**Research date:** 2026-06-05
**Valid until:** 2026-07-05 (hh.ru page structure stable; re-verify if extraction failure rate spikes)
