---
phase: 02-hh-ru-description-enrichment
plan: 05
executed: 2026-06-06T20:25:00Z
status: complete
verified: true
---

# 02-05 — Airtable pre-flight docs + troubleshooting

## Summary

Closed UAT test 3 Airtable half: documented mandatory pre-flight setup so Pipeline rows write Source=hh.ru with full job fields instead of partial records with Source=LinkedIn.

## What Changed

### `docs/SETUP.md`
- Added **"1.7 01e hh.ru Pre-flight (required before first run)"** with 6 numbered steps: Pipeline Source option, Search Queries Source Type, Profile Target Geography, n8n schema refresh, re-import workflow, success criteria
- Updated hh.ru RSS smoke bullet in Verifying Your Setup to reference pre-flight section first

### `airtable/AIRTABLE-SCHEMA.md`
- Added **"Troubleshooting 01e Pipeline writes"** subsection with symptom → cause → fix table (Source=LinkedIn, empty job fields, thin Job Description)
- Reinforced that n8n typecast does not create new single-select options

### Cross-links
- SETUP.md → AIRTABLE-SCHEMA.md (pre-flight links to troubleshooting)
- AIRTABLE-SCHEMA.md → SETUP.md (troubleshooting links back to pre-flight)

## UAT Closure
- UAT test 3 Airtable: closed — Source=hh.ru option, schema refresh, and troubleshooting documented
