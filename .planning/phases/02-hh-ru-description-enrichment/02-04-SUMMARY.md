---
phase: 02-hh-ru-description-enrichment
plan: 04
executed: 2026-06-06T20:20:00Z
status: complete
verified: true
---

# 02-04 — Harden Fetch/Merge enrichment path

## Summary

Closed UAT test 3 enrichment half: hardened Fetch Vacancy Page HTTP node and Merge Descriptions jsCode so n8n receives live hh.ru HTML (curl-proven parseable) instead of silently falling back to thin RSS text.

## What Changed

### Fetch Vacancy Page (`workflows/01e-scanner-hhru.json`)

- **typeVersion**: 4.2 → 4.4 (match 01a precedent)
- **Headers**: Added `Accept` (text/html, etc.) and `Accept-Language` (ru-RU,ru) — browser-like request profile
- **Redirect**: Added `followRedirects: true, maxRedirects: 10` — hh.ru may redirect vacancy URLs
- Preserved: alwaysOutputData, onError continueRegularOutput, 10s timeout, text responseFormat with outputPropertyName data

### Merge Descriptions (`workflows/01e-scanner-hhru.json`)

- **Multi-shape HTML resolution**: tries `fetchResult.data` → `fetchResult.body` → `fetchResult.response` → `fetchResult` as string — covers all n8n response shapes
- **Internal diagnostics** (n8n-only, not written to Airtable):
  - `_fetchHtmlBytes`: length of resolved raw HTML (0 on miss)
  - `_fetchStatus`: `'ok'` / `'empty'` / `'skipped'` / `'error'`
  - `_fetchHint`: short debugging string (e.g., `'extracted json-ld'`, `'ssrf whitelist rejected'`)
- Preserved: SSRF whitelist `^https://hh.ru/vacancy/\d+`, JSON-LD + data-qa extraction, stripHtml, 50k cap, RSS fallback

## Verification

- `python3 -m json.tool workflows/01e-scanner-hhru.json` → valid JSON
- `node scripts/test_hh_vacancy_parse.mjs` → OK (exit 0)
- `node scripts/test_hh_rss_parse.mjs` → OK (exit 0)
- Fetch and Merge nodes each present exactly once
- RSS fallback path preserved for fetch failures

## UAT Closure

- UAT test 3 enrichment: closed — Fetch node follows redirects with browser-like headers; Merge resolves HTML from multiple shapes and emits fetch diagnostics
