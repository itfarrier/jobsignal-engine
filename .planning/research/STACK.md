# Stack Research: hh.ru RSS Query Strategies for 01e Coverage

**Domain:** hh.ru RSS feed query parameters and volume strategies
**Researched:** 2026-06-07
**Confidence:** HIGH (verified against live RSS endpoint + hh.ru official API docs + community reverse engineering)

## Core Problem

The 01e scanner uses `https://hh.ru/search/vacancy/rss?text={role}&area=113` — one RSS feed per Profile Target Role (max 8 feeds, ~20 items/feed = ~160 max). RSS has **no pagination** — you are hard-capped at ~20 items per query URL. `area=113` (Russia) returns the top 20 matches across *all* of Russia, not all Russia vacancies. **This is the root cause of low volume.**

## Recommended RSS Parameter Stack

These parameters are **confirmed working** with `https://hh.ru/search/vacancy/rss` (verified via live curl test + community projects):

| Parameter | Values | Purpose | Effect on Coverage |
|-----------|--------|---------|-------------------|
| `text` | Search query with AND/OR/NOT/NOT/NAME: operators | Free-text search in title, description, company | **Primary lever** — query diversity = more feeds |
| `area` | Numeric region ID (113=Russia, 1=Moscow, 2=SPb) | Geographic scope | **Primary lever** — sub-areas = more feeds |
| `professional_role` | Numeric role ID from `https://api.hh.ru/professional_roles` | Filters by professional role category | **High** — splits one query into multiple targeted feeds |
| `experience` | `noExperience`, `between1And3`, `between3And6`, `moreThan6` | Filters by required experience | **Medium** — 4 segments per role query |
| `work_format` | `ON_SITE`, `REMOTE`, `HYBRID` | Filters by work format | **Medium** — 3 segments per query |
| `employment_form` | `FULL`, `PART`, `PROJECT`, `FLY_IN_FLY_OUT` | Filters by employment type | **Low-Medium** — most roles are FULL |
| `order_by` | `publication_time`, `salary_desc`, `salary_asc`, `relevance` | Sort order | **Low** — doesn't add new items, just reorders |
| `period` | 1–30 (days) | Time window from publication | **Low** — RSS default seems to be ~30d; shorter periods don't help with coverage |
| `search_field` | `name`, `company_name`, `description` | Scopes where `text` matches | **Low** — `name` narrows, `description` broadens but doesn't add unique items |

### Parameter Value Details

