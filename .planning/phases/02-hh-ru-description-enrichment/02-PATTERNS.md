# Phase 2: hh.ru Full Description Enrichment - Pattern Map

**Mapped:** 2026-06-05
**Files analyzed:** 7 (1 modified workflow + 4 new workflow nodes + 1 fixture + 1 test script)
**Analogs found:** 7 / 7

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `workflows/01e-scanner-hhru.json` | config (n8n workflow) | batch + request-response | `workflows/01a-scanner-greenhouse.json` + `workflows/01e-scanner-hhru.json` | exact |
| `workflows/01e-scanner-hhru.json` → `Loop Over Jobs` | middleware (splitInBatches) | batch | `workflows/01e-scanner-hhru.json` → `Loop Over Feeds` | exact |
| `workflows/01e-scanner-hhru.json` → `Fetch Vacancy Page` | service (HTTP Request) | request-response | `workflows/01a-scanner-greenhouse.json` → `Fetch Job Detail` | exact |
| `workflows/01e-scanner-hhru.json` → `Merge Descriptions` | utility (Code node) | transform | `workflows/01a-scanner-greenhouse.json` → `Merge Descriptions` + `01e` Parse `stripHtml` | role-match |
| `workflows/01e-scanner-hhru.json` → `Wait 1s Vacancy` | middleware (Wait) | batch pacing | `workflows/01e-scanner-hhru.json` → `Wait 1s` | exact |
| `fixtures/hh-vacancy-page-sample.html` | fixture | file-I/O | `fixtures/hh-rss-sample.xml` | exact |
| `scripts/test_hh_vacancy_parse.mjs` | test | transform | `scripts/test_hh_rss_parse.mjs` | exact |

## Pattern Assignments

### `workflows/01e-scanner-hhru.json` (config, batch + request-response)

**Analog:** `workflows/01a-scanner-greenhouse.json` (fetch+merge subgraph) + existing `workflows/01e-scanner-hhru.json` (feed loop, parse output shape)

**Connection rewiring** — current 01e feed loop (lines 807–827):

```807:827:workflows/01e-scanner-hhru.json
    "Parse & Filter Jobs": {
      "main": [
        [
          {
            "node": "Wait 1s",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Wait 1s": {
      "main": [
        [
          {
            "node": "Loop Over Feeds",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
```

**Target pattern** (mirror 01a fetch chain, nested inside feed loop per RESEARCH):

```773:860:workflows/01a-scanner-greenhouse.json
    "Parse & Filter Jobs": {
      "main": [
        [
          {
            "node": "Fetch Job Detail",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    // ... Fetch Job Detail → Merge Descriptions → Wait 1s → Loop Companies
```

**Phase 2 target graph:**
- `Parse & Filter Jobs` → `Loop Over Jobs` (input)
- `Loop Over Jobs` output **1** (batch) → `Fetch Vacancy Page` → `Merge Descriptions` → `Wait 1s Vacancy` → `Loop Over Jobs` (loop back)
- `Loop Over Jobs` output **0** (done) → `Wait 1s` → `Loop Over Feeds`
- `Aggregate All Jobs` and downstream **unchanged**

**Node ID convention** (01e uses prefixed UUIDs — continue sequence):

```118:130:workflows/01e-scanner-hhru.json
    {
      "parameters": {
        "batchSize": 1,
        "options": {}
      },
      "id": "a1e00001-0006-4000-8000-000000000006",
      "name": "Loop Over Feeds",
      "type": "n8n-nodes-base.splitInBatches",
      "typeVersion": 3,
```

Use new IDs `a1e00001-0011` through `a1e00001-0014` for the four new nodes; assign positions between Parse (560,-128) and Wait 1s (800,-128).

**Airtable create mapping** — no change; `Job Description` already maps `jobDescription`:

```299:304:workflows/01e-scanner-hhru.json
            "Job ID": "={{ $json.jobId }}",
            "Job Title": "={{ $json.jobTitle }}",
            "Company": "={{ $json.company }}",
            "Location": "={{ $json.location }}",
            "Apply Link": "={{ $json.applyLink }}",
            "Job Description": "={{ $json.jobDescription }}",
```

Do **not** map `_descriptionSource` to Airtable (RESEARCH recommendation).

---

### `Loop Over Jobs` node (middleware, batch)

**Analog:** `workflows/01e-scanner-hhru.json` → `Loop Over Feeds`

