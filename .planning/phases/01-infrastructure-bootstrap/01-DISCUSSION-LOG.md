# Phase 1: Infrastructure & Bootstrap - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-09
**Phase:** 1-Infrastructure & Bootstrap
**Areas discussed:** NocoDB version & port config, Bootstrap script approach, Idempotency & auth strategy, Postgres for NocoDB

---

## NocoDB Version & Port Config

**Area questions:**

| # | Question | Options | Selected |
|---|----------|---------|----------|
| 1 | Which NocoDB version strategy? | Pin stable version, Use :latest, You decide | :latest |
| 2 | What port and network config? | Default port behind Caddy, 8080 direct | Default port behind Caddy |
| 3 | How should n8n reference NocoDB internally? | Docker service name, Expose host port, You decide | Docker service name |
| 4 | NocoDB needs its own PostgreSQL naming convention? | nocodb_db/user, Follow n8n's pattern, Same Postgres separate DB | nocodb_db / nocodb_user |

**User's choice:** :latest, Caddy behind 8080, Docker service name, nocodb_db/nocodb_user
**Notes:** All questions answered definitively. No follow-up clarifications needed.

---

## Bootstrap Script Approach

| # | Question | Options | Selected |
|---|----------|---------|----------|
| 1 | How should script interact with NocoDB's Meta API? | Raw HTTP, Third-party SDK, You decide | Raw HTTP |
| 2 | Schema source of truth? | Standalone nocodb-schema.json, Translate from Airtable, You decide | Standalone nocodb-schema.json |
| 3 | How to handle field type mapping? | Inline Python dict, Type mapping in schema file, You decide | Inline Python dict |
| 4 | How to handle initial NocoDB setup? | Manual first-login, Full API automation, You decide | Full API automation |

**User's choice:** Raw HTTP, standalone schema, inline mapping, full API automation
**Notes:** User prefers fully automated bootstrap — script creates admin + generates API token. No manual steps.

---

## Idempotency & Auth Strategy

| # | Question | Options | Selected |
|---|----------|---------|----------|
| 1 | How should the bootstrap script authenticate? | Pre-generated token in env, Script creates admin + generates token, You decide | Script creates admin + generates token |
| 2 | Idempotency strategy? | Check-then-skip, Drop-and-recreate, You decide | Check-then-skip |
| 3 | Single or separate tokens for bootstrap vs n8n? | Single token, Two tokens, You decide | Single token |

**User's choice:** Script creates admin + generates token, check-then-skip, single token for n8n too
**Notes:** User wants fully automated auth setup with no manual token generation steps.

---

## Postgres for NocoDB

| # | Question | Options | Selected |
|---|----------|---------|----------|
| 1 | Volume naming and persistence strategy? | nocodb_db_storage + nocodb_data, Single volume, You decide | nocodb_db_storage + nocodb_data |
| 2 | Environment variable naming convention? | NC_ prefix, Custom prefix, You decide | NC_ prefix |
| 3 | Attachment size limit? | 10MB, 20MB, You decide | 20MB |

**User's choice:** nocodb_db_storage + nocodb_data volumes, NC_ prefix, 20MB max
**Notes:** Attachment size set to 20MB (generous headroom for CV files that are typically 50-200KB). NC_ prefix per NocoDB convention.

---

## the agent's Discretion

No areas delegated to agent discretion — user made clear choices throughout.

## Deferred Ideas

None.
