# Phase 4: Evaluator Workflow Migration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-10
**Phase:** 4-Evaluator Workflow Migration
**Areas discussed:** NocoDB Record ID for Updates, Node Naming Convention, NocoDB Filter Syntax, PATCH Payload Structure

---

## NocoDB Record ID for Updates

| Option | Description | Selected |
|--------|-------------|----------|
| Use NocoDB Id field | Modify Parse AI Response code to use loopItem['Id'] instead of _airtableRecordId | ✓ |
| Use Job ID (FNV-1a hash) | Match records by the existing 'Job ID' hash — requires extra lookup | |
| Let the agent decide | User could describe an alternate approach | |

**User's choice:** Use NocoDB Id field
**Notes:** Unwrap node exposes NocoDB `Id`, both Code nodes (Parse AI Response + Build Interview Prep Prompt) reference it.

---

## Node Naming Convention

| Option | Description | Selected |
|--------|-------------|----------|
| Follow Phase 3 pattern | Rename to HTTP Request + Unwrap nodes, update Code node $refs | ✓ |
| Keep original names | Name HTTP nodes same as replaced Airtable nodes, minimize Code edits | |

**User's choice:** Follow Phase 3 pattern
**Notes:** All `$('Get X')` references updated to `$('Unwrap X')`.

---

## NocoDB Filter Syntax

| Option | Description | Selected |
|--------|-------------|----------|
| URL query parameter | GET with ?where=(Status,eq,New)&limit=5 | ✓ |
| HTTP Request body | POST with view-based filter, more complex | |

**User's choice:** URL query parameter
**Notes:** Standard NocoDB Data API v3 syntax.

---

## PATCH Payload Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Separate PATCH nodes | One PATCH after Parse AI Response, another after Parse & Save Interview Prep | ✓ |
| Consolidate into one | Merge both writes into single PATCH after interview prep | |

**User's choice:** Separate PATCH nodes
**Notes:** Mirrors existing Airtable structure. Clear code separation.

---

## the agent's Discretion

None — all areas had explicit user direction.

## Deferred Ideas

None.
