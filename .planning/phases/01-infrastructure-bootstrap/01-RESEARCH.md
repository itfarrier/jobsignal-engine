# Phase 1: Infrastructure & Bootstrap — Research

**Researched:** 2026-06-09
**Domain:** NocoDB Docker deployment + Python-based table bootstrapping via Meta API v3
**Confidence:** HIGH

## Summary

Phase 1 deploys NocoDB (Community Edition) as a Docker Compose service with its own PostgreSQL backend, then creates a Python bootstrap script (`nocodb_bootstrap.py`) that automates NocoDB initial setup (first-user signup, workspace detection, base creation, table/field creation) via the Meta API v3. The script supports idempotent check-then-skip creation, `--table` for incremental single-table creation, `--force` for destructive re-creation, and `--import-data` for CSV seeding.

Key findings:

1. **NocoDB CE has a single auto-created workspace** — The Community Edition creates a default workspace on first user signup. Workspace creation via v3 API (`POST /api/v3/meta/workspaces`) is documented as Enterprise-only but may work on CE for the one allowed workspace. The bootstrap script should handle both cases: try workspace creation, fall back to listing the default workspace.

2. **v3 Meta API field types differ from v1/v2** — The v3 API uses `type` (not `uidt`) and `options.choices` for select options (not `dtxp`). Relationship fields are `type: "Links"` with `relation_type` ("mm"/"hm"/"bt") and `related_table_id`. This resolves a known v2 issue where select options couldn't be set during column creation.

3. **API token creation has a chicken-and-egg problem** — `POST /api/v2/meta/bases/{baseId}/api-tokens` requires a base ID. The bootstrap script must create the base first using the JWT token from signin, then create the API token. For n8n workflows, the token is stored in docker-compose environment variables.

