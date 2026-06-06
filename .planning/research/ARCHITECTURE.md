# Architecture Research — 01e hh.ru RSS Scanner Coverage Improvement

**Domain:** Multi-feed RSS job scanner (n8n workflow)
**Researched:** 2026-06-07
**Confidence:** HIGH (empirically verified with live hh.ru RSS)

## System Overview

### Current Flow (v1.0–v2.0 baseline)

```
Manual/Schedule Trigger
    ↓
Get Profile (Airtable: Profile row)
    ↓
Get Search Queries (Airtable: Search Queries WHERE Enabled=1 AND Source Type='HH RSS')
    ↓
Build Feed List (Code node)
    │  ┌─ Profile Auto-feeds: 1 feed per Target Role, area=113, text = role + OR skills
    │  └─ Search Queries: 1 feed per enabled HH RSS row, area from row.Location or 113
    ↓
Loop Over Feeds (batch=1)
    ├──→ RSS Feed Read (native rssFeedRead node)
    │       ↓
    │   Parse & Filter Jobs (Code node: FNV-1a, geography filter, title keyword filter)
    │       ↓
    │   Loop Over Jobs (batch=1) ──→ Fetch Vacancy Page → Merge Descriptions → Wait 1s
    └──→ Wait 1s (inter-feed pacing)
            ↓
Aggregate All Jobs (dedup by jobId within run)
    ↓
Get Existing Job IDs (Airtable: Pipeline)
    ↓
Deduplicate vs Pipeline (net-new filter + 100 safety brake)
    ↓
If (has jobId) → Create Pipeline Records
```

### Verified hh.ru RSS Behavioral Facts

All findings confirmed via live curl tests on 2026-06-07:

| Behavior | Evidence |
|----------|----------|
| **20 items max per RSS feed** | `area=1`, `area=2`, `area=113` each return exactly 20 `<item>` elements regardless of query text |
| **No pagination** | `&page=0`, `&page=1`, `&page=5` return identical 20-item sets. `&per_page=50` and `&items_on_page=50` ignored |
| **Per-area results differ** | `area=1` (Moscow) vs `area=2` (SPb) vs `area=113` (Russia) return different primary sets with some overlap |
| **Query text changes results** | `python` vs `python+senior` vs `python+junior` each return different 20-item sets |
| **RSS description format** | Structured CDATA: company via `Вакансия компании:`, region via `Регион:`, salary via `Предполагаемый уровень месячного дохода:` |
| **Rate limiting** | No documented rate limit; aggressive requests may still trigger throttling (untested) |

### Root Cause of Low Volume

The current architecture generates **at most 1 feed per Target Role** (up to 8 feeds) plus Search Queries rows. With a hard cap of 20 items/feed and geography filtering removing some, the upper bound per run is ~160 raw items before filtering. After dedup + geography filtering, the practical yield is much lower.

## Recommended Architecture: Multi-Feed Strategy

### Component Diagram (Proposed Changes Highlighted)

```
Legend: [unchanged] → [MODIFIED] → [NEW]
                                       ┌──────────────────────────┐
                                       │    GEN-AREA-RULES        │
                                       │    (new Code node)       │
                                       └───────────┬──────────────┘
                                                   │ area ID list
                                                   ↓
Get Profile → Get Search Queries → BUILD FEED LIST* → Loop Over Feeds (batch=1)
                                       │                 ├──→ RSS Feed Read
                                       │                 │       ↓
                                       │  *generates:     │   PARSE & FILTER*
                                       │  - 1 feed/role/  │   (feedMeta passthrough,
                                       │    area combo    │    keep existing filters)
                                       │  - 2 query       │       ↓
                                       │    variants/role │   Loop Over Jobs
                                       │  - Search Query  │       ↓
                                       │    rows pass thru│   Fetch/Merge/Wait
                                       └─────────────────┘       ↓
                                                            Wait 1s
                                                               ↓
                                                      AGGREGATE ALL JOBS (unchanged)
                                                               ↓
                                                      GET EXISTING JOB IDS (unchanged)
                                                               ↓
                                                      DEDUPLICATE VS PIPELINE (unchanged)
                                                               ↓
                                                      IF → Create Pipeline Records (unchanged)
```