**`text` query language (works in RSS):**
- `AND` / `OR` / `NOT` operators
- `NAME:`, `COMPANY_NAME:`, `DESCRIPTION:` field scoping
- `"exact phrase"`, `!exact_form` (disable morphology), `*wildcard`
- Parentheses for grouping: `text=(NAME:"Python developer" OR NAME:"Java developer")`
- Source: [hh.ru knowledge base article 9343](https://feedback.hh.ru/knowledge-base/article/9343)

**`professional_role` values (select IT roles from live API):**

| ID | Role Name | Category |
|----|-----------|----------|
| 10 | Аналитик | Information Technology |
| 150 | Бизнес-аналитик | Information Technology |
| 156 | BI-аналитик, аналитик данных | Information Technology |
| 165 | Дата-сайентист | Information Technology |
| 160 | DevOps-инженер | Information Technology |
| 96 | Программист, разработчик | Information Technology |
| 125 | Технический директор (CTO) | Information Technology |
| 116 | Специалист по информационной безопасности | Information Technology |
| 12 | Арт-директор, креативный директор | Information Technology |
| 34 | Дизайнер, художник | Information Technology |
| 25 | Гейм-дизайнер | Information Technology |
| 36 | Директор по информационным технологиям (CIO) | Information Technology |
| 157 | Руководитель отдела аналитики | Higher Management |

Full list: `GET https://api.hh.ru/professional_roles` (no auth required).

**`experience` values:**
- `noExperience` — Без опыта
- `between1And3` — От 1 года до 3 лет
- `between3And6` — От 3 до 6 лет
- `moreThan6` — Более 6 лет

**`employment_form` values (different from API `employment`):**
- `FULL` — Полная занятость
- `PART` — Частичная занятость
- `PROJECT` — Подработка / проектная работа
- `FLY_IN_FLY_OUT` — Вахта

**`order_by` values:**
- `publication_time` — по дате
- `salary_desc` — по убыванию дохода
- `salary_asc` — по возрастанию дохода
- `relevance` — по соответствию (default)

## Critical Findings

### Finding 1: `professional_role` WORKS in RSS and is the most important untapped parameter

Live test confirmed: `text=developer&area=113&professional_role=160` returns only DevOps-related titles (Junior DevOps, DevOps Engineer, Platform Engineer), while `text=developer&area=113` without the role returns a random mix of graphic designers, procurement managers, drivers, and frontend devs.

**Without professional_role:** RSS with generic `text` produces nondeterministic, low-relevance results because "developer" matches in descriptions across unrelated roles.

**With professional_role:** RSS returns only relevant roles, AND changes the item set. Using professional_role IDs creates **different feeds** with different items.

### Finding 2: area=113 is NOT "all Russia vacancies"

`area=113` returns the top ~20 matches from Russia. It does NOT aggregate sub-areas. A query with `area=1` (Moscow) returns different ~20 items from `area=113`. Sub-areas are **independent feeds** that return different results.

### Finding 3: RSS has NO pagination

No `page` or `per_page` parameter works. Hard cap is ~20 items per feed URL. The only way to get more items is more feed URLs (different parameter combinations).

### Finding 4: hh.ru authenticated API returns 403

Tested: `GET https://api.hh.ru/vacancies?text=python+developer&area=113` returns HTTP 403 without auth. The project decision to avoid the API is correct. **RSS is the only free, auth-free discovery path.**

## Area Hierarchy and IDs

Russia uses a 3-level hierarchy. Reference data is available without auth:

```
GET https://api.hh.ru/areas/113  →  Russia's 88 sub-regions
GET https://api.hh.ru/areas      →  All 9 countries (113=Russia, etc.)
GET https://api.hh.ru/areas/{id} →  Any area's children
```

**Structure:**
```
Russia (113)
├── Республика Марий Эл (1620)       →  34 cities
├── Республика Татарстан (1624)       →  196 cities
├── Удмуртская Республика (1646)      →  93 cities
├── Чувашская Республика (1652)       →  130 cities
├── Забайкальский край (1192)         →  144 cities
├── Иркутская область (1124)          →  108 cities
├── Красноярский край (1146)          →  152 cities
├── Республика Бурятия (1118)         →  68 cities
├── Республика Саха (Якутия) (1174)   →  98 cities
├── Республика Тыва (1169)            →  22 cities
├── ... (88 total)
└── Total: 14,342 cities/settlements across all sub-regions
```

**Area IDs can be fetched dynamically at runtime** from `https://api.hh.ru/areas/113` (no auth, returns JSON). The n8n Code node or a Python sidecar can enumerate these and generate feed URLs.

## Recommended Coverage Strategy (ordered by impact)

### Strategy 1: Replace single `area=113` with sub-region IDs

**Impact: ~88× coverage potential** (88 regions × 20 items = 1,760 max per query variant)

Instead of `area=113`, generate one RSS feed per Russian region (oblast/krai/republic). This is the single highest-impact change.

**Implementation approaches (ordered by complexity):**

**A) Static top-30 region list (recommended for v2.1):**
Hard-code 30 major IT-market regions in the n8n workflow (or Airtable Search Queries). This covers ~95% of IT jobs without the overhead of 88 feeds.

**B) Dynamic enumeration via Code node:**
n8n Code node fetches `https://api.hh.ru/areas/113` → extracts all 88 region IDs → generates feed URLs dynamically.

**C) Python sidecar:**
New minimal Flask endpoint that fetches area data and returns feed URLs. Only if Code node (B) is insufficient.

### Strategy 2: Add `professional_role` to each feed

**Impact: N× coverage (one feed per role ID × region)**

For each Target Role, map to 1–3 relevant `professional_role` IDs and generate a feed per ID × region. This creates independent feeds with different items than text-only queries.

### Strategy 3: Add query diversity per role

**Impact: 2–3× coverage**

For each Target Role, generate multiple `text` values:
- English name: `text=Python+developer`
- Russian name: `text=Python-разработчик`
- Abbreviation/keyword: `text=Django`

Use OR in single query: `text=(NAME:"Python developer" OR NAME:Python-разработчик)`

### Strategy 4: Split by experience level

**Impact: up to 4× per role**

For high-volume roles, split into 4 experience levels:
- `experience=noExperience`
- `experience=between1And3`
- `experience=between3And6`
- `experience=moreThan6`

Each experience level returns different items (junior vs senior jobs).

### Strategy 5: Split by work format

**Impact: up to 3× per role**

- `work_format=REMOTE`
- `work_format=ON_SITE`
- `work_format=HYBRID`

Useful for roles where remote is common. Less overlap than experience split.

## Coverage Math (Conservative Estimate)

| Strategy | Feeds per Role | Items per Run | Net New (after dedup) |
|----------|---------------|---------------|----------------------|
| Current (v1.0): `area=113` | 1 | ~20 | ~15 |
| + 30 major regions (Strat 1) | 30 | ~600 | ~250-350 |
| + 3 role IDs × 30 regions (Strat 2) | 90 | ~1,800 | ~500-700 |
| + 2 query variants × 30 × 3 (Strat 1+2+3) | 180 | ~3,600 | ~600-800 |
| + 4 experience levels (Strat 4) | 720 | ~14,400 | ~800-1,200 |

