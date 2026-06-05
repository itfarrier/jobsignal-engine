# Phase 1: hh.ru RSS Scanner - Research

**Researched:** 2026-06-05
**Domain:** n8n workflow + hh.ru public RSS + Airtable Profile/Search Queries/Pipeline
**Confidence:** HIGH (workflow patterns, RSS shape, area IDs); MEDIUM (n8n RSS node edge cases, hh rate limits)

## Summary

Phase 1 adds `workflows/01e-scanner-hhru.json` as a fifth discovery scanner. It mirrors **JobSpy 1d** for dedupe/Pipeline create and **Greenhouse 1a** for Profile-driven `GEO_MAP` geography filtering, but replaces the HTTP sidecar with **native n8n RSS Feed Read** inside a **Loop Over Items** (batch size 1) over ~8 Profile auto-feeds plus enabled **Search Queries** rows (`Source Type = HH RSS`).

Live fetch of `https://hh.ru/search/vacancy/rss?text=python%20developer&area=113` on 2026-06-05 returned **20 items** per feed, UTF-8 XML, with predictable Russian-labeled HTML in `description` (company, region, salary). Public area reference `https://api.hh.ru/areas/113` confirms Russia id **113** without auth. OR syntax in `text=` works in RSS (`Python Developer OR FastAPI` returned 20 items).

**Primary recommendation:** Implement 01e as **Get Profile → Get HH RSS Search Queries → Build Feed List → Loop Over Feeds (1) → RSS Feed Read → Parse & Filter → Wait 1s → Aggregate → dedupe/create (copy 01d tail)**; extend `GEO_MAP` with four RU geographies; document Airtable option changes; validate with curl + manual n8n execute before enabling 8:20 schedule.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Auto-feed query strings
- **D-01:** RSS `text=` = Target Role + all Core Skills combined with **OR syntax** (e.g. `Python Developer OR FastAPI OR Django`)
- **D-02:** Use Profile field values **as-is** for language — no dual RU/EN feeds per role; Russian roles stay Russian, English stay English
- **D-03:** Do **not** include Seniority Level or Target Industries in auto-feed `text=`
- **D-04:** If a role has no Core Skills, fall back to **role-only** `text=`
- **D-05:** When Profile has >8 Target Roles, use **first 8 in Airtable order** (deterministic cap)
- **D-06:** URL-encode feed URLs with **%20** for spaces (not `+`)

#### Area routing
- **D-07:** **One RSS feed per Target Role** (not role×area combos) — aligns with HH-02
- **D-08:** RSS `area=` uses **113 (Russia-wide)** whenever any RU-relevant geography is in Profile — broadest fetch for coverage
- **D-09:** Profile with **only Remote Russia**: still `area=113`, then post-filter for remote RU substrings in parsed location/description
- **D-10:** Apply **both** `area=` on fetch **and** substring post-filter via extended `GEO_MAP` (RU + EN) — same pattern as scanners 1a–1c
- **D-11:** Post-filter uses **all selected RU-relevant geographies** from Profile, not just the area used in URL

#### Search Queries (HH RSS)
- **D-12:** Reuse existing **Search Queries** table; add `Source Type` option **HH RSS**
- **D-13:** Reuse columns: Query (label), Query String (`text=` override), Title Keywords, Location, Enabled, Source Tag, Last Run, Results Last Run
- **D-14:** **Location** stores hh **area ID as plain text** (`"1"`, `"2"`, `"113"`) when set; overrides Profile-derived area for that query row
- **D-15:** When Location empty on HH RSS row, derive area same as auto-feeds (113 if any RU geo)
- **D-16:** Ignore JobSpy-only columns for HH RSS rows (JobSpy Sites, Country Filter, Hours Old, Results Wanted)
- **D-17:** Merge enabled HH RSS Search Queries **with** Profile auto-feeds in one loop (JobSpy 1d pattern)

#### RSS fetch & parse
- **D-18:** Use n8n **RSS Feed Read** node inside **Loop Over Items** (batch size 1) — required because RSS Read processes only the first input item
- **D-19:** Code node builds feed URL list; **Wait 1s** between feed requests (PROJECT constraint)
- **D-20:** v1 Job Description = **RSS item description** with HTML tags stripped; extract company, region, salary from description when present
- **D-21:** jobId = FNV-1a(title|company|applyLink) + **`-hhr`** suffix; Source = **`hh.ru`**
- **D-22:** Skip Profile auto-feeds when Profile has **no RU-relevant geography**; manual HH RSS Search Queries may still run (HH-09)

