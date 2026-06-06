# Feature Research: hh.ru RSS Vacancy Volume Strategies

**Domain:** Job discovery from hh.ru public RSS
**Researched:** 2026-06-07
**Confidence:** MEDIUM (RSS endpoint behavior of some params needs live verification)
**Mode:** Ecosystem — query strategies / volume levers

## Feature Landscape

### Table Stakes (Users Expect These)

Features necessary for minimal hh.ru coverage.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| One RSS feed per Target Role | Must match Profile-defined roles with ~20 items/feed | LOW | Already shipped in 01e via `buildText()` |
| Manual Search Queries override | User needs to test/supplement auto-feeds without editing workflow | LOW | Already shipped — `Source Type = 'HH RSS'` in Search Queries table |
| Geography mapping via Target Geography | Must respect user location preference for Russia | LOW | Already shipped — `GEO_MAP`, `RU_RELEVANT_GEOS`, area resolver |
| Dedup (FNV-1a + -hhr suffix) | Repeated runs must not flood Pipeline | LOW | Already shipped |
| 100 net-new safety brake | Prevent runaway discovery | LOW | Already shipped |
| Description enrichment (HTML fetch) | RSS descriptions are thin; need full JD | MEDIUM | Already shipped v2.0 (JSON-LD + data-qa fallback) |

### Differentiators (Strategies That Beat Naive Single-Feed-Per-Role)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Sub-area parallel feeds | Each RSS feed returns ~20 items; area=113 may not surface regional vacancies in its top-20. Queries against Moscow (1), SPb (2), and major cities IN ADDITION TO area=113 increases unique count multiplicatively. | MEDIUM | **Highest-impact single lever.** Each sub-area feed = ~20 more items that may not appear in area=113's top 20. Adds feed count linearly; volume multiplies. |
| Query diversity per role (RU/EN synonyms) | Single role name misses Russian/English variations ("Python Developer" vs "Python-разработчик" vs "Backend Engineer"). Multiple phrasings per role = different result sets. | LOW | Can generate 2–3 feeds per role: EN, RU, RU+EN combined. Minimal code change in `Build Feed List`. |
| Seniority/experience-split feeds | A single feed mixes all seniority levels. Splitting by `experience=noExperience`, `between1And3`, `between3And6`, `moreThan6` surfaces roles that get buried in generic feed. | LOW | Add `&experience=X` to URL. Each seniority band gets its own ~20 items. Requires more feed loops but trivial code. |
| Work format split feeds | Remote vs on-site vs hybrid vacancies are distinct categories. Separate feeds catch remote roles the broad feed may deprioritize. | LOW | Add `&work_format=REMOTE`, `&work_format=ON_SITE`, `&work_format=HYBRID`. |
| Title-scoped exact feeds (`NAME:` operator) | Using `NAME:(role_name)` in `text` parameter restricts search to title-only, catching roles the description-based broad feed misses (or over-filters). | LOW | Use query language operator `NAME:` prefix. Good complement to broad feed, not replacement. |
| `no_magic=true` feeds (opposite-of-default) | Default magic = synonym expansion. Adding a `no_magic=true` version of the same query forces exact title/keyword matching, surfacing niche roles that magic's synonym mapping might exclude. | LOW | Only valuable AS A SUPPLEMENT to default-magic feeds. Standalone reduces volume. |
| `professional_role` ID feeds | Category-based taxonomy (e.g., ID 96 = "Программист") matches by role category, not just keywords. May surface relevant jobs with different title phrasings. | MEDIUM | **Needs RSS verification.** Works in REST API (`/vacancies`), likely in RSS but unconfirmed. Requires fetching role ID list from `api.hh.ru/professional_roles`. |
| Employment type split feeds | Full-time, part-time, project, volunteer, internship vacancies are separate pools. | LOW | `&employment_form=FULL`, `&employment_form=PART`, `&employment_form=PROJECT` etc. One URL change per feed. |