**Practical recommendation:** Start with Strategy 1 (30 regions) + Strategy 2 (role IDs). This gives ~600-900 raw items, ~350-500 net new. Stay within the 100 net-new safety brake initially, then adjust.

## Constraint Analysis

| Constraint | Impact on Strategy |
|------------|-------------------|
| No API tokens | ✅ RSS-only approach; API confirmed 403 without auth |
| 100 net-new max per run | ✅ Safety brake can be raised (current 100 is conservative for hh.ru) |
| 1s wait between feed requests | Feasible: 30 feeds × 1s = 30s; 90 feeds = 90s; 180 feeds = 3min |
| 8:20 schedule window (before 9:00 evaluator) | ✅ 180 feeds at 1s = 3min RSS fetch, well within 40min window |
| $0 marginal cost | ✅ All strategies use RSS only, no new services |
| FNV-1a dedup already works | ✅ No changes needed — Pipeline dedup handles cross-feed duplicates |
| n8n workflow JSON | ✅ All strategies implementable via n8n native nodes (no new platforms) |

## What NOT to Use

| Technology | Why Avoid | Use Instead |
|------------|-----------|-------------|
| `https://api.hh.ru/vacancies` (authenticated API) | Returns HTTP 403 without auth token; user cannot obtain credentials | RSS at `https://hh.ru/search/vacancy/rss` |
| `https://api.hh.ru/vacancies` with fake auth | Will be blocked/rate-limited; violates ToS | RSS (free, no auth) |
| HTML scraping of hh.ru search page | Fragile (page structure changes), easily blocked by captcha/rate limits, 1MB+ per page download | RSS (structured XML, ~10KB per response) |
| Third-party paid scrapers (Apify, etc.) | Ongoing cost; violates $0 marginal cost constraint | RSS (free, sufficient for discovery) |
| Browser automation (Playwright/Puppeteer) | Heavy resource usage; OOS per PROJECT.md | RSS (lightweight HTTP GET) |

## Why Not HTML Search Page

The HTML search page (`https://hh.ru/search/vacancy?text=...`) returns a full 1MB+ page with all CSS/JS/HTML overhead. It requires HTML parsing, is fragile to layout changes, and hh.ru actively rate-limits automated browsers. The RSS endpoint returns ~10KB of clean XML. For discovery purposes, RSS is strictly superior to HTML scraping.

## Implementation Notes

### Existing unchanged stack (confirmed OK):
- n8n `RSS Feed Read` node
- n8n Code nodes v2 for data transformation
- Airtable API for profile/queries
- FNV-1a hashing for dedup
- Pipeline document ingestion

### What changes in 01e:
The workflow's feed generation logic must be modified to:
1. Accept additional parameters (`professional_role`, `experience`, `work_format`, `employment_form`, `order_by`)
2. Generate multiple feed URLs per target role (not just one)
3. Optionally enumerate region IDs from `https://api.hh.ru/areas/113`

### n8n implementation patterns:
- **Code node** can generate the parameter permutations as an array of URL strings
- **Loop Over Items** node iterates each generated URL
- **Wait** node (1s) between feed requests
- **RSS Feed Read** node fetches each feed (same as current)

## Verification Approach

For each strategy implemented, verify coverage improvement:

1. **Run diagnostic** (as planned in HH-12): Count current items per feed, log the count
2. **Implement change** (HH-13): Add new feeds with additional parameters
3. **Measure** (HH-14): Compare item count before/after in the same run window
4. **Target:** At minimum 3× improvement (from ~160 to ~500+ raw items per run)

## Sources

- `https://hh.ru/search/vacancy/rss?text=python+developer&area=113` — Live test of RSS endpoint (2026-06-07) confirmed 20 items
- `https://hh.ru/search/vacancy/rss?text=developer&area=113&professional_role=160` — Live test confirmed professional_role filtering works
- `https://api.hh.ru/areas/113` — Area hierarchy JSON (no auth required) — 88 sub-regions, 14,342 cities
- `https://api.hh.ru/professional_roles` — Professional role dictionary (no auth required)
- `https://api.hh.ru/dictionaries` — `vacancy_search_order`, `vacancy_search_fields`, `employment`, `schedule`, `experience` value dictionaries
- `github.com/selvnv/subscribe_job_rss` — Community RSS subscription project confirming `work_format`, `employment_form`, `experience` RSS parameters
- `github.com/hhru/api/blob/master/docs/vacancies.md` — Official API docs (parameter semantics carry to RSS)
- `github.com/feildmaster/HeadHunter-API/blob/master/docs/vacancies.md` — Unofficial API parameter documentation
- `feedback.hh.ru/knowledge-base/article/9343` — Official hh.ru query language documentation
- HTTP 403 verification: `curl https://api.hh.ru/vacancies?text=test&area=113` returns 403 (2026-06-07)

---

*Stack research for: hh.ru RSS coverage improvement (01e scanner)*
*Researched: 2026-06-07*