**splitInBatches pattern** (batch size 1, typeVersion 3):

```119:126:workflows/01e-scanner-hhru.json
      "parameters": {
        "batchSize": 1,
        "options": {}
      },
      ...
      "type": "n8n-nodes-base.splitInBatches",
      "typeVersion": 3,
```

**Nested loop connection pattern** (from `Loop Over Feeds` lines 778–794):

```778:794:workflows/01e-scanner-hhru.json
    "Loop Over Feeds": {
      "main": [
        [
          {
            "node": "Aggregate All Jobs",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "RSS Feed Read",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
```

Apply same dual-output wiring for `Loop Over Jobs`: index **0** → `Wait 1s` (feed-level); index **1** → `Fetch Vacancy Page` (per-job).

**Per-item node reference** (from evaluator — use when merge needs original job fields):

```623:623:workflows/02-evaluator.json
        "jsCode": "// Build interview prep prompt using profile + JD + evaluation results\nconst profile = $('Get Profile').item.json;\nconst job = $('Loop Over Jobs').item.json;\nconst evaluation = $('Parse AI Response').item.json;
```

---

### `Fetch Vacancy Page` node (service, request-response)

**Analog:** `workflows/01a-scanner-greenhouse.json` → `Fetch Job Detail`

**HTTP Request core pattern** (lines 601–618):

```601:618:workflows/01a-scanner-greenhouse.json
    {
      "parameters": {
        "url": "={{ $json.detailUrl }}",
        "options": {
          "timeout": 10000
        }
      },
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.4,
      ...
      "name": "Fetch Job Detail",
      "alwaysOutputData": true,
      "onError": "continueRegularOutput"
    },
```

**Phase 2 adaptations:**
- `url`: `={{ $json.applyLink }}` (from Parse output — field already emitted)
- Add `sendHeaders: true` + `User-Agent` (header pattern from `workflows/03-tailor.json` lines 647–654)
- Add `options.response.response.responseFormat: "text"` and `outputPropertyName: "data"` (RESEARCH Pattern 1)
- Keep `alwaysOutputData: true`, `onError: "continueRegularOutput"`, `timeout: 10000`

**Header parameters pattern** (from 03-tailor):

```647:655:workflows/03-tailor.json
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Content-Type",
              "value": "application/json"
            }
          ]
        },
```

Replace with browser-like `User-Agent` per RESEARCH (no credentials).

---

### `Merge Descriptions` node (utility, transform)

**Analog:** `workflows/01a-scanner-greenhouse.json` → `Merge Descriptions` (merge shape) + `workflows/01e-scanner-hhru.json` Parse `stripHtml` (hh.ru-appropriate stripper)

**01a batch-merge pattern** (differs — processes all items; Phase 2 uses per-job loop):

```621:631:workflows/01a-scanner-greenhouse.json
        "jsCode": "const allInputs = $input.all();\nconst parsedJobs = $('Parse & Filter Jobs').all();\n\n// Two-step stripper: decode entities first, then strip tags\nconst stripHtml = (html) => {\n  ...
  const description = stripHtml(detailResponse.content || '[Description not available]');\n  ...
  merged.push({\n    json: {\n      jobId: parsedJob.jobId,\n      ...\n      jobDescription: description,\n```