### Feed Generation Strategy (What Changes in Build Feed List)

The single Code node `Build Feed List` gets three new strategies. Each strategy adds more feed rows to the output array:

#### Strategy A: Area Enumeration (HIGHEST IMPACT)

**What:** Instead of always using `area=113`, generate one feed per role per relevant RU geography.

**Area mapping from Profile `Target Geography`:**

| Profile Geo Value | hh.ru Area ID | Region |
|---|---|---|
| `Russia` | `113` | All Russia (broadest) |
| `Moscow` | `1` | Moscow + Moscow Oblast |
| `Saint Petersburg` | `2` | Saint Petersburg + Leningrad Oblast |
| `Remote Russia` | `113` | No separate area; treat as Russia-wide |

**Why it works:** Each area returns a different 20-item set. Moscow-only vacancies may not appear in `area=113` results if hh.ru ranks by relevance differently per area. Live testing confirms per-area sets differ. If user has `Russia` + `Moscow` + `Saint Petersburg` in Target Geography, each role gets 3 feeds instead of 1.

**Feed count impact:** 8 roles × up to 3 areas = up to 24 area-combo feeds.

#### Strategy B: Query Variants (MEDIUM IMPACT)

**What:** Generate two different query texts per role instead of one.

| Variant | Query Text | Intent |
|---|---|---|
| `role_only` | `role` (e.g., "Python Developer") | Broadest title match |
| `role_skills` | `role skill1 skill2` (e.g., "Python Developer FastAPI PostgreSQL") | More targeted, different ranking |

**Why it works:** hh.ru treats space-separated terms as a search query, returning different result rankings than the OR-skills formulation. The current code uses `buildText(role, coreSkills)` which OR's everything — too broad for title-focused matching. The `role_only` variant matches exact title intent better.

**Feed count impact:** 2× multiplier on area-combo feeds.

**Note:** Do NOT generate a separate feed per individual skill (e.g., role + skill1, role + skill2). That's N² explosion with diminishing returns. Two variants (broad + targeted) is sufficient.

#### Strategy C: Search Queries Pass-Through (UNCHANGED LOGIC)

Already works as-is. Each enabled `HH RSS` row in Search Queries generates one feed using the `Query String` + `Location` fields. The `Location` field already passes through to `resolveArea()` correctly. Enhancement: document that Location can be `1`, `2`, or `113`.

#### Feed Count Budget

| Source | Base Count | Max After Strategy |
|---|---|---|
| Profile Auto-feeds (roles × areas × variants) | 8 | 8 × 3 × 2 = **48** |
| Search Queries | N (user-configured) | N (unchanged) |
| **Total before cap** | 8 + N | 48 + N |
| **Hard cap** | — | **40** (implemented in Build Feed List) |

**Cap rationale:** At 1s wait/feed, 40 feeds = ~40s of feed reads + 20 items/feed × up to 800 raw items. Realistic net-new after dedup stays under 100 safety brake. Runtime increase: from ~20s to ~40s for the feed loop, plus vacancy fetches scale with unique items.

### What Changes in Parse & Filter Jobs

**Minimal changes required.** The existing logic is correct for the multi-feed world:

| Concern | Current Behavior | Adequate? |
|---|---|---|
| Geography filtering | Checks `allowedLocationKeywords` against title/region/description | Yes — acts as safety net for area-specific feeds |
| FNV-1a hashing | `title + company + applyLink` | Yes — stable across feeds |
| Title keyword filter | `titleKeywords` from feed row | Yes — still useful |
| Feed metadata | Reads `sourceQuery`, `sourceTag` from feed item | Yes — adds `feedMeta` passthrough |
| Dedup within feed | Per-feed `seen` Set | Yes — per-feed dedup stays |

**Only change:** Add `feedMeta` passthrough to output items for diagnostic tracking:

```javascript
// In Parse & Filter Jobs, add to the output item:
out.push({
  json: {
    // ... existing fields ...
    feedMeta: feedItem.feedMeta || {},  // NEW — for diagnostics
  }
});
```

