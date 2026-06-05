# Phase 1: hh.ru RSS Scanner - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-05
**Phase:** 1-hh.ru RSS Scanner
**Areas discussed:** Auto-feed query strings, Area routing, Search Queries HH RSS, RSS fetch & parse

---

## Auto-feed query strings

| Option | Description | Selected |
|--------|-------------|----------|
| Target Role only | Simplest text= | |
| Role + top 2 Core Skills | Tighter relevance | |
| Role + all Core Skills OR'd | Broader skill coverage | ✓ (Q1) |
| You decide | Claude optimizes | |

| Option | Description | Selected |
|--------|-------------|----------|
| Use Profile values as-is | No dual-language feeds | ✓ (Q2 — Claude discretion) |
| Dual feeds per role | RU + EN separate feeds | |
| Both languages in one text= | | |

| Option | Description | Selected |
|--------|-------------|----------|
| First 8 roles in Airtable order | Deterministic cap | ✓ (Q3) |
| Rotate daily | Spread coverage | |
| Priority field | Deferred complexity | |

| Option | Description | Selected |
|--------|-------------|----------|
| No seniority in text= | Evaluator handles fit | ✓ (Q4) |
| Append seniority keyword | | |
| NOT junior tokens | Rejected — conflicts with no-scanner-negatives | |

| Option | Description | Selected |
|--------|-------------|----------|
| OR syntax for skills | Python OR FastAPI OR Django | ✓ (Q5) |
| Space AND | | |
| Role only if many skills | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Skip Target Industries | Not in text= | ✓ (Q6) |
| Append top industry | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Role-only fallback | When Core Skills empty | ✓ (Q7) |
| Skip role | | |

| Option | Description | Selected |
|--------|-------------|----------|
| %20 encoding | Percent-encode spaces | ✓ (Q8) |
| + encoding | | |

**User's choice:** Role + all Core Skills with OR syntax; first 8 roles; no seniority; Claude discretion on bilingual handling.
**Notes:** User requested more feed questions (Q5–Q8) then skipped continuation prompt to advance.

---

## Area routing

| Option | Description | Selected |
|--------|-------------|----------|
| One feed, broadest area (113) | Single area= per role | ✓ (Claude discretion — user skipped Q1–Q4) |
| One feed, narrowest area | Moscow over Russia | |
| Feed per role×area combo | More feeds | |
| Post-filter with GEO_MAP | RU+EN substrings like 1a–1c | ✓ (Claude discretion) |

**User's choice:** Skipped interactive questions — Claude applied PROJECT.md + 1a–1c pattern (area=113 + post-filter all selected RU geos).

---

## Search Queries HH RSS

**User's choice:** Skipped interactive questions — Claude applied JobSpy 1d column reuse pattern (see CONTEXT.md D-12–D-17).

---

## RSS fetch & parse

**User's choice:** Skipped interactive questions — Claude applied n8n RSS Feed Read + Loop Over Items pattern from Context7 docs (see CONTEXT.md D-18–D-21).

---

## Claude's Discretion

- Bilingual text=: use Profile values as-is (user selected "You decide" on Q2)
- Area routing: broadest area fetch + substring post-filter when user skipped area questions
- Search Queries schema and RSS parse depth when user skipped remaining areas

## Deferred Ideas

- Daily rotation of Target Roles beyond first 8
- Full vacancy HTML scrape (v2)
- Seniority / NOT-junior in scanner text=