### Anti-Features (What NOT to Do)

| Feature | Why Requested | Why Problematic | Better Approach |
|---------|---------------|-----------------|-----------------|
| `search_field=name` on current OR-skill queries | "Title-only search is more precise" | Current query is `role_name OR skill1 OR skill2`; `search_field=name` means skills in descriptions are IGNORED, sharply reducing volume. Would miss most relevant matches. | Use `NAME:` operator in `text` parameter instead. Keeps URL params simple while scoping to title. |
| `no_magic=true` as default | "Exact match is more accurate" | hh.ru magic adds synonym expansion + morphological normalization, which INCREASES result set size. Disabling it shrinks results. Keep default magic on for breadth. | Add `no_magic=true` AS A COMPLEMENTARY feed, not default. |
| RSS pagination via `page` param | "Get more than 20 items per query" | RSS format has no standard pagination. The `page` parameter works in REST API but RSS endpoint behavior is undocumented and may return same items or error. | Use feed diversity (sub-areas, queries, experience splits) instead. Each feed is a separate ~20-item batch. |
| Paid scrapers / Apify actors | "RSS too limited, use real scraper" | Adds cost dependency and auth surface. Contradicts project's $0 marginal cost principle. | Maximize RSS surface area first (sub-areas + diversity). Only consider paid options if volume is proven insufficient. |
| Browser automation (Playwright/Puppeteer) | "Scrape hh.ru search pages HTML" | Brittle, rate-limit prone, out of scope per Key Decisions. | RSS + HTTP fetch (already built) covers needs without automation. |
| HeadHunter API (authenticated) | "Full API access for proper querying" | API credentials not obtainable (per PROJECT.md). | RSS endpoint reuses same search infrastructure as web UI. |

## Feature Dependencies

```
Sub-area feeds
    └──requires──> Area-to-ID mapping table (static or fetched)

Query diversity per role
    └──requires──> RU/EN synonym mapping per Target Role
    └──enhances──> More feeds per scan cycle

Experience-split feeds
    └──requires──> Feeds per experience level per role
    └──multiplies──> Feed count (roles × experience levels)

Work format split feeds
    └──requires──> Feeds per work format per role
    └──multiplies──> Feed count

Professional_role feeds
    └──requires──> Fetch professional_roles catalog (api.hh.ru/professional_roles)
    └──requires──> RSS endpoint support for professional_role param
    └──could_replace──> Keyword-based role matching

Safety brake 100 net-new
    └──conflicts──> Massively increased feed count
    └──mitigation──> Brake is sane default; user can adjust via Search Queries or Profile

Title-scoped NAME: feeds
    └──enhances──> Query diversity (complements broad feeds)
    └──depends_on──> hh.ru query language support in RSS
```

### Dependency Notes

- **Sub-area feeds:** Requires resolving user's `Target Geography` to area IDs. Moscow=1, SPb=2, Novosibirsk=4, Ekaterinburg=3, etc. Should respect user's stated locations; if user has "Russia" in geography, include major cities + area=113. If user has specific cities only, use those.

- **Experience-split + Work-format feeds:** Multiply feed count by number of experience levels (4: noExp, 1-3, 3-6, 6+) or work formats (3: on-site, remote, hybrid). This is the largest potential multiplier. With 8 roles × 4 experience levels = 32 feeds, each ~20 items = 640 raw.

- **Professional_role feeds:** If supported by RSS, could replace keyword-based matching entirely for some role categories. Requires a one-time fetch of the professional roles directory (public, no auth) and mapping Target Roles to professional_role IDs.

- **Safety brake conflict:** More feeds = more net-new items. The 100-item safety brake may trigger frequently with aggressive feed multiplication. The brake is a safety measure, not a hard limit — it can be adjusted if user explicitly confirms coverage needs.

## MVP Definition

This is a retrospective coverage improvement, so "MVP" means minimum viable improvements to ship in v2.1.