### Claude's Discretion
- **Bilingual text= (D-02):** User deferred — use Profile values as-is (documented above)
- **Area routing Q1–Q4:** User skipped — applied broadest-area fetch + post-filter pattern consistent with 1a–1c
- **Search Queries / RSS parse details:** User skipped remaining interactive turns — defaults above follow JobSpy 1d + PROJECT.md constraints

### Deferred Ideas (OUT OF SCOPE)
- Full vacancy HTML description fetch (HH-10 / v2)
- Dynamic Profile geography read in JobSpy 1d (HH-11 — existing TODO in 01d)
- Daily rotation of which 8 Target Roles get feeds (user considered, rejected for v1 complexity)
- Seniority keywords or NOT-junior tokens in scanner `text=` (conflicts with no-scanner-negatives decision)

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HH-01 | `01e-scanner-hhru.json` via public `/search/vacancy/rss`, no OAuth | RSS URL verified live; n8n `rssFeedRead` + loop pattern documented |
| HH-02 | Auto-build feeds from Profile; one feed/role; ~8 cap | Build Feed List algorithm from D-01–D-08; OR `text=` per hh query language [CITED] |
| HH-03 | Merge Search Queries `HH RSS`; Location = area ID | Filter formula + merge in Build Feed List; D-14–D-17 |
| HH-04 | Parse RSS; GEO_MAP post-filter; Title Keywords; no RU negatives | Description HTML structure verified; GEO_MAP extension table below |
| HH-05 | Pipeline write `hh.ru`, `-hhr`, dedupe, 8:20 schedule | Copy 01d dedupe/create/If; schedule `triggerAtHour: 8`, `triggerAtMinute: 20` |
| HH-06 | RSS summary as Job Description | D-20; strip HTML reusing 1a-style stripper |
| HH-07 | RU Target Geography + GEO_MAP in schema/docs | Airtable + code entries for Russia/Moscow/SPb/Remote Russia |
| HH-08 | Document HH RSS columns; Pipeline Source `hh.ru` | AIRTABLE-SCHEMA.md delta; workflow JSON Source option |
| HH-09 | Skip auto feeds if no RU geo; manual HH RSS still runs | `RU_RELEVANT_GEOS` guard in Build Feed List |

**Traceability note:** REQUIREMENTS.md HH-02 mentions "bilingual `text=` where Profile is mixed." **Locked CONTEXT D-02 overrides:** single feed per role using Profile strings as-is (not dual RU+EN feeds). Planner should implement D-02.

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Feed URL construction | n8n Code node (Build Feed List) | Airtable Profile + Search Queries | Business rules from user config; no server |
| RSS HTTP fetch | n8n RSS Feed Read | — | Native node; no sidecar |
| Item parse / geo filter | n8n Code node (Parse & Filter) | Profile `Target Geography` | Same as 1a–1c scanners |
| Dedup / safety brake | n8n Code node | Airtable Pipeline read | Identical to 1d |
| Pipeline persistence | n8n Airtable node | — | System of record |
| AI scoring | Evaluator workflow (02) | — | Unchanged; consumes new Source value |
| Area ID reference | hh public API (read-only) | Airtable docs | No auth; IDs copied to docs |

## Standard Stack

### Core (no new npm packages)

| Component | Version / type | Purpose | Why Standard |
|-----------|----------------|---------|--------------|
| n8n `scheduleTrigger` | typeVersion 1.2 (match 01d) | Daily 8:20 + manual | Existing scanner convention |
| n8n `airtable` | typeVersion 2.1 | Profile, Search Queries, Pipeline | Same credentials/base IDs as 01a–1d |
| n8n `splitInBatches` ("Loop Over Items") | typeVersion 3 | One feed URL per iteration | Required for RSS Read multi-feed [CITED: n8n community] |
| n8n `rssFeedRead` | `n8n-nodes-base.rssFeedRead` | Fetch/parse RSS | PROJECT constraint; no custom XML parser |
| n8n `code` | typeVersion 2 | Build feeds, parse, dedupe | All business logic pattern |
| n8n `wait` | typeVersion 1.1, amount 1 | Rate limit between feeds | PROJECT constraint |
| n8n `if` | typeVersion 2.3 | Gate create on `jobId` | Copy 01d |
| hh.ru RSS | `GET /search/vacancy/rss` | Discovery | No API token |
| hh.ru areas API | `GET https://api.hh.ru/areas/{id}` | Area ID reference | Public JSON [VERIFIED: live fetch 2026-06-05] |