### What Does NOT Change

| Node | Status | Rationale |
|---|---|---|
| `Aggregate All Jobs` | **Unchanged** | Already deduplicates by jobId across all feeds within a run |
| `Loop Over Feeds` | **Unchanged** | batch=1 is correct; more feeds just mean more iterations |
| `Loop Over Jobs` | **Unchanged** | batch=1 per vacancy; pacing correct |
| `RSS Feed Read` | **Unchanged** | Reads whatever URL it receives |
| `Fetch Vacancy Page` | **Unchanged** | Handles per-vacancy HTML fetch |
| `Merge Descriptions` | **Unchanged** | JSON-LD / data-qa / RSS fallback pipeline |
| `Get Existing Job IDs` | **Unchanged** | Queries Pipeline for existing Job IDs |
| `Deduplicate vs Pipeline` | **Unchanged** | Net-new filter + 100 safety brake |
| `Create Pipeline Records` | **Unchanged** | Field schema identical |
| All Wait nodes | **Unchanged** | 1s inter-feed + 1s inter-vacancy pacing |

## Data Flow

### Feed-to-Item Relationship

```
Build Feed List (1 row = 1 feed)
    │
Loop Over Feeds (iterates per-feed)
    │
    ├── RSS Feed Read → 0-20 items
    │       │
    │       └── Parse & Filter → 0-20 parsed items
    │               │
    │               └── each item carries:
    │                     - jobId (FNV-1a)
    │                     - sourceQuery (which query text matched)
    │                     - sourceTag ('Profile Auto-feed' or Search Query name)
    │                     - feedMeta (diagnostics: { type, role, area, strategy })
    │
    └── Wait 1s → next feed

Aggregate All Jobs
    │ collects ALL parsed items from ALL feeds
    │ deduplicates by jobId across all feeds
    │ → same vacancy appearing in area=1 + area=113 is deduplicated

Deduplicate vs Pipeline
    │ filters against existing Pipeline Job IDs
    │ → 100 safety brake still applies
```

### Key Data Flow Properties

- **Same vacancy can appear in multiple feeds** (e.g., Moscow Python Dev appears in `area=1` AND `area=113` AND `role_only` AND `role_skills` variants)
- **Dedup chain handles duplicates at two levels:** Aggregate All Jobs (intra-run) removes duplicates within the same run; Deduplicate vs Pipeline (cross-run) removes duplicates from previous runs
- **FNV-1a key is stable** because it uses `title + company + applyLink` — these are identical regardless of which feed found the vacancy
- **No Pipeline schema changes needed** — `Source Query` and `Source Tag` already exist

### Dedup Safety

No risk of double-insertion or missed cross-feed dedup. The flow is:

1. Inside Parse & Filter: `seen` Set deduplicates within a single feed's 20 items
2. Aggregate All Jobs: `seen` Set deduplicates across all feeds (all items from all feeds land here)
3. Deduplicate vs Pipeline: filters against existing Pipeline records (cross-run)

## Component Boundaries

| Component | Responsibility | Communication |
|-----------|---------------|---------------|
| `Build Feed List` (modified) | Generate feed URLs using area enumeration + query variants | Input: Profile + Search Queries. Output: feed rows → Loop Over Feeds |
| `Parse & Filter Jobs` (modified) | Parse RSS, geography filter, FNV-1a hash, pass feedMeta | Input: RSS item + feed metadata. Output: job objects → Loop Over Jobs |
| `Aggregate All Jobs` | Intra-run deduplication | Input: all parsed jobs from all feeds. Output: deduplicated list |
| `Deduplicate vs Pipeline` | Cross-run dedup + safety brake | Input: aggregated jobs + existing Pipeline IDs. Output: net-new list |

## Feed Budget and Runtime

### Worst-Case Estimate