### Ship In v2.1 (Target)

- [ ] **Sub-area parallel feeds** — Add Moscow (1), SPb (2), and optionally 1–2 other major cities as separate feeds when user's geography covers Russia broadly. This alone could 3-5x volume.
- [ ] **Query diversity — RU/EN synonyms** — Generate 2 text variants per role: EN phrasing and RU phrasing. Minimal code change.
- [ ] **Experience-split feeds for senior roles** — For roles where seniority matters, generate separate `experience` feeds for 1-3 years + 3-6 years + 6+ years. Skip noExperience unless Profile indicates entry-level.

### Add After Validation (v2.1.x)

- [ ] **Work format split** — Add REMOTE feed for roles where remote is common. Verify value before adding ON_SITE/HYBRID variants.
- [ ] **`professional_role` verification and integration** — Test if `professional_role` param works on RSS endpoint. If yes, map Target Roles to IDs and add as additional feeds.
- [ ] **Safety brake review** — If v2.1 improvements cause frequent brake hits, consider raising limit to 200 or making it configurable per run.

### Future Consideration (v2+)

- [ ] **Full area expansion** — Query ALL major Russian cities. Requires dynamic area list management.
- [ ] **Feed dedup between sub-areas** — Sub-area feeds will have overlap. Measure overlap ratio; if >20%, consider optimization.
- [ ] **HeadHunter API (paid)** — Only if RSS volume is proven insufficient for good coverage. Contradicts current design constraints.

## Feature Prioritization Matrix

| Strategy | Volume Impact | Implementation Cost | Risk | Priority |
|----------|--------------|-------------------|------|----------|
| Sub-area parallel feeds (Moscow + SPb + area=113) | HIGH (3x–5x) | LOW (add area IDs to feed generator) | LOW (safe; RSS respects area param) | P1 |
| RU/EN query synonyms per role | MEDIUM (1.5x–2x) | LOW (role name translation mapping) | LOW | P1 |
| Experience-split feeds | MEDIUM (2x–4x) | LOW (add `&experience=` to URL generator) | LOW | P1 |
| Work format split (remote) | MEDIUM (1.5x–2x) | LOW (add `&work_format=REMOTE`) | LOW | P2 |
| `professional_role` ID feeds | HIGH (if supported) | MEDIUM (needs verification + role ID mapping) | MEDIUM (RSS support unconfirmed) | P2 |
| Title-scoped `NAME:` feeds | LOW-MEDIUM | LOW (prefix text with `NAME:`) | LOW | P2 |
| `no_magic=true` complement feeds | LOW | LOW | LOW | P3 |
| Full sub-area expansion (10+ cities) | HIGH | MEDIUM (area list management) | LOW (but many feeds) | P3 |

**Priority key:**
- P1: Must have for v2.1 — highest impact, lowest cost
- P2: Should have — good value, needs minor investigation
- P3: Nice to have — incremental improvement or higher cost

## Detailed Strategy Analysis

### Strategy 1: Sub-Area Parallel Feeds

**How it works:**
hh.ru's RSS endpoint supports `area` parameter. Each area query returns the top ~20 most relevant vacancies for that geographic area. `area=113` returns top 20 across all Russia. `area=1` returns top 20 in Moscow. `area=2` returns top 20 in Saint Petersburg.

Since each feed is capped at ~20 items, querying sub-areas surfaces vacancies that wouldn't appear in the top 20 for all-Russia. This is the equivalent of pagination by geography.

**Current behavior:** `Build Feed List` node only uses `area=113` for all auto-feeds. Area resolver defaults to `113` and only accepts values 1, 2, or 113. Manual Search Queries can override area via `Search Query Override` field.