**01e stripHtml to duplicate inline** (prefer 01e variant over 01a's Greenhouse extras — matches RSS parse):

From Parse & Filter `jsCode` (entity decode + char-walk + whitespace collapse):

```javascript
const stripHtml = (html) => {
  if (!html || typeof html !== 'string') return '';
  let text = html;
  text = text.split('&lt;').join('<');
  text = text.split('&gt;').join('>');
  text = text.split('&quot;').join('"');
  text = text.split('&#39;').join("'");
  text = text.split('&apos;').join("'");
  text = text.split('&nbsp;').join(' ');
  text = text.split('&amp;').join('&');
  let result = '';
  let inTag = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '<') {
      inTag = true;
      if (result.length > 0 && result[result.length - 1] !== ' ') result += ' ';
      continue;
    }
    if (ch === '>') { inTag = false; continue; }
    if (!inTag) result += ch;
  }
  return result.replace(/\s+/g, ' ').trim();
};
```

**Per-item merge + fallback** (RESEARCH Pattern 2 — primary analog for new logic):

```javascript
const job = $('Loop Over Jobs').item.json;
if (job._empty) {
  return [{ json: job }];
}

const fetchResult = $input.first().json;
const rawHtml = fetchResult.data || fetchResult.body || '';
const rssFallback = job.jobDescription || '';

// SSRF guard (extends T-01-05)
const applyLink = job.applyLink || '';
if (!/^https:\/\/hh\.ru\/vacancy\/\d+/.test(applyLink)) {
  return [{ json: { ...job, jobDescription: rssFallback, _descriptionSource: 'rss' } }];
}

const extractedHtml = extractVacancyDescriptionHtml(rawHtml); // JSON-LD → data-qa
let jobDescription = extractedHtml ? stripHtml(extractedHtml) : rssFallback;
let _descriptionSource = extractedHtml ? 'page' : 'rss';

if (jobDescription.length > 50000) {
  jobDescription = jobDescription.substring(0, 50000) + '\n\n[Description truncated]';
}

return [{ json: { ...job, jobDescription, _descriptionSource } }];
```

**50k cap precedent** (from 01e Parse — same string):

```javascript
if (jobDescription.length > 50000) {
  jobDescription = jobDescription.substring(0, 50000) + '\n\n[Description truncated]';
}
```

**Parse output fields to preserve** (applyLink already present):

```javascript
out.push({
  json: {
    jobId,
    jobTitle: title,
    company,
    location: region || 'Not specified',
    applyLink,
    jobDescription,
    source: 'hh.ru',
    sourceQuery,
    sourceTag,
    discoveryDate: new Date().toISOString().split('T')[0],
    salaryInfo,
  },
});
```

---

### `Wait 1s Vacancy` node (middleware, batch pacing)

**Analog:** `workflows/01e-scanner-hhru.json` → `Wait 1s`

```164:177:workflows/01e-scanner-hhru.json
    {
      "parameters": {
        "amount": 1
      },
      "id": "a1e00001-0009-4000-8000-000000000009",
      "name": "Wait 1s",
      "type": "n8n-nodes-base.wait",
      "typeVersion": 1.1,
      ...
      "webhookId": "a1e-wait-1s-hhru-rss"
    },
```

Copy structure; use new `webhookId` (e.g. `a1e-wait-1s-hhru-vacancy`). Place **inside** job loop between Merge and Loop Over Jobs loop-back. Keep existing feed-level `Wait 1s` unchanged.

---

### `fixtures/hh-vacancy-page-sample.html` (fixture, file-I/O)

**Analog:** `fixtures/hh-rss-sample.xml`

**Fixture conventions** (minimal, anonymized, real structure):

```1:14:fixtures/hh-rss-sample.xml
<?xml version='1.0' encoding='utf-8'?>
<rss version="2.0">
  <channel>
    ...
    <item>
      ...
      <link>https://hh.ru/vacancy/133903879</link>
      <description><![CDATA[<p>Вакансия компании: Визионеро</p> ...]]></description>
    </item>
  </channel>
</rss>
```

**Phase 2 fixture must include:**
- `<script type="application/ld+json">` with `@type: "JobPosting"` and `description` (HTML string)
- `<div data-qa="vacancy-description">` block with matching body text
- Anonymized company/title (no real employer names if possible)
- Sufficient length (>500 chars stripped) to distinguish from RSS fallback (~200 chars)

---

### `scripts/test_hh_vacancy_parse.mjs` (test, transform)

**Analog:** `scripts/test_hh_rss_parse.mjs`

**File header + imports** (lines 1–12):

```1:12:scripts/test_hh_rss_parse.mjs
#!/usr/bin/env node
/**
 * Automated parse smoke test for hh.ru RSS description HTML.
 * Mirrors stripHtml + parseHhDescription in workflows/01e-scanner-hhru.json.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, '../fixtures/hh-rss-sample.xml');
```

**Exported helpers pattern** (lines 14–44):

```14:44:scripts/test_hh_rss_parse.mjs
export const stripHtml = (html) => {
  if (!html || typeof html !== 'string') return '';
  // ... entity decode + tag walk ...
  return result.replace(/\s+/g, ' ').trim();
};
```

**Assertion + exit pattern** (lines 72–108):

```72:108:scripts/test_hh_rss_parse.mjs
function main() {
  const xml = readFileSync(FIXTURE, 'utf8');
  ...
  const errors = [];
  if (!stripped.includes('Вакансия компании:')) {
    errors.push('stripped text missing company label');
  }
  ...
  if (errors.length > 0) {
    console.error('FAIL:', errors.join('; '));
    process.exit(1);
  }
  console.log('OK: hh.ru RSS parse fixture passed');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
```

**Phase 2 test exports and assertions:**
- `export const extractVacancyDescriptionHtml` — JSON-LD primary, `data-qa` fallback
- `export const stripHtml` — mirror 01e (same as test_hh_rss_parse)
- `export const mergeVacancyDescription(rawHtml, rssFallback)` — optional convenience wrapper
- Fixture path: `../fixtures/hh-vacancy-page-sample.html`
- Assert: extracted+stripped length >> rssFallback; no `<p>`/`<div>` tags remain; empty HTML returns rssFallback; 50k+ input truncates with `[Description truncated]`
- Docstring: `Mirrors Merge Descriptions in workflows/01e-scanner-hhru.json`

**Run commands** (from RESEARCH):

```bash
node scripts/test_hh_vacancy_parse.mjs
node scripts/test_hh_rss_parse.mjs && node scripts/test_hh_vacancy_parse.mjs
```

---

## Shared Patterns

### stripHtml (security + Airtable write path)

**Source:** `workflows/01e-scanner-hhru.json` Parse & Filter + `scripts/test_hh_rss_parse.mjs`
**Apply to:** `Merge Descriptions` Code node, `test_hh_vacancy_parse.mjs`
**Threat:** T-01-04 (RSS HTML), T-02-01 (vacancy page HTML)

Duplicate inline in workflow Code node (01a precedent — no shared module). Test script exports for Nyquist verification.

### HTTP error continuation

**Source:** `workflows/01a-scanner-greenhouse.json` Fetch Job Detail
**Apply to:** `Fetch Vacancy Page`

```javascript
"alwaysOutputData": true,
"onError": "continueRegularOutput"
```

Merge must treat missing/empty `data` as RSS fallback — job still proceeds to Pipeline.

### splitInBatches nested loops

**Source:** `workflows/01e-scanner-hhru.json` Loop Over Feeds
**Apply to:** Loop Over Jobs inside feed loop

- `batchSize: 1` on both loops
- Output 0 = done branch; output 1 = per-item branch
- Wait node at end of inner loop before loop-back

### FNV-1a job payload shape

**Source:** `.planning/codebase/CONVENTIONS.md` + 01e Parse output
**Apply to:** Merge Descriptions return shape

Preserve all camelCase keys (`jobId`, `applyLink`, `jobDescription`, etc.). Sentinel `_empty` jobs pass through unchanged.

### Node naming

**Source:** `.planning/codebase/CONVENTIONS.md`
**Apply to:** All new nodes

Title Case with spaces: `Loop Over Jobs`, `Fetch Vacancy Page`, `Merge Descriptions`, `Wait 1s Vacancy`.

### Security: URL whitelist

**Source:** `.planning/phases/01-hh-ru-rss-scanner/01-SECURITY.md` T-01-05 (feed URLs) → T-02-02 (applyLink)
**Apply to:** Merge Descriptions (before trusting fetch result)

```javascript
if (!/^https:\/\/hh\.ru\/vacancy\/\d+/.test(applyLink)) {
  return [{ json: { ...job, jobDescription: rssFallback, _descriptionSource: 'rss' } }];
}
```

### No new npm packages

**Source:** Phase 1 T-01-SC / RESEARCH Package Legitimacy Audit
**Apply to:** `test_hh_vacancy_parse.mjs` — `node:fs`, `node:url`, `node:path` only

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| *(none)* | — | — | All phase files have brownfield analogs |

**Partial analog note:** `extractVacancyDescriptionHtml` (JSON-LD regex + `data-qa` fallback) is **new logic** with no existing implementation — use RESEARCH Pattern 2 code block; test script becomes the golden reference.

---

## Metadata

**Analog search scope:** `workflows/`, `scripts/`, `fixtures/`, `.planning/codebase/`, `.planning/phases/01-hh-ru-rss-scanner/`
**Files scanned:** 12 primary analogs (01a, 01e, 02-evaluator, 03-tailor, test_hh_rss_parse.mjs, hh-rss-sample.xml, CONVENTIONS, TESTING, 01-SECURITY, 01-02-PLAN, 02-RESEARCH, 02-CONTEXT)
**Pattern extraction date:** 2026-06-05
