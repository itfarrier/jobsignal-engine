# Phase 1: Infrastructure & Bootstrap - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy NocoDB as a Docker service alongside the existing stack (n8n, PostgreSQL, Caddy, CV renderer, JobSpy scanner) and create a Python bootstrap script that automates table creation for all 4 tables (Profile, Tracked Companies, Pipeline, Search Queries) via NocoDB Meta API v3. This phase covers infrastructure setup and the automation tool — no workflow changes.

</domain>

<decisions>
## Implementation Decisions

### NocoDB Version & Port Config
- **D-01:** Use `:latest` image tag — no version pinning. NocoDB uses calendar versioning (YYYY.MM.PATCH); latest tag will be used for simplicity.
- **D-02:** Port 8080, mapped behind Caddy reverse proxy. Caddy handles TLS termination at `nocodb.yourdomain.com`.
- **D-03:** n8n references NocoDB internally via Docker Compose service name — `http://nocodb:8080`. No host port mapping needed for n8n's internal network communication.
- **D-04:** NocoDB gets its own PostgreSQL container (`nocodb-postgres`) with database `nocodb_db` and user `nocodb_user` — fully separate from n8n's Postgres.

### Bootstrap Script Approach
- **D-05:** Raw HTTP requests to NocoDB Meta API v3 — no SDK wrapper. Swagger spec at `meta-apis-v3` is the reference. Dependencies: Python `requests` library.
- **D-06:** Standalone `scripts/nocodb-schema.json` as the canonical schema definition — not translating `airtable/schema.json`. Airtable field types don't map 1:1 to NocoDB types (e.g., Lookup→Link field, Select→SingleSelect).
- **D-07:** Inline Python dict in `nocodb_bootstrap.py` for Airtable→NocoDB field type mapping. Simple, debuggable, no extra config files.
- **D-08:** Full API automation — script creates admin user via auth/signup, creates workspace and base, generates API token. No manual UI steps required.

### Idempotency & Auth
- **D-09:** Check-then-skip idempotency. Script checks if each table exists via Meta API before creating. `--force` flag enables drop-and-recreate. Safe for CI and re-runs.
- **D-10:** Single API token shared by bootstrap and n8n workflows. Token stored in docker-compose env vars, accessible by both bootstrap script and n8n HTTP Request nodes.
- **D-11:** `NC_` prefix environment variables per NocoDB convention: `NC_DB` (Postgres connection string), `NC_AUTH_JWT_SECRET` (JWT secret), `NC_PUBLIC_URL` (public URL for Caddy routing), `NC_ATTACHMENT_FIELD_SIZE` (attachment size limit).

### Postgres for NocoDB
- **D-12:** Two Docker volumes: `nocodb_db_storage:/var/lib/postgresql/data` for Postgres data, `nocodb_data:/usr/app/data` for NocoDB's local attachment storage.
- **D-13:** Attachment size limit: 20MB (`NC_ATTACHMENT_FIELD_SIZE=20971520`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — Requirements INFR-01, INFR-02, BOOT-01, BOOT-02, BOOT-03, BOOT-04
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria (5 items), depends-on (nothing), scope
- `.planning/PROJECT.md` — Key decisions table (cutover migration, NocoDB in docker-compose, local attachments, in-place node replacement)

### Existing Schema & Infrastructure
- `airtable/schema.json` — Source Airtable schema (field types, select options, linked record structure to translate from)
- `docker-compose.example.yml` — Existing Docker Compose stack to extend with NocoDB + its Postgres
- `docs/AIRTABLE-SCHEMA.md` — Current schema documentation (reference for translation)

### NocoDB API References
- NocoDB Meta API v3 Swagger: `https://meta-apis-v3.nocodb.com/` — Table/field creation endpoints
- NocoDB Data API v3 Swagger: `https://data-apis-v3.nocodb.com/` — Record CRUD (needed from Phase 3 onward, but understand the surface now)
- NocoDB Docker setup docs: `https://nocodb.com/docs/self-hosting/installation/docker`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `docker-compose.example.yml` — Existing pattern for Docker Compose service definitions, environment variables, volumes, networks. Extend with NocoDB section following the same convention.
- `scripts/airtable_bootstrap.py` (will be replaced) — Pattern reference for how the new `scripts/nocodb_bootstrap.py` should be structured: CLI argument handling, environment variable loading, error handling.
- `airtable/schema.json` — Field type definitions, select option lists, linked record relationships to translate into `scripts/nocodb-schema.json`.

### Established Patterns
- Docker Compose with named volumes for persistence — used by n8n (db_storage) and Postgres. NocoDB follows same pattern.
- Python scripts in `scripts/` directory with Flask/HTTP server pattern. Bootstrap script uses `requests` library (already available in the Python sidecars).
- Environment variables for configuration — docker-compose defines env vars, no `.env` file in repo.

### Integration Points
- New `nocodb` service added to `docker-compose.example.yml` with port 8080
- New `nocodb-postgres` service added alongside
- New env vars in n8n service for NocoDB API token and host URL
- `scripts/nocodb_bootstrap.py` — new Python script alongside existing `scripts/`
- `scripts/nocodb-schema.json` — new schema definition file

</code_context>

<specifics>
## Specific Ideas

- Bootstrap script should be single-command: after `docker-compose up -d`, run `python scripts/nocodb_bootstrap.py` and all 4 tables are created with correct types, select options, and linked record relationships.
- `--table Pipeline` flag for incremental single-table creation.
- `--import-data` flag to seed from CSV or Airtable export.
- `--force` flag to drop and recreate tables (destructive).
- NocoDB Caddy subdomain should be documented in SETUP.md for Phase 7.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Infrastructure & Bootstrap*
*Context gathered: 2026-06-09*