**Implementation:**
```javascript
// For each role, generate multiple feeds with different areas:
const areas = ['113', '1', '2']; // Always include parent + major cities
// If user's geography narrows to specific cities, use those instead
for (const role of roles) {
  for (const area of areas) {
    feeds.push({
      feedUrl: `https://hh.ru/search/vacancy/rss?text=${encodeURIComponent(role)}&area=${area}`,
      sourceQuery: `${role} [area=${area}]`,
      // ...
    });
  }
}
```

**Potential overlap:** Some vacancies appear in both area=113 and area=1 top-20. FNV-1a dedup handles this. Expected unique rate: 60–80% per sub-area feed. Area=113 already includes Moscow/SPb jobs, so Moscow/SPb feeds have highest overlap with area=113.

**Area IDs for Russian cities (from hh.ru public API):**

| Area | ID | Notes |
|------|----|-------|
| Russia (all) | 113 | Default parent |
| Moscow | 1 | Highest vacancy count |
| Saint Petersburg | 2 | Second highest |
| Novosibirsk | 4 | Major tech hub |
| Ekaterinburg | 3 | Major tech hub |
| Kazan | 88 | Growing tech scene |
| Nizhny Novgorod | 66 | Major tech hub |
| Krasnodar | 1534 | Southern hub |
| Rostov-on-Don | 76 | Southern hub |
| Samara | 78 | Volga region |
| Ufa | 99 | Volga region |
| Krasnoyarsk | 85 | Siberian hub |
| Perm | 90 | Volga region |
| Voronezh | 26 | Central Russia |
| Chelyabinsk | 104 | Ural region |

**v2.1 recommendation:** Start with area=113 + Moscow (1) + SPb (2). Three feeds per role gives 3× volume. Most overlap will be between area=113 and Moscow (since Moscow dominates Russian IT job listings). SPb typically adds more unique items.

### Strategy 2: Query Diversity (RU/EN Synonyms per Role)

**How it works:**
hh.ru's search understands both Russian and English. A query for "Python Developer" won't match "Python-разработчик" unless magical synonyms catch it — and they might not, because these are cross-language synonyms which are less reliably mapped than within-language synonyms.

Generating two text queries per role (EN and RU) doubles the chance of surfacing a broader set of vacancies:
- EN query: `Python Developer OR Backend Engineer`
- RU query: `Python-разработчик OR Бэкенд разработчик`

**Current behavior:** `buildText()` in `Build Feed List` uses role names as they appear in Airtable Profile. If the user entered English names, RU-specific vacancies may be missed.

**Implementation:**
```javascript
const RU_SYNONYM_MAP = {
  'Python Developer': 'Python-разработчик',
  'Backend Engineer': 'Backend-разработчик OR Бэкенд разработчик',
  'Frontend Engineer': 'Frontend-разработчик OR Фронтенд разработчик',
  // ... extend per user's Target Roles
};

// For each role, generate EN + RU feeds
for (const role of roles) {
  // EN feed (original)
  feeds.push(buildFeed(role));
  // RU feed (if synonym exists)
  const ruText = RU_SYNONYM_MAP[role];
  if (ruText) {
    feeds.push(buildFeed(ruText, area, { tag: 'RU synonyms' }));
  }
}
```

**Better approach:** Instead of hard-coded mapping, the Code node can dynamically generate RU variants by appending common Russian job title suffixes or maintaining a small lookup table in the workflow. The Profile-driven approach means the user can also add RU variants to their Target Roles array.

### Strategy 3: Experience-Split Feeds

**How it works:**
hh.ru RSS supports `experience` parameter with values: `noExperience`, `between1And3`, `between3And6`, `moreThan6`. Without it, results include all experience levels mixed together. By splitting, each experience band gets its own top-20 query, revealing roles that a mixed feed might deprioritize.

**Implementation:**
```javascript
const EXPERIENCE_LEVELS = [
  { id: 'noExperience', label: 'Entry' },
  { id: 'between1And3', label: 'Junior-Mid' },
  { id: 'between3And6', label: 'Mid-Senior' },
  { id: 'moreThan6', label: 'Senior+' },
];

