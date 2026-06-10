# Phase 5: Tailor Workflow & Attachments Migration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-10
**Phase:** 05-tailor-workflow-attachments-migration
**Areas discussed:** NocoDB Storage Upload Flow, Empty String Filter for Tailored CV Text, Record ID from NocoDB, Graceful Degradation for Attachments

---

## NocoDB Storage Upload Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Two separate nodes (Recommended) | Upload node + separate PATCH node for attachment array | ✓ |
| Single combined PATCH | Chain upload and PATCH in one call | |
| You decide | Defer to planning agent | |

**User's choice:** Two separate nodes (Recommended)
**Notes:** User agreed to separate upload from PATCH for cleaner separation.

| Option | Description | Selected |
|--------|-------------|----------|
| Use n8n binary data mode (Recommended) | Send DOCX as multipart/form-data | ✓ |
| Custom Code node converts base64 to binary | Extra code node before upload | |

**User's choice:** Use n8n binary data mode (Recommended)
**Notes:** NocoDB docs confirmed multipart/form-data is required — base64 won't work. n8n's built-in binary handling is the natural fit.

| Option | Description | Selected |
|--------|-------------|----------|
| Single combined PATCH (Recommended) | Update text fields + attachment array together | ✓ |
| Split PATCH | Separate nodes for text vs attachment | |

**User's choice:** Single combined PATCH (Recommended)
**Notes:** Matches existing Airtable pattern of one Update Pipeline Record node.

---

## Empty String Filter for Tailored CV Text

| Option | Description | Selected |
|--------|-------------|----------|
| Use (is,blank) (Recommended) | NocoDB's recommended syntax for empty/null fields | ✓ |
| Use (eq,) | Exact empty string match | |

**User's choice:** Use (is,blank) (Recommended)
**Notes:** Catches both empty string and NULL. The (is,null) operator doesn't work for text fields in NocoDB v3.

---

## Record ID from NocoDB

| Option | Description | Selected |
|--------|-------------|----------|
| Read loopItem.Id directly (Recommended) | Match Phase 4 D-05 pattern | ✓ |
| Map Id to a custom field | Extra field mapping step | |

**User's choice:** Read loopItem.Id directly (Recommended)
**Notes:** Trivial change — consistent with Phase 4's established pattern.

---

## Graceful Degradation for Attachments

| Option | Description | Selected |
|--------|-------------|----------|
| Save text fields regardless (Recommended) | Save CV markdown + cost even if upload fails | ✓ |
| Fail the whole job | Don't save anything if upload fails | |

**User's choice:** Save text fields regardless (Recommended)
**Notes:** CV markdown is primary output, DOCX is convenience. Two-step NocoDB flow enables this — cannot be done with Airtable's single-step upload.

---

## Deferred Ideas

None — discussion stayed within phase scope.