### Supporting

| Component | Purpose | When to Use |
|-----------|---------|-------------|
| `encodeURIComponent` in Code node | Build `text=` query param | Always for auto-feeds (D-06) |
| Inline FNV-1a | `jobId` | Same as all scanners; suffix `-hhr` |
| `stripHtml` from 01a Merge Descriptions | Clean description for Pipeline | RSS HTML in CDATA |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| RSS Feed Read | HTTP Request + XML parse Code | Hand-roll XML/encoding; violates Don't Hand-Roll |
| Loop Over Items | Single mega-feed OR query | Loses per-role `Source Query`; >20 mixed results (D-07) |
| HH authenticated API | RSS only | User has no credentials — out of scope |

**Installation:** None — workflow JSON + Airtable config only.

## Package Legitimacy Audit

> Phase installs **no external packages**. No slopcheck/registry gate required.

| Package | Disposition |
|---------|-------------|
| (none) | N/A — n8n built-in nodes only |

## Architecture Patterns

### System Architecture Diagram

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ Airtable                                                                 │
│  Profile (Target Roles, Core Skills, Target Geography)                  │
│  Search Queries (Source Type = 'HH RSS', Enabled)                       │
│  Pipeline (Job ID dedupe target)                                        │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ PAT read/write
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ workflows/01e-scanner-hhru.json                                         │
│                                                                          │
│  [Manual Trigger] [Schedule 8:20]                                       │
│         │                                                                │
│         ▼                                                                │
│  Get Profile ──► Get Search Queries (HH RSS)                            │
│         │                                                                │
│         ▼                                                                │
│  Build Feed List  (auto feeds if RU geo + merge manual queries)         │
│         │                                                                │
│         ▼                                                                │
│  ┌── Loop Over Feeds (batch size 1) ──────────────────────────────┐   │
│  │  RSS Feed Read (url = feedUrl)                                   │   │
│  │       ▼                                                          │   │
│  │  Parse & Filter Jobs (title kw, GEO_MAP, FNV-1a -hhr)           │   │
│  │       ▼                                                          │   │
│  │  Wait 1s ──► (next feed)                                         │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│         │ (loop done)                                                    │
│         ▼                                                                │
│  Aggregate All Jobs ──► Get Existing Job IDs ──► Deduplicate vs Pipeline │
│         ▼                                                                │
│  If (jobId exists) ──► Create Pipeline Records (Source: hh.ru)          │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ Status = New
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ workflows/02-evaluator.json (9:00, unchanged)                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### Recommended Workflow Structure (mirror 01a loop + 01d tail)

| Node | Based on | Notes |
|------|----------|-------|
| Manual Trigger | 01d | |
| Schedule Trigger | 01d | `triggerAtHour: 8`, `triggerAtMinute: 20` |
| Get Profile | 01a | `tbl4hqn6sfFVbLuzd` |
| Get Search Queries | 01d | `filterByFormula`: `=AND({Enabled}=TRUE(),{Source Type}='HH RSS')` |
| Build Feed List | **new** | Outputs **one item per feed** with `{ feedUrl, sourceQuery, sourceTag, titleKeywords, areaId, feedMeta }` |
| Loop Over Feeds | 01a `Loop Companies` | `splitInBatches` v3, batch size **1** |
| RSS Feed Read | — | URL: `={{ $json.feedUrl }}` |
| Parse & Filter Jobs | 01a + 01d | Per-feed; read loop context for query metadata |
| Wait 1s | 01a | Loop back |
| Aggregate All Jobs | 01a | Filter `_empty`, dedupe `jobId` in-run |
| Get Existing Job IDs | 01d | `executeOnce: true`, fields `Job ID` only |
| Deduplicate vs Pipeline | 01d | 100 net-new safety brake |
| If | 01d | `jobId` exists |
| Create Pipeline Records | 01d | Add Source option `hh.ru`; map `salaryInfo` |