// For each role, optionally generate experience-specific feeds
for (const role of roles) {
  // Broad feed (current — no experience filter)
  feeds.push(buildFeed(role, area));
  // Experience-specific feeds
  for (const exp of EXPERIENCE_LEVELS) {
    if (exp.id === 'noExperience') continue; // skip unless entry-level in profile
    feeds.push(buildFeed(role, area, { experience: exp.id }));
  }
}
```

**Note:** This multiplies feed count × 3 (skipping noExperience). With 8 roles × 3 areas (Strategy 1) × 3 experience levels = 72 feeds. Each ~20 items = 1440 raw items. The 100 net-new safety brake needs review.

### Strategy 4: Work Format Split (Remote Focus)

**How it works:**
hh.ru RSS supports `work_format` parameter: `REMOTE`, `ON_SITE`, `HYBRID`. Adding a `&work_format=REMOTE` feed for each role captures remote-work vacancies that the general feed might sort lower.

**Implementation:**
```javascript
const WORK_FORMATS = [
  { id: 'REMOTE', label: 'Remote' },
  // ON_SITE and HYBRID as future additions
];
// Add REMOTE variant for applicable roles
for (const role of roles) {
  feeds.push(buildFeed(role, area, { workFormat: 'REMOTE' }));
}
```

### Strategy 5: `search_field=name` Analysis

**Current query:** `role_name OR skill1 OR skill2` (all fields)
**With `search_field=name`:** Only matches if terms appear in vacancy title.

**Verdict: DO NOT use `search_field=name` for current OR-skill queries.** Skills appear in descriptions, not titles. Using `search_field=name` would make the skill part of the query useless, dramatically reducing volume.

**Alternative:** Use `NAME:` operator in the `text` parameter for a SEPARATE title-only feed:
```
text=NAME:(Python+Developer+OR+Backend+Engineer)
```
This creates a feed focused on title matches without changing the URL parameter structure.

**Better alternative for title-scoped coverage:**
```
text="Python+Developer"
```
Double-quoted phrases in hh.ru query language trigger exact phrase matching in vacancy titles.

### Strategy 6: `professional_role` Analysis

**What it is:** Numeric IDs from hh.ru's professional role taxonomy. Example: `professional_role=96` maps to "Программист" (Programmer). Each ID corresponds to a category of roles.

**How to get IDs:** `GET https://api.hh.ru/professional_roles` (public, no auth). Returns a hierarchical category → roles structure:
```json
{
  "categories": [
    {
      "name": "Информационные технологии",
      "roles": [
        { "id": "96", "name": "Программист" },
        { "id": "124", "name": "Системный администратор" },
        { "id": "125", "name": "Технический директор (CTO)" },
        // ...
      ]
    }
  ]
}
```

**Verdict: PROMISING BUT UNVERIFIED FOR RSS.** The `professional_role` parameter is documented for `GET /vacancies` REST API. Whether it works on `/vacancy/rss` RSS endpoint needs live testing. Approach:

1. Construct RSS URL manually with `&professional_role=96`
2. Hit with HTTP request, check if RSS returns results
3. If yes, map Profile Target Roles to professional_role IDs
4. Add as supplementary feeds (replacing `text` keyword approach for those roles)

**If supported:** Each professional_role feed would return vacancies categorized under that role, regardless of exact title phrasing. This is orthogonal to keyword search and would surface jobs the keyword approach misses.

**If not supported:** Not a loss. The keyword + area approach already works.

### Strategy 7: `no_magic` Analysis

**What it does:**
- `no_magic=true`: Disables synonym expansion and morphological normalization. Only exact words (and their basic forms) match.
- Default (no parameter or `no_magic=false`): hh.ru's "magic" search adds synonyms ("директор" ↔ "руководитель" ↔ "управляющий"), normalizes declensions ("главный бухгалтер" ↔ "главного бухгалтера"), and transliterates ("Project Manager" ↔ "проджект").

