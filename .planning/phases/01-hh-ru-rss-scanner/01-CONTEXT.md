# Phase 1: hh.ru RSS Scanner - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver `workflows/01e-scanner-hhru.json` — an n8n scanner that discovers hh.ru vacancies via public RSS (`/search/vacancy/rss`), merges Profile auto-feeds with enabled Search Queries (`Source Type = HH RSS`), parses and geography-filters results, deduplicates against Pipeline, and creates net-new records with `source: hh.ru` and `-hhr` job IDs. Includes Airtable schema/doc updates for RU geographies and HH RSS query columns. Does not fetch full vacancy HTML, change Evaluator behavior, or use HeadHunter authenticated API.

</domain>

<decisions>
## Implementation Decisions

### Auto-feed query strings
- **D-01:** RSS `text=` = Target Role + all Core Skills combined with **OR syntax** (e.g. `Python Developer OR FastAPI OR Django`)
- **D-02:** Use Profile field values **as-is** for language — no dual RU/EN feeds per role; Russian roles stay Russian, English stay English
- **D-03:** Do **not** include Seniority Level or Target Industries in auto-feed `text=`
- **D-04:** If a role has no Core Skills, fall back to **role-only** `text=`
- **D-05:** When Profile has >8 Target Roles, use **first 8 in Airtable order** (deterministic cap)
- **D-06:** URL-encode feed URLs with **%20** for spaces (not `+`)

### Area routing
- **D-07:** **One RSS feed per Target Role** (not role×area combos) — aligns with HH-02
- **D-08:** RSS `area=` uses **113 (Russia-wide)** whenever any RU-relevant geography is in Profile — broadest fetch for coverage
- **D-09:** Profile with **only Remote Russia**: still `area=113`, then post-filter for remote RU substrings in parsed location/description
- **D-10:** Apply **both** `area=` on fetch **and** substring post-filter via extended `GEO_MAP` (RU + EN) — same pattern as scanners 1a–1c
- **D-11:** Post-filter uses **all selected RU-relevant geographies** from Profile, not just the area used in URL

### Search Queries (HH RSS)
- **D-12:** Reuse existing **Search Queries** table; add `Source Type` option **HH RSS**
- **D-13:** Reuse columns: Query (label), Query String (`text=` override), Title Keywords, Location, Enabled, Source Tag, Last Run, Results Last Run
- **D-14:** **Location** stores hh **area ID as plain text** (`"1"`, `"2"`, `"113"`) when set; overrides Profile-derived area for that query row
- **D-15:** When Location empty on HH RSS row, derive area same as auto-feeds (113 if any RU geo)
- **D-16:** Ignore JobSpy-only columns for HH RSS rows (JobSpy Sites, Country Filter, Hours Old, Results Wanted)
- **D-17:** Merge enabled HH RSS Search Queries **with** Profile auto-feeds in one loop (JobSpy 1d pattern)

### RSS fetch & parse
- **D-18:** Use n8n **RSS Feed Read** node inside **Loop Over Items** (batch size 1) — required because RSS Read processes only the first input item
- **D-19:** Code node builds feed URL list; **Wait 1s** between feed requests (PROJECT constraint)
- **D-20:** v1 Job Description = **RSS item description** with HTML tags stripped; extract company, region, salary from description when present
- **D-21:** jobId = FNV-1a(title|company|applyLink) + **`-hhr`** suffix; Source = **`hh.ru`**
- **D-22:** Skip Profile auto-feeds when Profile has **no RU-relevant geography**; manual HH RSS Search Queries may still run (HH-09)

### Claude's Discretion
- **Bilingual text= (D-02):** User deferred — use Profile values as-is (documented above)
- **Area routing Q1–Q4:** User skipped — applied broadest-area fetch + post-filter pattern consistent with 1a–1c
- **Search Queries / RSS parse details:** User skipped remaining interactive turns — defaults above follow JobSpy 1d + PROJECT.md constraints

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & requirements
- `.planning/PROJECT.md` — Milestone scope, HH-01–09, key decisions, constraints
- `.planning/REQUIREMENTS.md` — Checkable HH-01–09 requirements and traceability
- `.planning/ROADMAP.md` — Phase 1 goal and success criteria

### Airtable schema
- `airtable/AIRTABLE-SCHEMA.md` — Profile, Pipeline, Search Queries field definitions (extend for RU geographies + HH RSS)

### Scanner patterns to mirror
- `workflows/01d-scanner-jobspy.json` — Multi-query loop, batch build, parse/filter, dedupe, Pipeline create (primary template for 01e)
- `workflows/01a-scanner-greenhouse.json` — Dynamic Profile `Target Geography` + `GEO_MAP` substring filtering

### External reference (area IDs, field semantics — no auth)
- `https://api.hh.ru/areas/113` — Russia area ID reference
- `https://hh.ru/search/vacancy/rss` — Public RSS endpoint shape (`text`, `area` params)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **JobSpy 1d workflow:** Search Queries read → build payload Code → loop → parse/filter → aggregate → dedupe → create — direct structural template for 01e
- **Greenhouse 1a `GEO_MAP`:** Dynamic read of Profile `Target Geography` with substring matching — extend with RU entries (Russia, Moscow, SPb, Remote Russia + Russian substrings)
- **FNV-1a hash:** Inline in all scanner parse nodes; reuse with `-hhr` suffix instead of `-spy`
- **Safety brake:** 100 net-new Pipeline records per run pattern from existing scanners

### Established Patterns
- Scanners do not call each other; schedule coordination via time (8:20 slots between 1d at 8:15 and Evaluator at 9:00)
- Business logic in n8n Code nodes — no shared JS modules
- n8n Code sandbox blocks `require('crypto')` — keep FNV-1a inline
- RSS Feed Read requires Loop Over Items batch size 1 (n8n docs)

### Integration Points
- Airtable Profile → auto-feed builder Code node
- Airtable Search Queries (filter `Source Type = 'HH RSS'`) → merged into feed list
- Airtable Pipeline → dedupe against existing Job IDs → create with Source `hh.ru`
- Downstream Evaluator (02) unchanged — accepts new Source value

</code_context>

<specifics>
## Specific Ideas

- RSS example from PROJECT.md: `https://hh.ru/search/vacancy/rss?text=python+developer&area=113`
- Area IDs locked: Russia `113`, Moscow `1`, Saint Petersburg `2`
- Mempalace has **stale API-based 01e notes** — ignore; RSS-first approach in PROJECT.md supersedes

</specifics>

<deferred>
## Deferred Ideas

- Full vacancy HTML description fetch (HH-10 / v2)
- Dynamic Profile geography read in JobSpy 1d (HH-11 — existing TODO in 01d)
- Daily rotation of which 8 Target Roles get feeds (user considered, rejected for v1 complexity)
- Seniority keywords or NOT-junior tokens in scanner `text=` (conflicts with no-scanner-negatives decision)

</deferred>

---

*Phase: 1-hh.ru RSS Scanner*
*Context gathered: 2026-06-05*
