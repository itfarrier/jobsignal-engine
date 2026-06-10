# Phase 2: Data Migration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-10
**Phase:** 2-Data Migration
**Areas discussed:** Import method, Linked record handling, Verification, Cutover timing

---

## Import Method

| Option | Description | Selected |
|--------|-------------|----------|
| Native NocoDB import | One-click import with PAT + Shared Base URL, handles schema+data+attachments | ✓ |
| Custom API script | Python script reading Airtable API, transforming to NocoDB Meta API format | |
| Hybrid | Native import + post-import API cleanup | |

| Option | Description | Selected |
|--------|-------------|----------|
| After bootstrap, into same base | Bootstrap creates workspace/base, then import into that base | ✓ |
| Import first, reconcile later | Let native import create everything, reconcile after | |

| Option | Description | Selected |
|--------|-------------|----------|
| Let native import create tables | Bootstrap handles workspace+base only; import creates tables | ✓ |
| Import into empty base, reconcile | Import to separate base, compare schemas, reconcile | |

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, enable public sharing | Enable "Turn on full base access" in Airtable Share settings | ✓ |
| No, use API approach | Avoid public sharing, use custom script instead | |

**User's choice:** Native NocoDB import, after bootstrap, letting import create tables, with public sharing enabled

---

## Linked Record Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Ignore - workflows use queries not IDs | Workflows query by Status/Fit Tier fields, not hardcoded record IDs | ✓ |
| Map and patch Airtable IDs | Store recIDs in hidden field, create mapping table | |

| Option | Description | Selected |
|--------|-------------|----------|
| No, all text-based references | Company as Text, Source as Single select - no formal linked records | ✓ |
| There ARE linked record fields | Formal linked record relationships exist | |

**User's choice:** Text-based references, workflows query by field values - no ID mapping needed

---

## Verification & Spot-Checking

| Option | Description | Selected |
|--------|-------------|----------|
| Counts + manual spot-check | Compare record counts, spot-check 10+ records per table | ✓ |
| Full automated comparison | Python script comparing field-by-field via both APIs | |

| Option | Description | Selected |
|--------|-------------|----------|
| Full field-by-field comparison | Compare every Profile field including CV Markdown | ✓ |
| Just ensure it's present | Count check is sufficient for Profile | |

| Option | Description | Selected |
|--------|-------------|----------|
| Import attachments during migration | Enable attachment import in native import settings | ✓ |
| Skip attachments, regenerate later | Tailor workflow regenerates CVs for active jobs in Phase 5 | |

**User's choice:** Counts + spot-check with full field-by-field for Profile, import attachments

---

## Cutover Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Import-once, cut over at Phase 8 | Import now, workflows on Airtable through Phases 3-7, flip at Phase 8 | ✓ |
| Dual-write during migration | Write to both Airtable and NocoDB during Phases 3-7 | |
| Immediate cutover after import | Update all 8 workflows in one session after import | |

**User's choice:** Import once now, cut over at Phase 8

---

## the agent's Discretion

No areas were deferred to the agent — all decisions were user-directed.

## Deferred Ideas

None — discussion stayed within phase scope.