**Verdict: Keep default (magic ON) for primary feeds.** Magic expands results, which is what we want for volume.

**Optional supplement:** Add one `no_magic=true` feed per role for exact match. This catches niche job titles that magic might map to a different synonym category. But this is low-value for volume.

### Strategy 8: Query Language Operators in `text` Parameter

hh.ru supports a rich query language in the `text` parameter (documented at hh.ru/article/25295). These work in RSS since they're parsed by the backend, not the UI.

| Operator | Example | Effect |
|----------|---------|--------|
| `" "` | `"Python Developer"` | Exact phrase search (words in order) |
| `NAME:` | `NAME:(Python Developer)` | Search only in title |
| `DESCRIPTION:` | `DESCRIPTION:(Django)` | Search only in description |
| `COMPANY_NAME:` | `COMPANY_NAME:(Yandex)` | Search only in company name |
| `AND` | `Python AND Django` | Both terms required |
| `OR` | `Python OR JavaScript` | Either term (default between words) |
| `NOT` | `Python NOT Junior` | Exclude term |
| `( )` | `(Python OR JavaScript) AND Senior` | Grouping |
| `*` | `менедж*` | Prefix wildcard (менеджер, менеджмент) |
| `!` | `!директор` | Exact word, no synonyms |

**How to use for volume:**
- Current: `Python Developer OR Django OR Flask` (searches all fields, default OR between terms)
- Can add: `NAME:("Python Developer" OR "Senior Python" OR "Python Team Lead")` — title-focused precise feed
- Can add: `Python AND (Django OR FastAPI) NOT Junior` — filter noise from broad feeds
- The `NOT Junior` pattern in the `text` parameter is more effective than expecting Evaluator Negative Filters to catch everything, since it prevents non-matching vacancies from filling the RSS top-20.

## Concrete Recommended Combos

Assuming 8 Target Roles, the recommended feed matrix for v2.1:

| Feed Type | Per Role | Total Feeds | Est. Raw Items | Est. Unique | Priority |
|-----------|----------|-------------|----------------|-------------|----------|
| Current (area=113, no filters) | 1 | 8 | 160 | 140 | Baseline |
| + Moscow sub-area (area=1) | 1 | 8 | 160 | +80 | P1 |
| + SPb sub-area (area=2) | 1 | 8 | 160 | +80 | P1 |
| + RU synonyms | 1 | 8 | 160 | +40 | P1 |
| + Experience-split (3 levels, area=113) | 3 | 24 | 480 | +200 | P1 |
| + Remote work_format | 1 | 8 | 160 | +60 | P2 |
| **Total (all P1)** | **7** | **56** | **1120** | **~540 raw, ~200-300 net-new at brake** | — |

**Note on safety brake:** With 56 feeds, raw items could exceed 1000. The 100 net-new brake WILL trigger early. Consider:
- Running feeds sequentially with brake check mid-loop (already done via `Loop Over Feeds`)
- The brake triggers at 100 net-new Pipeline records. Most items will be deduped across feeds.
- Expected unique per scan: 150–300, triggering brake with current limit. May need to adjust to 200.

## Competitor / Community Pattern Analysis

| Pattern | Source | Our Adaptation |
|---------|--------|----------------|
| Per-region parallel RSS queries | subscribe_job_rss (GitHub, May 2026) shows area-specific RSS subscriptions | Add Moscow + SPb sub-area feeds |
| Exact-title + broad mix | hh.ru blog suggests using both "по соответствию" and title-only searches | Keep broad default + add NAME: variant feeds |
| `search_field=name` + `no_magic=true` for precision | Common in hh.ru API scraping examples (DTF guide, Habr Q&A) | Use as secondary feed only; never replace default |
| Multi-parameter parallel feeds | Apify hh-ru-job-scraper (Nov 2025) uses experience + schedule + employment combos | Apply same pattern to RSS — orthogonal params = orthogonal result sets |
| Professional role ID filtering | R/Python parsers (forpes.ru) iterate over professional_role IDs to maximize coverage | If RSS supports it, map Target Roles to IDs |