| Scenario | Feeds | Feed Loop Time | Vacancy Fetches | Total Time (est) |
|---|---|---|---|---|
| Current (8 roles, 1 area, no variants) | 8 | ~10s | 8-80 | ~20-90s |
| Improved (8 roles, 3 areas, 2 variants) | 48 → capped at **40** | ~42s | 40-200 | ~80-250s |
| Conservative (5 roles, 2 areas, 1 variant) | 10 | ~12s | 10-100 | ~25-110s |

**Note:** Vacancy fetch loop is per-vacancy with 1s wait. If 40 feeds each produce 20 unique items (800 total), but most overlap, realistic unique count is 40-200 per run. At 1s/vacancy + HTML fetch time (~2-5s), the tightest bottleneck is the vacancy enrichment loop, not the feed loop.

### Runtime Governors Already in Place

- 1s `Wait` between feed reads (inter-feed pacing)
- 1s `Wait` between vacancy fetches (inter-vacancy pacing)
- `batch=1` on both Loop Over Feeds and Loop Over Jobs
- 100 net-new safety brake caps Pipeline writes
- 10s timeout on HTTP vacancy fetch

### Recommended Feed Cap Calculation

```javascript
const MAX_FEEDS = 40; // hard cap to prevent runaway runtime

// After generating all feed variants:
if (feeds.length > MAX_FEEDS) {
  // Priority: Search Queries first (user-intended), then role-only over role+skills,
  // then area=113 over area=1/2
  feeds.sort((a, b) => {
    const aPriority = (a.feedMeta.type === 'search_query' ? 0 : a.feedMeta.strategy === 'role_only' ? 1 : 2);
    const bPriority = (b.feedMeta.type === 'search_query' ? 0 : b.feedMeta.strategy === 'role_only' ? 1 : 2);
    return aPriority - bPriority;
  });
  feeds.splice(MAX_FEEDS);
}
```

## Area Enumeration Logic

### Profile-to-Area Mapping

The new `GEN-AREA-RULES` Code node (or inline logic in `Build Feed List`):

```javascript
// Map Profile Target Geography to hh.ru area IDs for feed generation
const GEO_TO_AREA = {
  'Russia': ['113'],
  'Moscow': ['1'],
  'Saint Petersburg': ['2'],
  'Remote Russia': ['113'], // Remote = country-wide
};

// Collect areas from user's Target Geography
const areasToScan = new Set();
for (const geo of userGeographies) {
  const areaIds = GEO_TO_AREA[geo] || [];
  areaIds.forEach(id => areasToScan.add(id));
}

// Always include 113 as fallback if nothing matched
if (areasToScan.size === 0) areasToScan.add('113');
```

This is a simple lookup table. No API calls required.

### hh.ru Area ID Reference

Mapped from public `https://api.hh.ru/areas/113` (auth-free):

| ID | Region | Purpose |
|----|--------|---------|
| `113` | Russia (вся Россия) | Default, catch-all from current code |
| `1` | Moscow (Москва) | Moscow-specific vacancies |
| `2` | Saint Petersburg (Санкт-Петербург) | SPB-specific vacancies |

Additional sub-areas of 113 (e.g., `3` = Ekaterinburg, `4` = Novosibirsk, `88` = Kazan, `96` = Krasnodar, `104` = Tatarstan) could be added later via Search Queries table. Auto-generating feeds for all 85+ sub-areas is excessive for v2.1.

## Query Variant Strategy

### Current Query Text

```javascript
const buildText = (role, skills) => {
  return [role, ...skills].filter(Boolean).join(' OR ');
};
// Produces: "Python Developer OR FastAPI OR PostgreSQL OR Docker"
// → Single feed with very broad query
```

### Proposed Query Variants

```javascript
const makeQueryVariants = (role, skills) => {
  const roleStr = String(role || '').trim();
  if (!roleStr) return [];
  const skillParts = (Array.isArray(skills) ? skills : [])
    .map(s => String(s || '').trim())
    .filter(s => s.length > 0);
  return [
    {
      text: roleStr,                                    // "Python Developer"
      strategy: 'role_only',
    },
    {
      text: [roleStr, ...skillParts].join(' '),          // "Python Developer FastAPI PostgreSQL"
      strategy: 'role_skills',
    },
  ];
};
```

