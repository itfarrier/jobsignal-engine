# Phase 2: hh.ru Full Description Enrichment - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning
**Source:** Milestone v2.0 scoping (user selected HH-10 only)

<domain>
## Phase Boundary

Extend the shipped `workflows/01e-scanner-hhru.json` so net-new hh.ru jobs get **full vacancy page text** in Pipeline `Job Description` instead of the thin RSS summary. Applies only at discovery time for new jobs passing dedup — not retroactive backfill of existing Pipeline rows.

Out of scope: HH API auth, Playwright/browser automation, Evaluator/Tailor changes, HH-11 JobSpy geography fix, retroactive Pipeline updates.

</domain>

<decisions>
## Implementation Decisions

### Fetch mechanism
- Use **public vacancy page HTML** via HTTP Request on the RSS item `link` URL — same URL users apply from
- **No HeadHunter API** (`/vacancies/{id}`) — credentials unavailable; API docs are reference-only
- Mirror **Greenhouse 01a pattern**: per-job HTTP fetch → merge/strip node → continue to aggregate/dedup/Pipeline

### Workflow placement
- Insert fetch + merge **after** `Parse & Filter Jobs` (per feed) and **before** `Aggregate All Jobs`
- Parsed jobs must carry `applyLink` (RSS link) for the fetch URL; reuse existing field from 01e parse output
- `alwaysOutputData: true` + `onError: continueRegularOutput` on HTTP node (01a precedent)

### HTML extraction
- Extract description body from vacancy page HTML (selector TBD in research — likely `vacancy-description` or JSON-LD in page)
- Reuse **stripHtml** approach from 01e parse / 01a Merge Descriptions (entity decode + tag walk + whitespace collapse)
- Cap `jobDescription` at **50,000 characters** (01e/01d precedent)

### Failure handling
- If fetch fails, timeout, or parse yields empty text: **keep RSS stripped summary** as `jobDescription` — job still proceeds to Pipeline
- Log/marker field optional (`_descriptionSource: rss|page`) for debugging — Claude's discretion whether to expose in workflow

### Rate limiting & safety
- **1 second wait** between vacancy page fetches (matches existing 1s wait between RSS feeds)
- Do not change 8:20 schedule, 100 net-new safety brake, or dedup logic
- Set a reasonable HTTP timeout (01a uses 10s)

### HTTP headers
- Send browser-like **User-Agent** on hh.ru requests — research should confirm hh.ru expectations without API token

### Testing
- Add fixture: sample vacancy HTML snippet for parse unit test / manual script
- Extend or add parse script under `scripts/` mirroring phase 1 `hh-rss-parse` pattern if applicable

### Claude's Discretion
- Exact CSS selector or JSON-LD path for description extraction
- Whether to share stripHtml via duplicated code vs inline in merge node (prefer match 01a style unless trivial extract)
- Single plan vs split (schema docs likely unnecessary — workflow-only phase)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Workflow patterns
- `workflows/01e-scanner-hhru.json` — current RSS scanner to extend
- `workflows/01a-scanner-greenhouse.json` — `Fetch Job Detail` + `Merge Descriptions` reference implementation

### Planning & schema
- `.planning/PROJECT.md` — HH-10 scope, no-API constraint
- `.planning/REQUIREMENTS.md` — HH-10 acceptance criteria
- `airtable/AIRTABLE-SCHEMA.md` — Pipeline `Job Description` field semantics

### Phase 1 artifacts
- `.planning/phases/01-hh-ru-rss-scanner/01-CONTEXT.md` — deferred HH-10 note, security stripHtml precedent
- `.planning/phases/01-hh-ru-rss-scanner/01-SECURITY.md` — T-01-04 HTML stripping before Airtable

</canonical_refs>

<specifics>
## Specific Ideas

- RSS `link` is the apply URL, e.g. `https://hh.ru/vacancy/{id}`
- v1 shipped with RSS summary only (HH-06); Evaluator tolerates thin text short-term
- Mempalace may contain **stale API-based 01e design** — ignore; RSS + public HTML is current approach

</specifics>

<deferred>
## Deferred Ideas

- Retroactive backfill of existing Pipeline hh.ru rows with full descriptions
- HH-11 dynamic geography in JobSpy 01d
- HeadHunter authenticated detail API

</deferred>

---

*Phase: 02-hh-ru-description-enrichment*
*Context gathered: 2026-06-05*