## Open Questions for v2.1 Implementation

1. **Does `professional_role` work in RSS?** Test with manual URL: `https://hh.ru/search/vacancy/rss?professional_role=96&area=113`. If yes, powerful supplement.

2. **How much overlap between area=113 and sub-area feeds?** Needs empirical measurement. Expected: area=113 top-20 overlaps ~40–60% with Moscow (1) top-20. SPb (2) overlap ~20–30% with area=113.

3. **What is the optimal area list?** Moscow + SPb are safe bets. Should Novosibirsk (4), Ekaterinburg (3), or Kazan (88) be included? Depends on user's Target Geography and typical role distribution.

4. **What is the actual 100-item brake behavior with 56+ feeds?** Current brake aggregates ALL loop iterations. With larger feed counts, brake will trigger on first high-volume minute. Need to confirm it doesn't truncate mid-loop.

5. **Does `order_by=publication_time` work in RSS?** If yes, adding it orders by newest, which is preferable for daily scans. Default is relevance sorting.

6. **Does `search_period=N` work in RSS?** If yes, `&search_period=1` limits to last 24 hours, reducing overlap with yesterday's scan. Without it, the feed may return stale items already in Pipeline.

## Sources

- **subscribe_job_rss** (GitHub, May 2026) — confirmed RSS params: `text`, `area`, `experience`, `employment_form`, `work_format`. LOW confidence on `professional_role`, `search_field`, `no_magic` in RSS context. https://github.com/selvnv/subscribe_job_rss

- **hh.ru API official docs** (GitHub hhru/api) — documents `search_field`, `professional_role`, `no_magic` for `/vacancies` REST API. RSS endpoint likely mirrors web search params. https://github.com/hhru/api/blob/master/docs/vacancies.md

- **hh.ru query language article** (hh.ru/article/25295, Dec 2025) — `NAME:`, `DESCRIPTION:`, `COMPANY_NAME:`, `!`, `AND`, `OR`, `NOT`, `""`, `*` operators. Works in `text` parameter. https://hh.ru/article/25295

- **hh.ru blog: language query operators** (Jan 2026) — practical usage guide for field operators and boolean logic. https://hh.ru/blog/lajfhaki-hh-bystryj-poisk-vakansij

- **DTF guide: parsing hh.ru** (Feb 2026) — shows `no_magic=true`, `search_field=name` in URL examples, confirms area hierarchy behavior. https://dtf.ru/howto/4793421-parsing-vakanzii-i-rezyume-s-hh

- **Parse.bot hh.ru API marketplace** — confirms `professional_role` as numeric ID parameter, `area` supports multiple values, `search_field` accepts name/company_name/description. https://parse.bot/marketplace/010f54ea-6ae2-4e05-904b-156f0a706b28/hh-ru-api

- **Apify hh-ru-job-scraper** (Nov 2025) — shows experience, schedule, employment filters; `startUrl` pattern with `no_magic=true&search_field=description`. https://apify.com/shahidirfan/hh-ru-job-scraper/api

- **forpes.ru: hh.ru API analysis in R** (2023) — iterates `professional_role` IDs and areas to maximize coverage, confirms sub-areas return different vacancy sets. https://forpes.ru/post/179585

- **hh.ru official professional roles endpoint** — `GET https://api.hh.ru/professional_roles` returns full role taxonomy (no auth). https://api.hh.ru/professional_roles

- **Existing 01e workflow** — `workflows/01e-scanner-hhru.json`. Current implementation: one feed per role, area=113 only, no filter diversification.

---

*Feature research for: hh.ru RSS vacancy volume improvement (v2.1)*
*Researched: 2026-06-07*