**Why not more variants?** Each additional variant adds 20 items that largely overlap with other variants. Two variants (broad name match + targeted skills match) capture most unique items without the N² explosion of per-skill feeds.

## Search Queries Table Enhancement

### Current Schema (already works)

| Column | Type | Usage |
|--------|------|-------|
| `Enabled` | Checkbox | Filter in Get Search Queries |
| `Source Type` | Select | `= 'HH RSS'` in Airtable filter |
| `Query String` | Text | RSS `text=` parameter |
| `Query` / `Query Name` | Text | Source tag fallback |
| `Location` | Text | Passed to `resolveArea()` → area ID |
| `Title Keywords` | Text | Comma-separated title filter |

### Documentation Addition (No Schema Change Needed)

Document in Airtable schema that `Location` for HH RSS accepts:
- `113` — Russia (default)
- `1` — Moscow
- `2` — Saint Petersburg
- Any valid hh.ru area ID

Users can already override area per Search Query row. This is just a documentation gap.

## Rate/Safety Limit Analysis

### Current Limits

| Limit | Scope | Value | Hard/Soft |
|-------|-------|-------|-----------|
| Safety brake | Net-new per run | 100 | Hard (throw) |
| Inter-feed wait | Between RSS reads | 1s | Hard (Wait node) |
| Inter-vacancy wait | Between HTML fetches | 1s | Hard (Wait node) |
| HTTP timeout | Vacancy fetch | 10s | Hard (node config) |
| Vacancy fetch retry | Transient failures | onError=continue | Soft |

### What Changes

| Limit | Current | Proposed | Rationale |
|-------|---------|----------|-----------|
| Max feeds | Unlimited | **40** (hard cap in Build Feed List) | Prevent runaway runtime |
| Safety brake | 100 net-new | 100 net-new (unchanged) | Already adequate for 20× cap |
| Inter-feed wait | 1s | 1s (unchanged) | Keep conservative pacing |
| Inter-vacancy wait | 1s | 1s (unchanged) | Keep conservative pacing |

### hh.ru Throttling Risk

- RSS endpoint is public (no auth required) — same rate limiting scope as browser users
- 40 feeds × 1s spacing = 40s window = 1 request/second → well within polite scraping norms
- No `Retry-After` observed during testing at this rate
- If throttling is observed: add jitter (0.5–1.5s random range) and reduce feed cap to 20

## Integration Points

### Modified Nodes

| Node | What Changes | Risk |
|------|-------------|------|
| `Build Feed List` | Add area enumeration + query variants + cap logic | LOW — same Code node, same inputs, more output rows |
| `Parse & Filter Jobs` | Add `feedMeta` passthrough to output items | LOW — additive field, no existing code path changes |

### Unchanged Nodes

| Node | Why No Change |
|------|---------------|
| `Get Profile` | Already returns all needed fields (Target Roles, Core Skills, Target Geography) |
| `Get Search Queries` | Already filters by `Enabled + Source Type = HH RSS` |
| `RSS Feed Read` | Reads whatever URL it receives — no change needed |
| `Loop Over Feeds` | batch=1 unchanged; more feeds = more iterations naturally |
| `Loop Over Jobs` | No change needed |
| `Fetch Vacancy Page` | No change needed |
| `Merge Descriptions` | No change needed |
| All Wait nodes | No change needed |
| `Aggregate All Jobs` | Already deduplicates by jobId across all items |
| `Get Existing Job IDs` | No change needed |
| `Deduplicate vs Pipeline` | No change needed |
| `Create Pipeline Records` | No change needed |

### Downstream Components (No Impact)

| Component | Why Unaffected |
|-----------|----------------|
| Evaluator (02) | Reads Pipeline `Status = New` — no schema change |
| Tailor (03) | Reads Pipeline `Fit Tier = High` — no schema change |
| Alerter (06) | Reads Pipeline summary fields — no schema change |
| Housekeeper (04) | Reads Pipeline `Status` — no schema change |
| Other scanners (01a–01d) | Independent workflows — no shared state |

## Anti-Patterns to Avoid