**01d difference:** 01d is linear (no loop) because JobSpy sidecar batches HTTP. 01e **must** loop feeds because RSS Read only reliably processes **the first input item** per execution when multiple feed URLs are present [CITED: https://community.n8n.io/t/how-to-create-a-loop-with-rss-node/8369].

### Pattern 1: Build Feed List

**What:** Single Code node merges Profile auto-feeds and Search Query rows into normalized feed descriptors.

**When to use:** After both Airtable reads complete.

**Rules:**
1. `RU_RELEVANT_GEOS = ['Russia', 'Moscow', 'Saint Petersburg', 'Remote Russia']`
2. If Profile `Target Geography` ∩ `RU_RELEVANT_GEOS` is empty → **skip auto-feeds** (HH-09); still process enabled HH RSS Search Queries.
3. Auto-feeds: take first 8 `Target Roles`; for each role build `text` = `role` OR `skill1` OR `skill2` … (all Core Skills); if no skills, `text` = role only.
4. `area` for auto-feeds: `113` if any RU-relevant geo selected (D-08).
5. Search Queries: use `Query String` as full `text=` override if set; else could reuse auto-feed builder — typically user supplies full string. `area` = `Location` if non-empty else same derive as auto-feeds.
6. `feedUrl = 'https://hh.ru/search/vacancy/rss?text=' + encodeURIComponent(text).replace(/%20/g, '%20') + '&area=' + area` — use `encodeURIComponent` (already emits `%20` for spaces per D-06).
7. Emit `[]` with `_empty` if zero feeds.

### Pattern 2: Parse RSS items inside loop

**What:** Code node consumes **all items** from RSS Feed Read for current feed (typically up to ~20).

**n8n RSS output fields (typical):** `title`, `link`, `pubDate`, `content` or `description` (HTML) [MEDIUM confidence — confirm on first n8n execute].

**Geography match:** Build allowed substrings from Profile `Target Geography` via extended `GEO_MAP` (below). Match against parsed **region** + stripped description + title (for Remote Russia).

### Anti-Patterns to Avoid

- **Multiple feed URLs into one RSS Read without loop:** Only first feed fetched [CITED: n8n community].
- **Fan-in multiple Airtable nodes into one Code node:** Causes "node hasn't been executed" (documented in `.planning/codebase/ARCHITECTURE.md`).
- **Using `require('crypto')` for jobId:** Blocked in n8n sandbox — keep inline FNV-1a.
- **NOT/junior tokens in `text=`:** Explicitly deferred; Evaluator handles negatives.
- **Relying on narrow `area=` only:** Remote roles may sit under `area=113`; post-filter required (D-09–D-11).

## hh.ru RSS Specifics

### Endpoint and parameters [VERIFIED: live HTTP 2026-06-05]

| Param | Required | Semantics | Example |
|-------|----------|-----------|---------|
| `text` | Yes (for meaningful results) | hh query language; OR/AND/NOT supported [CITED: https://hh.ru/article/1175] | `python developer`, `Python OR FastAPI` |
| `area` | No | Region filter id; `113` = Russia | `area=113`, `area=1` (Moscow), `area=2` (SPb) |

**Base URL:** `https://hh.ru/search/vacancy/rss`

**Example:** `https://hh.ru/search/vacancy/rss?text=python%20developer&area=113`

### Feed limits and encoding

| Property | Value | Source |
|----------|-------|--------|
| Items per feed | **20** (observed) | Live curl count 2026-06-05 |
| XML encoding | `utf-8` | RSS prolog |
| Item link | `https://hh.ru/vacancy/{id}` | Live sample |
| Invalid `area` | Still HTTP 200 with results [LOW] | `area=999999` returned 20 items — do not depend on API error for validation |

### RSS item fields

| Field | XML path | Use in Pipeline |
|-------|----------|-----------------|
| Title | `<title>` | Job Title |
| Apply link | `<link>` | Apply Link |
| Published | `<pubDate>` | Optional recency logging |
| GUID | `<guid>` | Redundant with link |
| Description | `<description><![CDATA[...]]>` | Parse company/region/salary; strip for Job Description |

### Description HTML structure [VERIFIED: live sample]

Each vacancy summary uses consistent Russian `<p>` lines:

```html
<p>Вакансия компании: {Company}</p>
<p>Создана: {DD.MM.YYYY}</p>
<p>Регион: {Region}</p>
<p>Предполагаемый уровень месячного дохода: {salary or "не указан"}</p>
```

**Parsing approach:** Regex on stripped text (or HTML before strip):

- Company: `/Вакансия компании:\s*(.+)/i`
- Region: `/Регион:\s*(.+)/i`
- Salary: `/Предполагаемый уровень месячного дохода:\s*(.+)/i`

**Location field:** Use parsed **Регион**; fallback `Not specified`.

**Salary Info field:** Parsed salary line; empty if `не указан`.

### Query language (for Build Feed List) [CITED: https://hh.ru/article/1175]

- Default between words = AND; use explicit **`OR`** between role and skills (D-01).
- Quote phrases with `"..."` if multi-word skills need phrase match.
- Do **not** add `NOT` filters in scanner (project decision).
- Skills with `+` (e.g. `c++`) may need quoting per hh rules — test in curl if Profile contains special chars.

### Area IDs [VERIFIED: api.hh.ru 2026-06-05]

| Geography | Airtable option | hh `area` ID |
|-----------|-----------------|--------------|
| Russia | Russia | 113 |
| Moscow | Moscow | 1 |
| Saint Petersburg | Saint Petersburg | 2 |
| Remote Russia | Remote Russia | (no separate id — use 113 + substring filter) |

Reference tree: `GET https://api.hh.ru/areas/113` returns `"name":"Россия"` with nested cities [VERIFIED: live JSON partial].

## GEO_MAP Extensions for RU Geographies

Add to **01e Parse & Filter** (and document in Airtable for HH-07). Use same structure as `01a-scanner-greenhouse.json` — flat substring arrays per geography key.

```javascript
// Append to GEO_MAP in 01e Parse & Filter Jobs
'Russia': [
  'россия', 'russia', 'рф', 'российская федерация',
  'нижний новгород', 'казань', 'новосибирск', 'екатеринбург', 'красноярск',
  'ростов-на-дону', 'самара', 'уфа', 'воронеж', 'пермь', 'волгоград'
],
'Moscow': ['москва', 'moscow', 'мск'],
'Saint Petersburg': [
  'санкт-петербург', 'санкт петербург', 'спб', 'saint petersburg',
  'st. petersburg', 'st petersburg', 'петербург'
],
'Remote Russia': [
  'удаленно', 'удалённо', 'удаленная работа', 'удалённая работа',
  'дистанционно', 'из дома', 'работа на дому', 'remote russia',
  'remote - russia', 'удаленно по россии', 'удалённо по россии',
  'remote', 'удаленка'  // careful: also matches global remote — acceptable when user selected Remote Russia
],
```

**HH-09 guard constant:**

```javascript
const RU_RELEVANT_GEOS = ['Russia', 'Moscow', 'Saint Petersburg', 'Remote Russia'];
const hasRuGeo = userGeographies.some(g => RU_RELEVANT_GEOS.includes(g));
```

**Post-filter:** Union substrings for **all** selected Profile geographies (not only RU), so users with Canada + Russia get both sets — same as 1a behavior when multiple geos selected.

**Remote-only Profile:** Still fetch `area=113`; require match on Remote Russia substrings in region/description/title (D-09).

## Airtable Schema Changes

### Profile — Target Geography (multiple select)

Add options (HH-07):

- Russia
- Moscow
- Saint Petersburg
- Remote Russia

Update `airtable/AIRTABLE-SCHEMA.md` line 44 from Canada/USA-only list to include RU options (keep existing international options).

### Search Queries

| Field | Change |
|-------|--------|
| Source Type | Add option **HH RSS** |
| Location | Document: for HH RSS, plain-text **area ID** (`1`, `2`, `113`), not city name |
| JobSpy Sites, Country Filter, Hours Old, Results Wanted | Document as **JobSpy-only** (ignored for HH RSS) |

Add subsection **Search Queries (HH RSS)** in `AIRTABLE-SCHEMA.md` with example row:

| Query | Source Type | Query String | Title Keywords | Location | Source Tag | Enabled |
|-------|-------------|--------------|----------------|----------|------------|---------|
| Python RU manual | HH RSS | `NAME:(python OR django)` | `senior,lead` | 113 | HH Manual | ✓ |

### Pipeline — Source (single select)

Add option **`hh.ru`** (HH-08). Update workflow JSON `Create Pipeline Records` schema options (mirror 01d LinkedIn/Greenhouse entries).

**Manual Airtable step required** before first successful create — typecast alone may not add new select option in all bases.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| RSS XML fetch/parse | Custom HTTP + xml2js | n8n **RSS Feed Read** | Encoding, entities, item normalization |
| Multi-feed iteration | Parallel RSS without loop | **Loop Over Items** batch 1 | RSS Read first-item limitation |
| Job ID hash | `crypto` module | Inline **FNV-1a** | n8n sandbox blocks `require('crypto')` |
| HTML → text | Regex-only one-liner | Port **stripHtml** from 01a `Merge Descriptions` | Double-encoded entities on hh CDATA |
| hh area tree walk | Runtime API crawl per run | Hardcode **113/1/2** + docs link to api.hh.ru | Stable IDs; public reference |
| Negative filtering RU heuristics | Scanner NOT tokens | Evaluator **Negative Filters** | User preference / HH scope |

**Key insight:** 01e is orchestration glue; reuse proven scanner nodes and only add hh-specific parse + feed builder.

## Common Pitfalls

### Pitfall 1: RSS Read without Loop Over Items
**What goes wrong:** Only first feed URL processed; other roles silent.  
**Why:** RSS Read node behavior with multiple input items [CITED: n8n community].  
**How to avoid:** `splitInBatches` batch size 1; connect Wait → loop back.  
**Warning signs:** `Source Query` always same role; feed count > results diversity.

### Pitfall 2: Expecting >20 new jobs per role per day
**What goes wrong:** Missed vacancies outside RSS window.  
**Why:** ~20 items per feed observed.  
**How to avoid:** One feed per role (D-07); optional extra Search Queries; accept HH-10 for full descriptions later.  
**Warning signs:** Same 20 ids daily.

### Pitfall 3: UTF-8 / Cyrillic mishandling
**What goes wrong:** Mojibake in Pipeline or failed regex.  
**Why:** Russian text in XML and Airtable.  
**How to avoid:** RSS node handles UTF-8; avoid intermediate binary; test with Russian Profile roles.  
**Warning signs:** `Ð` sequences in Job Title.

### Pitfall 4: Geography-only `area=` without post-filter
**What goes wrong:** Remote RU jobs dropped or wrong cities included.  
**Why:** `area=113` is broad; Remote Russia needs substring pass (D-09–D-11).  
**How to avoid:** Always run `GEO_MAP` match on parsed region.  
**Warning signs:** Zero results for Remote Russia-only Profile.

### Pitfall 5: Safety brake during testing
**What goes wrong:** Workflow errors with "exceeds 100 limit."  
**Why:** Copied from 01d dedupe node.  
**How to avoid:** Use narrow Title Keywords in test Profile; expect brake if re-running without dedupe.  
**Warning signs:** Error from `Deduplicate vs Pipeline` Code node.

### Pitfall 6: Stale Mempalace / branch API scanner notes
**What goes wrong:** Planner implements OAuth hh API.  
**Why:** Old `01e` API design superseded by RSS (CONTEXT, PROJECT).  
**How to avoid:** Canonical spec = PROJECT.md + this phase CONTEXT.  
**Warning signs:** References to `hhru/api` tokens in plans.

### Pitfall 7: Invalid area ID silent fallback
**What goes wrong:** Wrong vacancies when user typos Location.  
**Why:** Invalid `area=999999` still returned 200 + items in test.  
**How to avoid:** Document allowed IDs; optional validate Location ∈ {1,2,113} in Build Feed List.  
**Warning signs:** Unexpected CIS cities with nonsense Location.

## Code Examples

### Feed URL builder (Build Feed List)

```javascript
// Source: PROJECT.md + live curl verification 2026-06-05
const BASE = 'https://hh.ru/search/vacancy/rss';

function buildText(role, coreSkills) {
  const skills = Array.isArray(coreSkills) ? coreSkills : [];
  if (skills.length === 0) return role;
  return [role, ...skills].join(' OR '); // D-01
}

function buildFeedUrl(text, areaId) {
  const q = encodeURIComponent(text); // D-06: spaces -> %20
  return `${BASE}?text=${q}&area=${areaId}`;
}

// Example: role + skills, Russia-wide
const text = buildText('Python Developer', ['FastAPI', 'Django']);
const feedUrl = buildFeedUrl(text, '113');
// => https://hh.ru/search/vacancy/rss?text=Python%20Developer%20OR%20FastAPI%20OR%20Django&area=113
```

### Parse snippet (Parse & Filter Jobs — pseudocode)

```javascript
// Source: live RSS sample 2026-06-05 + 01a stripHtml pattern
const stripHtml = /* copy from 01a Merge Descriptions */;

function parseHhDescription(html) {
  const text = stripHtml(html || '');
  const company = (text.match(/Вакансия компании:\s*(.+)/i) || [])[1]?.trim() || 'Unknown';
  const region = (text.match(/Регион:\s*(.+)/i) || [])[1]?.trim() || 'Not specified';
  const salaryRaw = (text.match(/Предполагаемый уровень месячного дохода:\s*(.+)/i) || [])[1]?.trim() || '';
  const salaryInfo = /не указан/i.test(salaryRaw) ? '' : salaryRaw;
  return { company, region, salaryInfo, jobDescription: text };
}

// Per RSS item from n8n:
const title = $json.title;
const applyLink = $json.link;
const { company, region, salaryInfo, jobDescription } = parseHhDescription($json.content || $json.description);

// FNV-1a + '-hhr' (same loop as 01a)
const jobId = fnv1aHash(`${title}|${company}|${applyLink}`) + '-hhr';

// Geography: matchesGeography(region) || matchesGeography(jobDescription) for Remote Russia
// Title keywords: same as 01d — comma-split, any match in title
```

### n8n RSS Feed Read configuration

```json
{
  "parameters": {
    "url": "={{ $json.feedUrl }}"
  },
  "type": "n8n-nodes-base.rssFeedRead",
  "typeVersion": 1
}
```

[CITED: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.rssfeedread/]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| hh API scanner on branch | Public RSS only | 2026-06-05 milestone | No OAuth; thinner descriptions (HH-06) |
| Hardcoded geography in 01d | Dynamic Profile in 01e | Phase 1 | 01e reads Profile like 1a |
| `+` URL encoding | `%20` per D-06 | Phase 1 context | Consistent encodeURIComponent |

**Deprecated/outdated:**
- API-based `01e-scanner-hhru` on `add-hh-ru` branch — superseded by RSS-first PROJECT.md

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | n8n RSS Read outputs one item per RSS `<item>` with `link`, `title`, `description`/`content` | Code Examples | Parser field names wrong — fix on first execute |
| A2 | hh does not enforce strict area ID validation on RSS | hh.ru RSS | Typos return unfiltered results |
| A3 | 20 items/feed is stable cap | Feed limits | May change; monitor item count in logs |
| A4 | No documented RSS rate limit; 1s wait is sufficient | Pitfalls | Possible 429 — increase wait if seen |
| A5 | Evaluator accepts new Source `hh.ru` without code change | Architecture | May need prompt tweak for Russian JDs — out of scope |

## Open Questions

1. **Update Search Queries Last Run / Results Last Run?**
   - What we know: Columns exist; 01d builds `queryMeta` but does not update Airtable in exported JSON.
   - Recommendation: Optional v1.1; not required for HH-01–09.

2. **Exact n8n field name for RSS description**
   - What we know: Official docs only list URL parameter.
   - Recommendation: Log `$json` keys on first manual run; parser checks `content`, `description`, `contentSnippet`.

3. **Cross-feed duplicate vacancies**
   - What we know: Same vacancy may appear in overlapping OR queries.
   - Recommendation: In-run `Set` dedupe by `jobId` in Aggregate (01a pattern).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| curl / HTTP to hh.ru | Research, ops smoke test | ✓ | — | — |
| node | gsd-tools, optional test scripts | ✓ | v24.16.0 | — |
| npm | Not required for phase | ✓ | (nvm) | — |
| python3 | RSS item count scripts | ✓ | homebrew | — |
| n8n instance | Workflow execution | ✗ (not in dev shell) | — | User deployment (Docker/cloud) |
| Airtable PAT | All Airtable nodes | ✗ (credential in n8n) | — | Configure in n8n UI |
| ctx7 CLI | Docs lookup | ✗ | — | WebFetch + live curl used |

**Missing dependencies with no fallback:**
- n8n + Airtable credentials on operator environment (blocking for execute-phase verification)

**Missing dependencies with fallback:**
- ctx7 → official docs + live HTTP verification (done)

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | **None** (manual n8n + curl) — per `.planning/codebase/TESTING.md` |
| Config file | none |
| Quick run command | `curl -sL "https://hh.ru/search/vacancy/rss?text=python%20developer&area=113" \| head -c 4000` |
| Full suite command | Manual: import `01e` → Execute Workflow → inspect Pipeline |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| HH-01 | RSS fetch works | smoke | `curl -sL -o /dev/null -w "%{http_code}" "https://hh.ru/search/vacancy/rss?text=test&area=113"` expect 200 | ❌ Wave 0 |
| HH-02 | Feed list builds 1/role, max 8 | manual | n8n execute + inspect Build Feed List output | ❌ |
| HH-03 | HH RSS queries merged | manual | Enable test row; check loop count | ❌ |
| HH-04 | Parse region/company/salary | unit (recommended) | Extract parse fn → `node test/hh-parse.test.js` | ❌ Wave 0 |
| HH-05 | Dedupe + `-hhr` + schedule | manual | Second run creates 0 duplicates | ❌ |
| HH-06 | Description = stripped RSS | manual | Pipeline Job Description has no `<p>` tags | ❌ |
| HH-07 | RU geo options + filter | manual | Profile Moscow only → mostly Moscow regions | ❌ |
| HH-08 | Source `hh.ru` in Airtable | manual | Create succeeds without typecast error | ❌ |
| HH-09 | No RU geo → no auto feeds | manual | Profile Canada-only → 0 auto feeds; manual HH RSS still runs | ❌ |

### Sampling Rate

- **Per task commit:** curl smoke on one feed URL + JSON workflow lint (valid JSON)
- **Per wave merge:** Full manual n8n execute against test base
- **Phase gate:** `docs/SETUP.md`-style checklist row for 01e; Pipeline rows `Source=hh.ru` before 9:00 Evaluator

### Wave 0 Gaps

- [ ] `scripts/test_hh_rss_parse.mjs` or `tests/hh-rss-parse.test.js` — golden-file parse of captured RSS XML snippet (HH-04)
- [ ] `fixtures/hh-rss-sample.xml` — committed anonymized feed excerpt from research curl
- [ ] `docs/SETUP.md` — add 01e verification step (after 01d, before 02)
- [ ] Optional: `npm test` / pytest harness — not in repo today; Nyquist satisfied via manual + fixture script per TESTING.md recommendation

## Security Domain

### Applicable ASVS Categories (ASVS L1, `security_enforcement: true`)

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | Public RSS; no tokens |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Validate `area` ID whitelist; strip HTML before Airtable; length-cap description (50k like 01d) |
| V6 Cryptography | no | FNV-1a is dedupe hash only, not security |
| V8 Data Protection | partial | Do not log full Airtable PAT; RSS over HTTPS |
| V11 Business Logic | yes | 100 net-new safety brake; HH-09 skip auto feeds |

### Known Threat Patterns

| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| Malicious RSS content (HTML in description) | Tampering | stripHtml; no `eval`; truncate long text |
| SSRF via feed URL | Spoofing | **Only** build URLs from `hh.ru/search/vacancy/rss` template — never pass user freeform URL field |
| Airtable formula injection | Tampering | Search Queries filter uses fixed formula; user Query String goes to URL encode only |
| Rate limit / DoS on hh | Denial | Wait 1s; max ~8 auto + manual queries |
| PII in logs | Information disclosure | n8n execution logs may contain job titles — same as existing scanners |

## Project Constraints (from .cursor/rules/)

No `.cursor/rules/` directory found in repository. Follow `.planning/codebase/CONVENTIONS.md` and `ARCHITECTURE.md`:

- Business logic in n8n Code nodes only
- Title Case node names; reference via `$('Node Name')`
- Sequential Airtable reads before Code nodes that need them
- FNV-1a inline; `-hhr` suffix
- No scanner negative filters

## Sources

### Primary (HIGH confidence)
- Live HTTP `https://hh.ru/search/vacancy/rss?text=python%20developer&area=113` — 20 items, HTML description shape (2026-06-05)
- Live HTTP `https://api.hh.ru/areas/113` — Russia id 113 (2026-06-05)
- `workflows/01d-scanner-jobspy.json` — dedupe, create, schedule pattern
- `workflows/01a-scanner-greenhouse.json` — GEO_MAP, loop, aggregate, stripHtml
- `.planning/phases/01-hh-ru-rss-scanner/01-CONTEXT.md` — locked decisions

### Secondary (MEDIUM confidence)
- https://hh.ru/article/1175 — OR/AND query language
- https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.rssfeedread/ — RSS Read node parameters
- https://community.n8n.io/t/how-to-create-a-loop-with-rss-node/8369 — RSS + Split In Batches requirement

### Tertiary (LOW confidence)
- Invalid area behavior — single test only
- hh RSS rate limits — not documented in sources checked

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — brownfield patterns + live RSS
- Architecture: **HIGH** — direct mirror of 01a + 01d
- Pitfalls: **MEDIUM** — n8n output field names and hh rate limits need runtime confirmation

**Research date:** 2026-06-05  
**Valid until:** 2026-07-05 (stable RSS endpoint); re-verify if hh changes feed format