4. **The NC_ADMIN_EMAIL/NC_ADMIN_PASSWORD env var bug is fixed** — A January 2026 bug (NocoDB #12874) where these env vars caused missing workspace IDs during base creation has been resolved. The bootstrap script should still use the signup/signin API for robustness (per D-08).

5. **Check-then-skip idempotency works via `GET /api/v3/meta/bases/{base_id}/tables`** — The bootstrap script lists existing tables and skips creation if a table already exists. `--force` uses `DELETE /api/v3/meta/bases/{baseId}/tables/{tableId}` before recreation.

**Primary recommendation:** Use raw `requests` calls to the v3 Meta API (no SDK wrapper per D-05). The bootstrap script follows the existing Python service pattern: module-level docstring, `argparse` CLI, `logging` with timestamps, `json` for API communication.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: NocoDB `:latest` image tag (no version pinning)
- D-02: Port 8080, behind Caddy reverse proxy
- D-03: n8n references NocoDB via Docker service name (`http://nocodb:8080`)
- D-04: NocoDB gets own PostgreSQL container (`nocodb-postgres`, database `nocodb_db`, user `nocodb_user`)
- D-05: Raw HTTP requests to NocoDB Meta API v3 — no SDK wrapper. Python `requests` library.
- D-06: Standalone `scripts/nocodb-schema.json` for canonical schema definition
- D-07: Inline Python dict in `nocodb_bootstrap.py` for Airtable→NocoDB field type mapping
- D-08: Full API automation — script creates admin user, creates workspace and base, generates API token
- D-09: Check-then-skip idempotency with `--force` flag for drop-and-recreate
- D-10: Single API token shared by bootstrap and n8n workflows, stored in docker-compose env vars
- D-11: `NC_` prefix environment variables (`NC_DB`, `NC_AUTH_JWT_SECRET`, `NC_PUBLIC_URL`, `NC_ATTACHMENT_FIELD_SIZE`)
- D-12: Two Docker volumes: `nocodb_db_storage` (Postgres data) and `nocodb_data` (NocoDB attachments)
- D-13: Attachment size limit 20MB (`NC_ATTACHMENT_FIELD_SIZE=20971520`)

### The Agent's Discretion
*(None — all decisions locked in CONTEXT.md)*

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFR-01 | Add NocoDB service to docker-compose.example.yml with PostgreSQL backend and local attachment storage | Official NocoDB Docker Compose pattern confirmed — see Docker Compose Configuration section |
| INFR-02 | Configure NocoDB environment variables (API tokens, JWT secret, attachment size limits) | NC_DB, NC_AUTH_JWT_SECRET, NC_PUBLIC_URL, NC_ATTACHMENT_FIELD_SIZE documented — see Environment Variables section |
| BOOT-01 | Create scripts/nocodb_bootstrap.py — single-command script for all 4 tables | Full API workflow documented — see Bootstrap Script Architecture section |
| BOOT-02 | Translate airtable/schema.json to equivalent NocoDB schema definition | Complete field type mapping table provided — see Field Type Mapping section |
| BOOT-03 | Script supports `--import-data` flag to seed records from CSV | CSV data import via v3 Data API `POST /api/v3/data/bulk/{tableId}` documented |
| BOOT-04 | Script supports `--table` flag for incremental table creation | Check-then-skip pattern per table via `GET /api/v3/meta/bases/{base_id}/tables` |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| NocoDB service orchestration | Docker Compose | — | Docker Compose manages container lifecycle, networking, volumes for NocoDB + its PostgreSQL |
| NocoDB table/field creation | Bootstrap Script | — | Standalone Python script runs after containers are up; no runtime depends on it |
| NocoDB API token creation | Bootstrap Script | docker-compose env | Bootstrap generates the token; docker-compose makes it available to n8n via env vars |
| Schema definition | `nocodb-schema.json` | — | Standalone JSON file defines canonical NocoDB schema; consumed by bootstrap script |
| NocoDB ↔ n8n communication | n8n HTTP Request nodes | Docker internal network | n8n calls NocoDB via `http://nocodb:8080` using API token auth; no bootstrap script involvement at runtime |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| NocoDB | `:latest` (calver) | Database backend replacing Airtable | Per D-01; open-source Airtable alternative; REST API v3 |
| PostgreSQL | 16-alpine | Database for NocoDB metadata | Per D-04; official NocoDB recommendation; matches n8n's existing PG pattern |
| Python `requests` | latest (stdlib compatible) | HTTP client for Meta API v3 | Per D-05; already available in Python sidecar images |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Python `argparse` | stdlib | CLI argument parsing | Bootstrap script CLI (`--table`, `--force`, `--import-data`) |
| Python `logging` | stdlib | Timestamped operational logging | Consistent with existing scripts (`cv_service.py`, `jobspy_service.py`) |
| Python `csv` | stdlib | CSV data import for `--import-data` | Reading Airtable export CSVs |
| Python `json` | stdlib | JSON parsing for API responses | Every API call in the bootstrap script |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw HTTP requests (`requests`) | NocoDB SDK (`nocodb-sdk`) | SDK adds dependency management, abstraction layer; raw requests give full control and zero deps (per D-05) |
| Inline field type mapping dict | External mapping YAML/JSON | Inline dict is debuggable, co-located with script; minor coupling (per D-07) |
| Check-then-skip idempotency | Always-drop-then-create | Check-then-skip is safe for CI; `--force` provides destructive option (per D-09) |

**Version verification:** NocoDB uses calendar versioning (`YYYY.MM.PATCH`); `:latest` tag policy means no specific version to pin. PostgreSQL 16-alpine confirmed available on Docker Hub.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `requests` | PyPI | 12+ yrs | 100M+/wk | github.com/psf/requests | OK | Approved |

No other external packages needed — bootstrap script uses only Python stdlib + `requests`.

## Docker Compose Configuration

### New Services

Two new services must be added to `docker-compose.example.yml`:

**nocodb-postgres** (dedicated PostgreSQL for NocoDB per D-04):
```yaml
nocodb-postgres:
  image: postgres:16-alpine
  restart: always
  environment:
    - POSTGRES_USER=nocodb_user
    - POSTGRES_PASSWORD=REPLACE_WITH_YOUR_PASSWORD
    - POSTGRES_DB=nocodb_db
  volumes:
    - nocodb_db_storage:/var/lib/postgresql/data
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U nocodb_user -d nocodb_db"]
    interval: 10s
    timeout: 5s
    retries: 10
```

**nocodb** (NocoDB application, per D-01, D-02, D-03):
```yaml
nocodb:
  image: nocodb/nocodb:latest
  restart: always
  depends_on:
    nocodb-postgres:
      condition: service_healthy
  environment:
    - NC_DB=pg://nocodb-postgres:5432?u=nocodb_user&p=REPLACE_WITH_YOUR_PASSWORD&d=nocodb_db
    - NC_AUTH_JWT_SECRET=REPLACE_WITH_YOUR_JWT_SECRET
    - NC_PUBLIC_URL=https://nocodb.yourdomain.com
    - NC_ATTACHMENT_FIELD_SIZE=20971520
    - NC_DISABLE_TELE=true
  ports:
    - "8080:8080"
  volumes:
    - nocodb_data:/usr/app/data
```

**Integration with existing Caddy:**
The `Caddyfile` (separate, in `.gitignore`) should have a route like:
```
nocodb.yourdomain.com {
    reverse_proxy nocodb:8080
}
```

This is a Phase 2 documentation task — for Phase 1, the service is accessible on port 8080.

### n8n Service — New Env Vars

Add to the existing `n8n` service's `environment` section:
```yaml
- NOCDB_API_TOKEN=REPLACE_WITH_TOKEN    # Generated by bootstrap script
- NOCDB_HOST=http://nocodb:8080          # Docker internal network
```

### New Volumes (per D-12)
```yaml
volumes:
  nocodb_db_storage:    # Postgres data for NocoDB
  nocodb_data:          # NocoDB attachment storage
```

### NC_DB Connection String Format [CITED: docs.nocodb.com]
```
pg://host:port?u=user&p=password&d=database
```
- Host: `nocodb-postgres` (Docker service name, per D-03)
- Port: `5432` (PostgreSQL default)
- User: `nocodb_user` (per D-04)
- Password: user-configured
- Database: `nocodb_db` (per D-04)

### NC_ATTACHMENT_FIELD_SIZE (per D-13)
- Value: `20971520` (20MB in bytes)
- NocoDB validates this on the server side; exceeding the limit returns a 413 error
- This affects the `Tailored CV` attachment field in the Pipeline table

### Environment Variables — Complete Reference

| Variable | Required | Purpose | Source |
|----------|----------|---------|--------|
| `NC_DB` | Yes | PostgreSQL connection string | [CITED: docs.nocodb.com] |
| `NC_AUTH_JWT_SECRET` | Yes | JWT signing secret | [CITED: docs.nocodb.com] |
| `NC_PUBLIC_URL` | No | Public URL for email links | [CITED: docs.nocodb.com] |
| `NC_ATTACHMENT_FIELD_SIZE` | No | Max attachment size in bytes | [CITED: docs.nocodb.com] |
| `NC_DISABLE_TELE` | No | Disable telemetry (`true`) | [CITED: docs.nocodb.com] |

### JWT Secret Generation
```bash
openssl rand -base64 32
# Or for hex format:
openssl rand -hex 32
```
The secret MUST be set explicitly — NocoDB auto-generates a new one on every container start if not provided, which invalidates existing tokens on restart.

## Meta API Authentication & Setup

### Bootstrap API Workflow (execution order)

```
┌─────────────────────────────┐
│ 1. POST /api/v1/auth/       │  Sign up first admin user.
│    user/signup              │  Returns JWT token.
└──────────┬──────────────────┘
           ▼
┌─────────────────────────────┐
│ 2. POST /api/v1/auth/       │  Sign in to get JWT token (or reuse
│    user/signin              │  from signup response).
└──────────┬──────────────────┘
           ▼
┌─────────────────────────────┐
│ 3. POST /api/v3/meta/       │  Create workspace "JobSignal".
│    workspaces               │  FALLBACK: GET /api/v3/meta/workspaces
└──────────┬──────────────────┘  to find default workspace (CE).
           ▼
┌─────────────────────────────┐
│ 4. POST /api/v3/meta/       │  Create base "JobSignal Engine".
│    workspaces/{workspaceId}/│  Response includes base_id.
│    bases                    │
└──────────┬──────────────────┘
           ▼
┌─────────────────────────────┐
│ 5. POST /api/v2/meta/       │  Create API token for base.
│    bases/{baseId}/          │  Response includes token value.
│    api-tokens               │  (Store in env vars.)
└──────────┬──────────────────┘
           ▼
┌─────────────────────────────┐
│ 6. For each table:          │  Check existing → create if missing.
│    POST /api/v3/meta/       │  Or DROP + CREATE with --force.
│    bases/{baseId}/tables    │
└──────────┬──────────────────┘
           ▼
┌─────────────────────────────┐
│ 7. POST /api/v3/meta/       │  Create individual fields (if table
│    bases/{baseId}/tables/   │  was created without all fields).
│    {tableId}/fields         │
└─────────────────────────────┘
```

### Step 1: Sign Up (first user — fresh install)
```bash
curl -X POST http://localhost:8080/api/v1/auth/user/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "your-secure-password"}'

# Response 200:
# {
#   "email": "admin@example.com",
#   "token": "eyJhbGciOiJIUzI1NiIs...",
#   "display_name": null,
#   ...
# }
```

### Step 2: Sign In (subsequent runs)
```bash
curl -X POST http://localhost:8080/api/v1/auth/user/signin \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "your-secure-password"}'

# Response 200:
# {
#   "token": "eyJhbGciOiJIUzI1NiIs..."
# }
```

### Step 3: Find or Create Workspace

On CE, a default workspace ("My Workspace") is auto-created on first signup. The v3 workspace APIs are documented as Enterprise-only but may work on CE for the single allowed workspace.

```bash
# TRY: Create workspace
curl -X POST http://localhost:8080/api/v3/meta/workspaces \
  -H "xc-auth: <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title": "JobSignal"}'

# Response 200:
# {"id": "w6dw3fo0", "title": "JobSignal", ...}

# FALLBACK: List workspaces to find default
curl http://localhost:8080/api/v3/meta/workspaces \
  -H "xc-auth: <JWT_TOKEN>"

# Response 200:
# {"list": [{"id": "w6dw3fo0", "title": "My Workspace", ...}]}
```

**If workspace API fails on CE:** The default workspace exists but may not be enumerable via API. Safety net approaches (in order of preference):
1. `GET /api/v2/meta/bases` — list any existing bases; extract `workspace_id` from any base in the response
2. `POST /api/v1/db/meta/projects/` — create a base using the v1 API (auto-assigns to default workspace), then extract workspace_id from the response or metadata
3. Query the NocoDB metadata database directly (`nc_bases_v2` table in the `nocodb_db` PostgreSQL database)

### Step 4: Create Base
```bash
curl -X POST http://localhost:8080/api/v3/meta/workspaces/{workspaceId}/bases \
  -H "xc-auth: <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title": "JobSignal Engine", "meta": {"icon_color": "#36BFFF"}}'

# Response 200:
# {
#   "id": "p7nwavd2gcdkzvd",
#   "title": "JobSignal Engine",
#   "workspace_id": "w6dw3fo0",
#   ...
# }
```

### Step 5: Create API Token
```bash
curl -X POST http://localhost:8080/api/v2/meta/bases/{baseId}/api-tokens \
  -H "xc-auth: <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"description": "JobSignal Engine Bootstrap Token"}'

# Response 200:
# {
#   "id": 5,
#   "token": "wxAFzFO2wwOf9ozVRjragBJ7KPWMaW2OGpklGqHh",
#   ...
# }
```

**IMPORTANT:** The token value is only returned once (on creation). Store it immediately in `docker-compose.example.yml` or output to stdout for the user to copy.

### Step 6: Create API Token (Enterprise alternative)

If the v2 endpoint fails or you're on an Enterprise licensed instance, use the v3 endpoint:
```bash
POST /api/v3/meta/tokens
xc-auth: <JWT>
{"title": "JobSignal Engine Bootstrap Token"}
```
Note: The v3 tokens endpoint is Enterprise-only and in beta.

### Authentication Headers

| Token Type | Header | Example |
|-----------|--------|---------|
| JWT (from signin) | `xc-auth: <JWT>` | `xc-auth: eyJhbGciOiJIUzI1NiIs...` |
| API token | `xc-token: <token>` | `xc-token: wxAFzFO2wwOf9ozVRjragBJ7KPWMaW2OGpklGqHh` |
| API token (alt) | `Authorization: Bearer <token>` | `Authorization: Bearer wxAFzFO2wwOf9ozVRjragBJ7KPWMaW2OGpklGqHh` |

## Table & Column Creation API (v3)

**CRITICAL:** The v3 API uses `type` for field type names (not `uidt` like v1/v2). Select options go under `options.choices` (not `dtxp`).

### Create Table with All Fields (one-shot) [CITED: NocoDB v3 Swagger]
```bash
curl -X POST http://localhost:8080/api/v3/meta/bases/{base_id}/tables \
  -H "xc-auth: <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Profile",
    "description": "Your skills, target roles, geography, CV markdown. Drives all AI prompts.",
    "fields": [
      {
        "title": "Full Name",
        "type": "SingleLineText",
        "description": "Used in CV generation"
      },
      {
        "title": "Core Skills",
        "type": "MultiSelect",
        "options": {
          "choices": [
            {"title": "Python", "color": "#36BFFF"},
            {"title": "JavaScript", "color": "#36BFFF"}
          ]
        }
      },
      {
        "title": "Fit Score",
        "type": "Decimal",
        "options": {"precision": 1}
      }
    ]
  }'
```

### Create Individual Field (post-hoc) [CITED: NocoDB v3 Swagger]
```bash
curl -X POST http://localhost:8080/api/v3/meta/bases/{baseId}/tables/{tableId}/fields \
  -H "xc-auth: <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Core Skills",
    "type": "MultiSelect",
    "options": {
      "choices": [
        {"title": "Python", "color": "#36BFFF"},
        {"title": "JavaScript", "color": "#36BFFF"}
      ]
    }
  }'
```

### List Tables (for idempotency check)
```bash
curl http://localhost:8080/api/v3/meta/bases/{base_id}/tables \
  -H "xc-auth: <JWT_TOKEN>"

# Response 200:
# {
#   "list": [
#     {"id": "mq31p5ngbwj5o7u", "title": "Profile", ...},
#     {"id": "mwmlsgaek7932m4", "title": "Pipeline", ...}
#   ]
# }
```

### Delete Table (for --force)
```bash
curl -X DELETE http://localhost:8080/api/v3/meta/bases/{baseId}/tables/{tableId} \
  -H "xc-auth: <JWT_TOKEN>"

# Response: 204 (no content)
```

### Relationship Field Creation (Links)

For linked record relationships (e.g., Pipeline → Tracked Companies), create the field after both tables exist:
```bash
curl -X POST http://localhost:8080/api/v3/meta/bases/{baseId}/tables/{tableId}/fields \
  -H "xc-auth: <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Linked Company",
    "type": "Links",
    "options": {
      "relation_type": "mm",
      "related_table_id": "m_TrackedCompaniesTableId"
    }
  }'
```

**Relation types:**
- `"mm"` = Many-to-Many
- `"hm"` = Has-Many (One-to-Many)
- `"bt"` = Belongs-To (Many-to-One)

**Important:** When creating a Links field on one table, NocoDB automatically creates the corresponding reverse Links field on the related table. The relationship is bidirectional by default.

### Field Type Reference (v3) [CITED: NocoDB v3 Swagger Create Table example]

| v3 `type` value | Options | Notes |
|-----------------|---------|-------|
| `SingleLineText` | — | Plain text |
| `LongText` | `{"rich_text": true}` for rich text | Multi-line |
| `Email` | `{"validation": true}` | With format validation |
| `URL` | `{"validation": true}` | With URL validation |
| `PhoneNumber` | `{"validation": true}` | Phone format |
| `Number` | `{"locale_string": true}` | Integer |
| `Decimal` | `{"precision": 2}` | Precision = decimal places |
| `Currency` | `{"locale": "en-US", "code": "USD"}` | With currency code |
| `Percent` | `{"show_as_progress": true}` | Percentage |
| `Date` | `{"date_format": "YYYY-MM-DD"}` | Date only |
| `DateTime` | `{"date_format": "...", "time_format": "..."}` | Date + time |
| `SingleSelect` | `{"choices": [{"title": "X", "color": "#..."}]}` | Single value from list |
| `MultiSelect` | `{"choices": [{"title": "X", "color": "#..."}]}` | Multiple values from list |
| `Checkbox` | `{"icon": "heart", "color": "#..."}` | Boolean |
| `Rating` | `{"icon": "star", "max_value": 5, "color": "#..."}` | Star rating |
| `Attachment` | — | File upload |
| `JSON` | — | Structured data |
| `Links` | `{"relation_type": "mm", "related_table_id": "..."}` | Cross-table relationship |
| `ID` | — | Auto-increment primary key |
| `CreatedTime` | — | Auto-set timestamp |
| `LastModifiedTime` | — | Auto-updated timestamp |
| `CreatedBy` | — | Auto-set user |
| `LastModifiedBy` | — | Auto-updated user |

## Field Type Mapping (Airtable → NocoDB v3)

### Complete Mapping Table

| Airtable Type | NocoDB v3 Type | Options Key | Notes |
|---------------|----------------|-------------|-------|
| Text | `SingleLineText` | — | Simple text input |
| Long text | `LongText` | — | Multi-line text area |
| URL | `URL` | — | URL with validation |
| Number (integer) | `Number` | `precision: 0` | Whole number |
| Number (1 decimal) | `Decimal` | `precision: 1` | e.g., Fit Score (1-10) |
| Number (6 decimals) | `Decimal` | `precision: 6` | e.g., AI costs |
| Single select | `SingleSelect` | `choices: [{title, color}]` | Dropdown, one value |
| Multiple select | `MultiSelect` | `choices: [{title, color}]` | Tag input, multiple values |
| Checkbox | `Checkbox` | `icon: "heart"`, `color: "#36BFFF"` | Boolean toggle |
| Date | `Date` | `date_format: "YYYY-MM-DD"` | Calendar date picker |
| Attachment | `Attachment` | — | File upload, stored in Docker volume |
| Lookup / Link | `Links` | `relation_type`, `related_table_id` | Cross-table relationship |
| Auto-number | `ID` (auto) | — | Primary key, auto-increment |
| Created time | `CreatedTime` | — | Auto-set on creation |
| Last modified time | `LastModifiedTime` | — | Auto-set on update |
| Email | `Email` | `validation: true` | Email format validation |
| Phone | `PhoneNumber` | `validation: true` | Phone format |
| Rating | `Rating` | `max_value: 5` | Star/icon rating |
| JSON | `JSON` | — | Structured data |
| Formula | `Formula` | `formula_text: "..."` | Calculated field |

### Inline Mapping Dict (per D-07)

The bootstrap script will contain a Python dict for Airtable → NocoDB translation:
```python
# Airtable field type to NocoDB v3 column type mapping
FIELD_TYPE_MAP = {
    "text":            {"type": "SingleLineText"},
    "longText":        {"type": "LongText"},
    "singleSelect":    {"type": "SingleSelect"},   # + options.choices from schema
    "multipleSelect":  {"type": "MultiSelect"},     # + options.choices from schema
    "url":             {"type": "URL"},
    "number":          {"type": "Decimal"},         # precision from schema
    "checkbox":        {"type": "Checkbox"},
    "date":            {"type": "Date"},
    "dateTime":        {"type": "DateTime"},
    "attachment":      {"type": "Attachment"},
    "lookup":          {"type": "Links"},           # needs relation_type + related_table_id
    "email":           {"type": "Email"},
    "phoneNumber":     {"type": "PhoneNumber"},
    "currency":        {"type": "Currency"},
    "percent":         {"type": "Percent"},
    "duration":        {"type": "Duration"},
    "rating":          {"type": "Rating"},
    "rollup":          {"type": "Rollup"},
    "formula":         {"type": "Formula"},
    "count":           {"type": "Number"},
    "autoNumber":      {"type": "AutoNumber"},
}
```

### Pipeline Table — Complete Field Mapping

The Pipeline table has 27 fields — the most complex schema:

| Airtable Field | Airtable Type | NocoDB Type | Options / Precision |
|---------------|---------------|-------------|---------------------|
| Job ID | Text | `SingleLineText` | FNV-1a hash |
| Job Title | Text | `SingleLineText` | |
| Company | Text | `SingleLineText` | |
| Location | Text | `SingleLineText` | |
| Apply Link | URL | `URL` | |
| Job Description | Long text | `LongText` | |
| Source | Single select | `SingleSelect` | Choices: LinkedIn, Indeed, Greenhouse, Ashby, Lever, Glassdoor |
| Source Query | Text | `SingleLineText` | |
| Source Tag | Text | `SingleLineText` | |
| Discovery Date | Date | `Date` | `date_format: "YYYY-MM-DD"` |
| Status | Single select | `SingleSelect` | Choices: New, Evaluated, Applied, Interview, Offer, Rejected, Archived |
| Fit Score | Number (1 dec) | `Decimal` | `precision: 1` |
| Fit Tier | Single select | `SingleSelect` | Choices: High, Medium, Low |
| Match Reasoning | Long text | `LongText` | |
| Matched Skills | Long text | `LongText` | |
| Missing Skills | Long text | `LongText` | |
| CV Tailoring Notes | Long text | `LongText` | |
| Salary Info | Text | `SingleLineText` | |
| AI Evaluation Cost | Number (6 dec) | `Decimal` | `precision: 6` |
| Applied Date | Date | `Date` | `date_format: "YYYY-MM-DD"` |
| Response Date | Date | `Date` | `date_format: "YYYY-MM-DD"` |
| Outcome Notes | Long text | `LongText` | |
| Tailored CV Text | Long text | `LongText` | |
| CV Tailoring Cost | Number (6 dec) | `Decimal` | `precision: 6` |
| Tailored CV | Attachment | `Attachment` | Stored in `nocodb_data` volume |
| Interview Questions | Long text | `LongText` | |
| STAR Responses | Long text | `LongText` | |
| Interview Prep Cost | Number (6 dec) | `Decimal` | `precision: 6` |

### 4-Table Schema Organization

The schema file defines tables in dependency order:

1. **Profile** — No dependencies. Single-row table. 14 fields.
2. **Tracked Companies** — No dependencies. 139 pre-loaded companies. 9 fields.
3. **Pipeline** — No cross-table NocoDB relationships. 27 fields.
4. **Search Queries** — No dependencies. JobSpy search parameters. 12 fields.

**Note on relationships:** The Airtable schema doesn't have explicit linked-record relationships between tables. Pipeline records reference companies and profiles through workflow logic (title matching), not database-level relationships. Therefore, no `Links` fields are needed in Phase 1 — the schema is purely about field types and select options.

### Profile Table — Select Options

| Field | Options |
|-------|---------|
| Seniority Level | Mid, Senior, Staff, Lead, Head |
| Location Preference | Remote Only, Hybrid, On-site, Any |
| Target Geography | Canada, USA, Remote Global, Remote North America, EMEA, UK, APAC |

### Pipeline Table — Select Options

| Field | Options |
|-------|---------|
| Source | LinkedIn, Indeed, Greenhouse, Ashby, Lever, Glassdoor |
| Status | New, Evaluated, Applied, Interview, Offer, Rejected, Archived |
| Fit Tier | High, Medium, Low |

### Tracked Companies — Select Options

| Field | Options |
|-------|---------|
| Scan Method | Greenhouse API, Ashby, Lever |

### Search Queries — Select Options

| Field | Options |
|-------|---------|
| Source Type | JobSpy |

## Bootstrap Script Architecture

### Files to Create

```
scripts/nocodb_bootstrap.py    # Main bootstrap script (~400-600 lines)
scripts/nocodb-schema.json     # Canonical schema definition (~400 lines)
```

### Script Requirements Map

| Requirement | Implementation |
|-------------|----------------|
| `python scripts/nocodb_bootstrap.py` — creates all 4 tables | Full workflow: signup → workspace → base → token → tables |
| `--table Pipeline` — single table | Skip full setup; run tables loop only for specified name |
| `--force` — drop-and-recreate | Check existence → DELETE → CREATE (instead of skip) |
| `--import-data CSV_DIR` — seed from CSV | Enumerate CSVs matching table names; POST records via Data API v3 |

### nocodb_bootstrap.py — CLI Interface

```
usage: nocodb_bootstrap.py [-h] [--nocodb-url URL] [--email EMAIL] [--password PASSWORD]
                           [--table TABLE] [--force] [--import-data CSV_DIR]

Bootstrap NocoDB tables for JobSignal Engine.

optional arguments:
  --nocodb-url URL       NocoDB base URL (default: http://localhost:8080)
  --email EMAIL          Admin email (env: NOCODB_ADMIN_EMAIL, default: admin@jobsignal.local)
  --password PASSWORD    Admin password (env: NOCODB_ADMIN_PASSWORD)
  --table TABLE          Create only this table (e.g., "Pipeline")
  --force                Drop and recreate tables if they exist
  --import-data CSV_DIR  Seed tables from CSV files in directory
  --skip-setup           Skip workspace/base creation (use existing)
  --token-only           Only output the API token and exit
```

### Python Module Structure

```python
#!/usr/bin/env python3
"""
nocodb_bootstrap.py — Bootstrap NocoDB tables for JobSignal Engine.

Creates all 4 tables (Profile, Tracked Companies, Pipeline, Search Queries)
with correct field types, select options, and descriptions via NocoDB Meta API v3.

Usage:
    python scripts/nocodb_bootstrap.py
    python scripts/nocodb_bootstrap.py --table Pipeline
    python scripts/nocodb_bootstrap.py --force
    python scripts/nocodb_bootstrap.py --import-data ./airtable/templates
"""

import argparse
import json
import logging
import os
import sys
import time
import csv
from urllib.parse import urljoin

import requests

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)


# --- API helper functions ---

def _api_request(method, url, **kwargs):
    """Make an API request with common error handling. Returns parsed JSON."""
    ...

def wait_for_nocodb(base_url, timeout=120):
    """Poll GET /api/v1/auth/user/signin until NocoDB is ready."""
    ...

def signup_or_signin(base_url, email, password):
    """POST /api/v1/auth/user/signup; fallback to /signin if user exists."""
    ...

def get_or_create_workspace(base_url, token):
    """Create workspace via v3 API; fallback to listing default."""
    ...

def create_base(base_url, token, workspace_id):
    """POST /api/v3/meta/workspaces/{id}/bases. Returns base_id."""
    ...

def create_api_token(base_url, token, base_id):
    """POST /api/v2/meta/bases/{id}/api-tokens. Returns token string."""
    ...

def load_schema(path):
    """Load and validate nocodb-schema.json."""
    ...

def get_tables(base_url, token, base_id):
    """GET /api/v3/meta/bases/{id}/tables. Returns list."""
    ...

def table_exists(tables, title):
    """Check if a table with given title exists in the list."""
    ...

def create_table(base_url, token, base_id, table_def):
    """POST /api/v3/meta/bases/{id}/tables with title + fields array."""
    ...

def delete_table(base_url, token, base_id, table_id):
    """DELETE /api/v3/meta/bases/{id}/tables/{table_id}."""
    ...

def create_table_idempotent(base_url, token, base_id, table_def, force=False):
    """Check then create. With --force, delete first. Returns table_id."""
    ...

def get_table_id(tables, title):
    """Get table ID by title from table list."""
    ...

def import_csv_data(base_url, token, base_id, table_id, csv_path):
    """Read CSV and POST records via /api/v3/data/bulk/{table_id}."""
    ...


# --- Main ---

def main():
    parser = argparse.ArgumentParser(
        description="Bootstrap NocoDB tables for JobSignal Engine"
    )
    parser.add_argument("--nocodb-url", default="http://localhost:8080")
    parser.add_argument("--email", default=os.getenv("NOCODB_ADMIN_EMAIL", "admin@jobsignal.local"))
    parser.add_argument("--password", default=os.getenv("NOCODB_ADMIN_PASSWORD"))
    parser.add_argument("--table", help="Create only this table (e.g., 'Pipeline')")
    parser.add_argument("--force", action="store_true", help="Drop and recreate tables")
    parser.add_argument("--import-data", metavar="CSV_DIR", help="Seed tables from CSV files")
    parser.add_argument("--skip-setup", action="store_true", help="Skip workspace/base creation")
    parser.add_argument("--token-only", action="store_true", help="Only output the API token")
    args = parser.parse_args()

    # Validate required args
    if not args.password and not args.skip_setup:
        parser.error("--password is required (or set NOCODB_ADMIN_PASSWORD env var)")

    # Workflow
    base_url = args.nocodb_url.rstrip("/")

    if args.token_only:
        # Load existing token from env or config
        token = os.getenv("NOCDB_API_TOKEN")
        if token:
            print(token)
        else:
            logger.error("No API token found in NOCDB_API_TOKEN env var")
            sys.exit(1)
        return

    # Step 1: Wait for NocoDB
    wait_for_nocodb(base_url)

    # Step 2: Sign up or sign in
    jwt_token = signup_or_signin(base_url, args.email, args.password)

    if not args.skip_setup:
        # Step 3: Workspace
        workspace_id = get_or_create_workspace(base_url, jwt_token)

        # Step 4: Base
        base_id = create_base(base_url, jwt_token, workspace_id)

        # Step 5: API token
        api_token = create_api_token(base_url, jwt_token, base_id)
        print(f"\nAPI Token: {api_token}")
        print(f"Add to docker-compose: NOCDB_API_TOKEN={api_token}")
    else:
        # Use existing base — find it from env or list
        base_id = os.getenv("NOCODB_BASE_ID")
        if not base_id:
            # List bases and pick the first one
            ...
        api_token = os.getenv("NOCDB_API_TOKEN", jwt_token)

    # Load schema
    schema_dir = os.path.dirname(os.path.abspath(__file__))
    schema_path = os.path.join(schema_dir, "nocodb-schema.json")
    schema = load_schema(schema_path)

    # Filter tables if --table was specified
    tables_to_create = schema["tables"]
    if args.table:
        tables_to_create = [t for t in tables_to_create if t["title"] == args.table]
        if not tables_to_create:
            logger.error(f"Table '{args.table}' not found in schema")
            sys.exit(1)

    # Step 6: Create tables
    existing_tables = get_tables(base_url, api_token, base_id)
    created_tables = {}

    for table_def in tables_to_create:
        table_id = create_table_idempotent(
            base_url, api_token, base_id, table_def,
            force=args.force
        )
        created_tables[table_def["title"]] = table_id

    # Step 7: Import CSV data if requested
    if args.import_data:
        for table_def in tables_to_create:
            csv_path = os.path.join(args.import_data, f"{table_def['title']}-Grid view.csv")
            if os.path.exists(csv_path):
                table_id = created_tables.get(table_def["title"])
                import_csv_data(base_url, api_token, base_id, table_id, csv_path)

    logger.info("Bootstrap complete.")


if __name__ == "__main__":
    main()
```

### Schema Loading and Validation

The script loads `nocodb-schema.json` and validates:
- Schema has `tables` array
- Each table has `title` and `fields` array
- Each field has `title` and `type`
- Select fields have `options.choices` array
- Required fields (per AIRTABLE-SCHEMA.md) marked with `required: true`

### Data Import Flow (--import-data)

1. Read CSV files from specified directory; expected naming: `{TableTitle}-Grid view.csv`
2. Map CSV columns to NocoDB field names using the schema
3. POST records via `POST /api/v3/data/bulk/{tableId}` (v3 Data API bulk endpoint)
4. Log row count and any field mapping warnings
5. Handle Airtable CSV format (first row = headers, comma-separated)

### NocoDB Wait Loop (startup readiness)

```python
def wait_for_nocodb(base_url, timeout=120):
    """Wait for NocoDB to be ready after container start."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            r = requests.get(f"{base_url}/api/v1/auth/user/signin", timeout=5)
            # Any response means the server is up
            return True
        except requests.ConnectionError:
            logger.info("Waiting for NocoDB to start...")
            time.sleep(5)
        except Exception:
            time.sleep(5)
    raise RuntimeError(f"NocoDB not ready after {timeout}s")
```

### CSV Import via Data API v3

```bash
# Bulk insert records
curl -X POST http://localhost:8080/api/v3/data/bulk/{tableId} \
  -H "xc-token: <API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '[
    {"Field1": "value1", "Field2": "value2"},
    {"Field1": "value3", "Field2": "value4"}
  ]'
```

## Error Handling & Idempotency

### Check-Then-Skip Pattern

```python
def create_table_idempotent(base_url, token, base_id, table_def, force=False):
    """Create a table only if it doesn't exist. Returns table_id."""
    existing = get_tables(base_url, token, base_id)

    for t in existing.get("list", []):
        if t["title"] == table_def["title"]:
            if force:
                logger.info(f"Table '{table_def['title']}' exists. --force: deleting...")
                delete_table(base_url, token, base_id, t["id"])
                time.sleep(1)  # Wait for deletion to propagate
            else:
                logger.info(f"Table '{table_def['title']}' already exists. Skipping.")
                return t["id"]

    created = create_table(base_url, token, base_id, table_def)
    logger.info(f"Created table '{table_def['title']}' (id: {created['id']})")
    return created["id"]
```

### Error Handling Matrix

| Scenario | HTTP Code | Detection | Handling |
|----------|-----------|-----------|----------|
| NocoDB not ready | Connection refused | `requests.ConnectionError` | Retry 5x with 5s backoff in `wait_for_nocodb()` |
| User already exists | 200 (signup returns error message) | Response contains "already exists" | Fall through to signin |
| Token expired | 401 | Response status 401 | Re-signin, retry the failed request |
| Table not found (delete) | 404 | Response status 404 | Log and continue (already deleted) |
| Base not found | 404 | Response status 404 | Log error, exit |
| Workspace API not available | 403 or 404 | Response status 4xx | Fall back to listing default workspace |
| Invalid field type | 400/422 | Response status 4xx | Log full request/response, exit |
| Rate limited | 429 | Response status 429 | Wait 1s, retry up to 3x |
| API token creation fails | 403 | Response status 403 | Fall back to using JWT token (logged in session only) |
| CSV data mismatch | 400 (on data POST) | Check response | Log field name mismatch, skip row, continue |

### Safety Brakes (consistent with existing patterns)

- Rate limit: 100ms delay between API calls
- Max CSV batch size: 10 records per POST request
- Retry: 3 attempts with 5s intervals on transient API failures (status 429, 503)
- Empty state: Check if NocoDB is reachable before starting operations
- `--force` safety: Print DESTRUCTIVE ACTION warning; require confirmation if STDIN is a TTY; skip confirmation in CI/non-interactive mode
- Do NOT delete the base or workspace with `--force` — only tables

### Signup/Signin Idempotency

```python
def signup_or_signin(base_url, email, password):
    """Try signup first. If user exists, sign in."""
    try:
        r = requests.post(f"{base_url}/api/v1/auth/user/signup", json={
            "email": email, "password": password
        })
        if r.status_code == 200:
            token = r.json().get("token")
            logger.info("First-time setup: admin user created")
            return token
        # Fall through to signin
    except Exception:
        pass

    # Sign in
    r = requests.post(f"{base_url}/api/v1/auth/user/signin", json={
        "email": email, "password": password
    })
    if r.status_code != 200:
        raise RuntimeError(f"Signin failed: {r.text}")
    return r.json()["token"]
```

## Schema Definition Format (nocodb-schema.json)

### Canonical Structure [ASSUMED — derived from Airtable schema + NocoDB v3 field types]

```json
{
  "version": "1.0",
  "description": "JobSignal Engine NocoDB Schema",
  "base_title": "JobSignal Engine",
  "tables": [
    {
      "title": "Profile",
      "description": "Your skills, target roles, geography, CV markdown. Drives all AI prompts.",
      "fields": [
        {
          "title": "Full Name",
          "type": "SingleLineText",
          "required": true,
          "description": "Used in CV generation"
        },
        {
          "title": "Core Skills",
          "type": "MultiSelect",
          "required": true,
          "description": "Primary technical skills",
          "options": {
            "choices": [
              {"title": "Python", "color": "#36BFFF"}
            ]
          }
        },
        {
          "title": "Seniority Level",
          "type": "SingleSelect",
          "required": false,
          "options": {
            "choices": [
              {"title": "Mid", "color": "#36BFFF"},
              {"title": "Senior", "color": "#36BFFF"},
              {"title": "Staff", "color": "#36BFFF"},
              {"title": "Lead", "color": "#36BFFF"},
              {"title": "Head", "color": "#36BFFF"}
            ]
          }
        },
        {
          "title": "CV Markdown",
          "type": "LongText",
          "required": true,
          "description": "Full CV in markdown — critical for STAR responses and CV tailoring"
        },
        {
          "title": "Notification Email",
          "type": "Email",
          "required": true,
          "description": "Where alerts and digests go"
        }
      ]
    }
  ]
}
```

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| Fields use NocoDB v3 `type` names | Directly passable to Meta API without translation |
| Airtable type not stored | No downstream consumer needs it; the schema is NocoDB-native |
| Select options include color | v3 API requires `color` key (use `#36BFFF` as default) |
| `required` field boolean | Mapped to `notNull: true` in API call |
| Tables ordered by dependency | No FK dependencies between tables, but order matters for readability |
| `meta.icon` for table emoji | Optional — can skip for schema v1.0 |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| NocoDB v2 API (`uidt`, `dtxp`) | NocoDB v3 API (`type`, `options.choices`) | v0.300+ (2025 H2) | v3 is recommended for all new integrations; v2 is in maintenance mode |
| User auth tokens (deprecated) | API tokens (`xc-token`) | v0.205.1 | API tokens are persistent; JWT tokens expire after 10h |
| NC_ADMIN_EMAIL/PASSWORD auto-setup | API signup/signin flow | v0.301.0 bug | The env vars caused workspace ID issues (#12874); fix released |
| MinIO/S3 for attachments | Local Docker volume storage | N/A | Single-node deployment default; no extra services needed |
| Global API tokens | Fine-grained base-scoped tokens | v0.305+ (2026 releases) | v2 `POST /api/v2/meta/bases/{id}/api-tokens` supports scoped tokens |
| Manual first-run wizard | API-driven auto-setup | Current phase | Bootstrap script eliminates all manual UI steps (per D-08) |

## Common Pitfalls

### Pitfall 1: JWT Token Expiry Mid-Script
**What goes wrong:** The bootstrap script's JWT token (from signin) expires during long-running operations.
**Why it happens:** `NC_JWT_EXPIRES_IN` defaults to 10h. Long CSV imports could exceed this on slow connections.
**How to avoid:** Create the API token (Step 5) as early as possible, then use `xc-token` for all subsequent API calls. API tokens on CE are persistent and never expire.
**Warning signs:** 401 responses on API calls that previously worked.

### Pitfall 2: v3 API Field Type Names vs v1/v2
**What goes wrong:** Using `uidt` (v1/v2) instead of `type` (v3) in the request body.
**Why it happens:** Most online examples, blog posts, and community scripts use v1/v2 API docs. The NocoDB SDK also uses `uidt` internally.
**How to avoid:** The bootstrap script's FIELD_TYPE_MAP explicitly maps to v3 `type` values. Always reference `https://nocodb.com/apis/v3/meta` — not blog posts or community snippets.
**Warning signs:** 400 Bad Request with "invalid type" message.

### Pitfall 3: Select Options Silently Dropped
**What goes wrong:** SingleSelect/MultiSelect options are not persisted during table creation.
**Why it happened:** In v2, this was a known bug (GitHub issue #13164). In v3, `options.choices` is properly handled.
**How to avoid:** Verify the options are nested under `fields[n].options.choices` with `title` and `color` keys. Confirm by checking the NocoDB UI after creation.
**Warning signs:** Select fields appear in the table but have no dropdown options when editing a record.

### Pitfall 4: NC_ADMIN_EMAIL/PASSWORD Causing Workspace Issues
**What goes wrong:** Setting these env vars on a fresh install causes `fk_workspace_id` to remain null, making the base inaccessible.
**Why it happened:** Bug in NocoDB v0.301.0 (GitHub issue #12874) — these vars were intended for superuser updates, not initial setup.
**Current status:** Fixed in latest release. But the API approach (signup/signin) is more robust per D-08.
**How to avoid:** Do NOT set `NC_ADMIN_EMAIL` or `NC_ADMIN_PASSWORD` in docker-compose. Use the API.

### Pitfall 5: API Token Not Storable After Creation
**What goes wrong:** The token value is only returned once — subsequent GET requests return metadata with a masked/hashed token.
**Why it happens:** By design — the raw token is a secret. NocoDB only returns it in the creation response.
**How to avoid:** Store the token immediately. The bootstrap script outputs it to stdout and instructs the user to add it to `docker-compose.example.yml`.
**Safety net:** If the token is lost, create a new one via the API or NocoDB UI (Account Settings → API Tokens).

### Pitfall 6: Links/Relationship Fields Require Both Tables
**What goes wrong:** Creating a `Links` field referencing a `related_table_id` that doesn't exist yet.
**Why it happens:** The relationship references the other table by its internal NocoDB ID (prefixed `m_`), which is only known after the related table is created.
**How to avoid:** Create fields in two passes: Pass 1 creates all tables with their self-contained fields (omit `Links` type fields). Pass 2 iterates through the now-known table IDs and creates any cross-table `Links` fields.
**Note for Phase 1:** No `Links` fields are required — all Pipeline fields are self-contained.

### Pitfall 7: Docker Compose Healthcheck Timing
**What goes wrong:** NocoDB container starts and fails because PostgreSQL isn't ready yet.
**Why it happens:** `depends_on` with `condition: service_healthy` prevents this, but if PostgreSQL's healthcheck isn't configured correctly, the check passes prematurely.
**How to avoid:** Use `pg_isready -U nocodb_user -d nocodb_db` as the healthcheck test (not just `pg_isready -U nocodb_user`). The bootstrap script includes its own `wait_for_nocodb()` timeout loop as a second safety net.
**Warning signs:** NocoDB logs show "connect ECONNREFUSED" database connection errors.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP requests | Custom HTTP library | Python `requests` | Battle-tested, handles auth headers, JSON encoding, error responses |
| CSV parsing | Custom CSV parser | Python `csv` module | Handles quoting, escaping, encoding — edge cases are subtle |
| CLI argument parsing | Manual `sys.argv` | Python `argparse` | Built-in, handles `--help`, validation, type coercion |
| Logging | `print()` statements | Python `logging` | Timestamps, levels, consistent with existing scripts |
| JSON serialization | Manual string building | `json.dumps()` | Handles edge cases (None, special chars, encoding) |
| API retry logic | Full retry library | Simple loop with `time.sleep()` | The use case is simple (startup/transient retry); no need for tenacity/backoff |

**Key insight:** The bootstrap script's HTTP API calls are straightforward CRUD operations. A full retry library or SDK wrapper adds complexity without benefit. Python stdlib + `requests` covers every requirement.

## Validation Architecture

> Per `.planning/config.json`: `workflow.nyquist_validation: true` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual validation (no test automation for infra phase) |
| Config file | None — Phase 1 is infrastructure + script; no unit tests |
| Quick run command | `docker compose -f docker-compose.example.yml up -d && python scripts/nocodb_bootstrap.py` |
| Full suite command | Same as quick run (single verification flow) |

### Phase Requirements → Validation Map

| Req ID | Verification Method | How to Verify | Success Criteria |
|--------|-------------------|---------------|------------------|
| INFR-01 | Manual Docker check | `docker compose ps` shows `nocodb` and `nocodb-postgres` running; `curl http://localhost:8080` returns NocoDB UI HTML | Both services Up, UI accessible |
| INFR-02 | Manual env var check | Inspect `docker compose config`; verify `NC_DB`, `NC_AUTH_JWT_SECRET`, `NC_ATTACHMENT_FIELD_SIZE` are set | All 5 env vars present in NocoDB service |
| BOOT-01 | Script execution test | Run `python scripts/nocodb_bootstrap.py` against fresh NocoDB; verify all 4 tables exist in NocoDB UI with correct fields | 4 tables created, each with correct field types and select options |
| BOOT-02 | Schema file audit | Read `scripts/nocodb-schema.json`; compare field types against AIRTABLE-SCHEMA.md | All fields across 4 tables mapped to correct NocoDB types |
| BOOT-03 | Import test | Run `python scripts/nocodb_bootstrap.py --import-data ./airtable/templates` then check record counts | Records exist in each table matching CSV row counts |
| BOOT-04 | Single table test | Drop Pipeline table, run `python scripts/nocodb_bootstrap.py --table Pipeline` | Only Pipeline table created; Profile, Tracked Companies, Search Queries unchanged |

### Validation Sequence

1. **Start NocoDB:** `docker compose -f docker-compose.example.yml up -d` → verify `docker compose ps` shows both new services healthy
2. **Run bootstrap:** `python scripts/nocodb_bootstrap.py --email admin@test.local --password test123` → verify exit code 0 and "Bootstrap complete." log
3. **Verify UI:** Open `http://localhost:8080` → sign in with admin@test.local / test123 → verify all 4 tables visible with correct fields
4. **Incremental test:** Delete Pipeline table in UI → run `python scripts/nocodb_bootstrap.py --table Pipeline` → verify only Pipeline recreated
5. **Force test:** Run `python scripts/nocodb_bootstrap.py --force` → verify tables recreated (check `updated_at` timestamps in NocoDB)
6. **Import test (if data available):** Run against CSV exports → verify record counts match

## Security Domain

> `security_enforcement: true` in config.json. Required section.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | NocoDB handles its own auth (JWT + API tokens); bootstrap script uses admin credentials |
| V3 Session Management | Yes | `xc-auth` JWT for session; `xc-token` API token for persistent access |
| V4 Access Control | Limited | Single-user pipeline; bootstrap creates admin user; API token is admin-level |
| V5 Input Validation | Yes | Bootstrap script validates schema JSON, CSV data, and API responses |
| V6 Cryptography | Yes | `NC_AUTH_JWT_SECRET` for JWT signing; TLS via Caddy in production |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API token exposed in docker-compose.yml | Information Disclosure | `.gitignore` for real credentials; `docker-compose.example.yml` uses `REPLACE_WITH_` placeholders |
| Unauthorized NocoDB access (port 8080 exposed) | Tampering | Only expose behind Caddy reverse proxy (port 80/443); bind to `127.0.0.1:8080` for local-only |
| Weak JWT secret | Information Disclosure | Require user to generate via `openssl rand -base64 32`; document in SETUP.md |
| Bootstrap credentials hardcoded in script | Information Disclosure | Credentials passed via CLI args or env vars; never hardcoded |

### Phase 1 Security Notes

- **No production secrets in this phase.** The admin email/password and JWT secret are user-configured at deployment time.
- API tokens on Community Edition default to all-resources access. This is acceptable for single-user deployment.
- The bootstrap script uses `xc-auth` (JWT) for setup operations, then switches to `xc-token` (API token) for table creation.

## Open Questions

1. **Will `POST /api/v3/meta/workspaces` work on Community Edition?**
   - What we know: The v3 Swagger says "Enterprise only." CE docs say CE supports 1 workspace.
   - What's unclear: Whether the API allows listing/creating that one workspace or whether it's completely gated.
   - Recommendation: Implement with try/except — try workspace creation; if 403/404, fall back to listing default workspace.

2. **Does the `POST /api/v2/meta/bases/{baseId}/api-tokens` endpoint work on CE?**
   - What we know: The docs say fine-grained tokens are Business+ / Enterprise, but CE auto-assigns all-resources access.
   - What's unclear: Whether the v2 endpoint is accessible on CE at all, or only the UI can create tokens.
   - Recommendation: Try the v2 endpoint; fall back to using the JWT token directly if it fails.

3. **Exact format of the `POST /api/v3/data/bulk/{tableId}` endpoint for CSV import**
   - What we know: The v3 Data API has a bulk endpoint documented at `https://data-apis-v3.nocodb.com/`.
   - What's unclear: Exact request format and field mapping behavior.
   - Recommendation: Test with a sample CSV after NocoDB is running. If bulk endpoint has issues, insert records one-by-one as fallback.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `POST /api/v3/meta/workspaces` may work on CE | Meta API Auth | If not, script falls back to listing default workspace; additional code path to test |
| A2 | `POST /api/v2/meta/bases/{id}/api-tokens` works on CE | Meta API Auth | If not, use JWT token for bootstrap; store JWT in docker-compose env (shorter-lived) |
| A3 | No `Links` fields needed between Pipeline and other tables | Field Type Mapping | If Pipeline needs linked company/profile records, add Links fields in Phase 2 or later |
| A4 | The v3 bulk data endpoint is `POST /api/v3/data/bulk/{tableId}` | Bootstrap Script | If endpoint differs, insert records individually via `POST /api/v3/data/{tableId}` |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | Running NocoDB + PostgreSQL containers | ✓ | 29.5.3 | — |
| Docker Compose | Service orchestration | ✓ | v5.1.4 | — |
| Python 3 | Running bootstrap script | ✓ | 3.14.5 | — |
| `requests` | API calls from bootstrap | Needs install | — | `pip install requests` |
| PostgreSQL | NocoDB backend | Via Docker | 16-alpine | — |
| Port 8080 | NocoDB web UI | Available | — | Change port via `NC_PORT` or compose port mapping |
| OpenSSL | JWT secret generation | ✓ | (build 802, via LibreSSL) | Manual UUID v4 |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** `requests` — install via `pip3 install requests` (or package in a Dockerfile if the script runs inside a container).

## Sources

### Primary (HIGH confidence)
- [CITED: NocoDB v3 Meta API Swagger `https://nocodb.com/apis/v3/meta`] — Field types, table creation, workspace/base endpoints, Links/relationship types
- [CITED: NocoDB Docker setup docs `https://nocodb.com/docs/self-hosting/installation/docker`] — Docker Compose patterns, NC_DB format, PostgreSQL healthcheck
- [CITED: NocoDB Environment Variables `https://docs.nocodb.com/getting-started/self-hosted/environment-variables`] — NC_DB, NC_AUTH_JWT_SECRET, NC_ATTACHMENT_FIELD_SIZE documentation
- [CITED: NocoDB API Tokens `https://nocodb.com/docs/product-docs/account-settings/api-tokens`] — xc-token auth pattern (xc-auth / xc-token / Bearer headers)
- [CITED: NocoDB Columns API `https://www.mintlify.com/nocodb/nocodb/api/columns`] — Column types, SingleSelect/MultiSelect options format
- [CITED: NocoDB Field LinkToAnotherRecord `https://nocodb.com/docs/scripts/api-reference/field`] — Links type relation_type, related_table_id
- [CITED: GitHub Issue #12874 `https://github.com/nocodb/nocodb/issues/12874`] — NC_ADMIN_EMAIL/NC_ADMIN_PASSWORD bug and resolution
- [CITED: GitHub Issue #13164 `https://github.com/nocodb/nocodb/issues/13164`] — v2 select options bug; v3 recommended
- [CITED: Airtable schema `airtable/AIRTABLE-SCHEMA.md`] — Source field types, select options, descriptions for translation
- [CITED: Existing docker-compose.example.yml] — Service definition patterns, volume naming conventions, env var formatting

### Secondary (MEDIUM confidence)
- [ASSUMED: `POST /api/v2/meta/bases/{id}/api-tokens` on CE] — Token creation endpoint from community examples; needs verification on CE
- [ASSUMED: CE workspace API gating] — Enterprise-only annotation in Swagger but CE has 1 workspace; exact API behavior needs testing

### Tertiary (LOW confidence)
- [ASSUMED: v3 bulk data endpoint format] — Not verified against running instance; exact field mapping behavior may differ

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all components well-documented and verified
- Architecture: HIGH — API workflow derived from multiple official sources
- Docker Compose: HIGH — follows official NocoDB Docker Compose pattern
- Field type mapping: HIGH — derived from v3 Swagger examples + Airtable schema documentation
- Pitfalls: HIGH — sourced from GitHub issues, community reports, and known v2→v3 differences
- API token & workspace behavior on CE: MEDIUM — needs runtime verification
- Bulk data import endpoint: LOW — needs testing against running NocoDB instance

**Research date:** 2026-06-09
**Valid until:** 2026-07-09 (30 days; NocoDB at `:latest` may introduce breaking API changes)