### 1. Per-Skill Feed Explosion

**What:** Generating one feed per individual skill per role (e.g., "Python Developer FastAPI", "Python Developer PostgreSQL", "Python Developer Docker").

**Why it is wrong:** 8 roles × 5 skills each × 3 areas = 120 feeds, mostly overlapping results. Same vacancy appears in every skill variant. Feed count blows past budget. Runtime increases linearly with feeds but unique yield plateaus after 2 variants.

**Do this instead:** Two variants only — `role_only` (broadest) and `role_skills` (targeted).

### 2. Removing Geography Filter from Parse & Filter

**What:** Skipping the geography filter because "area-specific feeds already handle it."

**Why it is wrong:** `area=113` returns vacancies from ALL of Russia. Without the geography filter, a user who only wants Moscow would still get Yakutsk and Kaliningrad vacancies from the area=113 feed.

**Do this instead:** Keep geography filter in Parse & Filter. It acts as a safety net for the catch-all area=113 feed. For area=1 and area=2 feeds, the filter is redundant but harmless.

### 3. Async Parallel Feed Fetching

**What:** Firing all 40 RSS feeds simultaneously to reduce wall-clock time.

**Why it is wrong:** n8n `splitInBatches` is inherently sequential within a single workflow branch. Parallel fan-out requires separate workflow triggers or sub-workflow nodes (complicates architecture). Also risks hh.ru throttling.

**Do this instead:** Accept the sequential pacing. 40 feeds × 1s = 40 seconds is acceptable for a daily scheduled workflow.

### 4. Hardcoding All 85+ hh.ru Sub-Areas

**What:** Auto-generating feeds for every area under `113` (Moscow, SPb, Ekaterinburg, Novosibirsk, Kazan, Krasnodar, etc.).

**Why it is wrong:** 85+ feeds × 8 roles × 2 variants = 1360 feeds. Runtime ~23 minutes just for feed reads. Massive overlap between adjacent areas. Overwhelming majority of vacancies are in Moscow/SPb anyway.

**Do this instead:** Only enumerate areas explicitly in Profile `Target Geography`. Users add specific sub-areas via Search Queries if they want niche regional coverage.

## Build Order for Implementation

**Phase 1: Diagnose (before any code changes)**
1. Run 01e workflow with execution logging enabled
2. Record current: number of feeds generated, items per feed, items after geography filter, items after dedup, net-new Pipeline records
3. Export execution data as baseline

**Phase 2: Build Feed List — Area Enumeration + Query Variants**
1. Modify `Build Feed List` Code node to accept area enumeration logic
2. Add `GEO_TO_AREA` mapping table
3. Add `makeQueryVariants()` function
4. Add feed cap (40) with sorting priority
5. Add `feedMeta.strategy` to each feed row
6. **Test:** Export feed list output, verify counts and URLs

**Phase 3: Parse & Filter — feedMeta Passthrough**
1. Add `feedMeta: feedItem.feedMeta || {}` to output items
2. **Test:** Verify feedMeta appears on Pipeline records for diagnostics

**Phase 4: Verify Coverage Improvement**
1. Run 01e workflow with same Profile and Search Queries as baseline
2. Compare: feeds generated, items aggregated, net-new Pipeline records
3. If coverage improved by measurable margin → ship
4. If not → iterate query variant strategies (add `role_seniority` variant, adjust area list)

## Sources

- Live hh.ru RSS testing (`curl` to `https://hh.ru/search/vacancy/rss?text=...&area=...`) on 2026-06-07 — HIGH confidence
- Existing `01e-scanner-hhru.json` workflow code analysis — HIGH confidence
- [hh.ru API docs (public reference for area IDs)](https://api.hh.ru/areas/113) — auth-free, used for area enumeration — MEDIUM confidence (RSS-specific behavior not documented)
- [hh.ru API vacancies search documentation](https://github.com/hhru/api/blob/master/docs/vacancies.md) — search query language reference — MEDIUM confidence (API differs from RSS)

---

*Architecture research for: 01e hh.ru RSS scanner coverage improvement*
*Researched: 2026-06-07*
