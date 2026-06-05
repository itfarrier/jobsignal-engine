# Phase 1: hh.ru RSS Scanner — Research

**Researched:** 2026-06-05
**Domain:** n8n workflow + Airtable schema extension (brownfield)
**Confidence:** HIGH

## Summary

Phase 1 adds scanner `01e` by mirroring JobSpy `01d`'s multi-query loop pattern, replacing the HTTP sidecar with native n8n **RSS Feed Read** inside **Loop Over Items** (batch size 1). Profile auto-feeds and Search Queries (`Source Type = HH RSS`) merge into a feed URL list; each feed returns ~20 vacancies. Parse/filter/dedupe/create nodes reuse established scanner logic from `01d` and `01a`.

**Primary recommendation:** Clone `01d` node topology (triggers → Get Profile → Get Search Queries → Build Feed List → Loop → RSS Read → Wait 1s → Parse & Filter → Aggregate → Get Existing Job IDs → Deduplicate → Create Pipeline), swapping JobSpy HTTP batch for per-feed RSS URLs built in Code.

## Standard Stack

### Core
| Component | Version/Pattern | Purpose | Why Standard |
|-----------|-----------------|---------|--------------|
| n8n | existing project | Workflow orchestration | All scanners are exportable JSON |
| RSS Feed Read | `n8n-nodes-base.rssFeedRead` v1 | Fetch hh.ru RSS | Native node; no sidecar |
| Loop Over Items | `splitInBatches` v3, batch=1 | Iterate feeds | RSS Read only processes first input item |
| Code nodes | v2 | Feed build, parse, dedupe | Matches 1a–1d |
| Airtable nodes | v2.1 | Profile, Search Queries, Pipeline | Single source of truth |

## Architecture Patterns

### Recommended Node Flow (mirror 01d)

```text
Manual Trigger ─┐
                ├→ Get Profile → Get Search Queries (HH RSS) → Build Feed List
Schedule 8:20 ──┘         ↓
              Loop Over Items (batch=1) → RSS Feed Read → Wait 1s
                           ↓
              Parse & Filter → Aggregate → Get Existing Job IDs
                           ↓
              Deduplicate vs Pipeline → Create Pipeline Records
```

### Patterns to reuse
- **01d:** Multi-query merge, dedupe, safety brake (100), Pipeline create
- **01a:** Dynamic Profile `Target Geography` + GEO_MAP substring filter
- **01d:** FNV-1a hash with source suffix (`-hhr` instead of `-spy`)

## hh.ru RSS Specifics

```
GET https://hh.ru/search/vacancy/rss?text={encoded_query}&area={area_id}
```

- Area IDs: Russia `113`, Moscow `1`, SPb `2`
- ~20 items per feed; no auth
- Encode `text=` with `%20` for spaces; OR syntax for role + skills

## GEO_MAP Extensions

| Profile Value | Substrings |
|---------------|------------|
| Russia | `россия`, `russia`, `рф` |
| Moscow | `москва`, `moscow`, `мск` |
| Saint Petersburg | `санкт-петербург`, `saint petersburg`, `spb`, `питер` |
| Remote Russia | `удаленно`, `удалённо`, `remote`, `дистанцион` |

## Airtable Changes

- Profile Target Geography: add RU options
- Search Queries Source Type: add `HH RSS`
- Pipeline Source: add `hh.ru`
- Document HH RSS column usage in `airtable/AIRTABLE-SCHEMA.md`

## Common Pitfalls

1. RSS Read without Loop Over Items — only first feed fetched
2. Hand-rolling XML instead of RSS Feed Read node
3. Using HH API (no auth) — RSS only per PROJECT.md
4. `require('crypto')` in Code nodes — use inline FNV-1a

## Validation Architecture

| Dimension | Verify |
|-----------|--------|
| Feed build | RU geo → feeds; no RU geo → skip auto (HH-09) |
| RSS fetch | Items returned per feed URL |
| Parse | title, link, company, location, salary, description |
| Geo filter | Non-matching regions dropped |
| Dedup | `-hhr` IDs; second run 0 net-new |
| Pipeline | Source `hh.ru`, schedule 8:20 |
| Schema docs | RU geos + HH RSS documented |

## Requirements Coverage

| Req | Approach |
|-----|----------|
| HH-01 | `01e-scanner-hhru.json` + RSS endpoint |
| HH-02 | Profile auto-feed builder, 8 cap, OR query |
| HH-03 | Search Queries HH RSS merge |
| HH-04 | Parse + GEO_MAP + Title Keywords |
| HH-05 | Dedup/create, 8:20, `-hhr` suffix |
| HH-06 | RSS summary as Job Description |
| HH-07 | GEO_MAP + schema |
| HH-08 | Docs + Pipeline Source option |
| HH-09 | Skip auto when no RU geography |

## RESEARCH COMPLETE
