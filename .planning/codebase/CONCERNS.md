# Codebase Concerns

**Analysis Date:** 2026-06-09

## Tech Debt

### Hardcoded Airtable Base ID Across All Workflows

- **Issue:** The Airtable base ID `appE808oZ5gTSQzUY` is hardcoded in every Airtable node across all 8 workflow JSON files. Any user deploying this must manually update every node to their own base ID. There is no centralized configuration or environment variable injection.
- **Files:** `workflows/01a-scanner-greenhouse.json` (lines 19-23, 128-132, 182-185, 656-659, etc.), `workflows/01b-scanner-ashby.json`, `workflows/01c-scanner-lever.json`, `workflows/01d-scanner-jobspy.json`, `workflows/02-evaluator.json`, `workflows/03-tailor.json`, `workflows/04-housekeeper.json`, `workflows/06-alerter.json`
- **Impact:** Every new deployment requires editing 40+ Airtable node configurations across 8 files. Miss one, and the workflow silently fails or operates on the wrong base.
- **Fix approach:** Use n8n environment variables or a shared workflow-level parameter for the base ID. Alternatively, add a setup script that performs find-and-replace across all JSON files.

### Hardcoded Table IDs Across All Workflows

- **Issue:** Table IDs (`tbl5yytlFEcocSK2v`, `tblqvCvqMIczRGjLi`, `tbl4hqn6sfFVbLuzd`, `tblWfL2m2XlVrR3yj`) are hardcoded in every node. Same problem as the base ID.
- **Files:** All workflow JSON files (same locations as base ID above)
- **Impact:** Same as base ID — tedious manual config, fragile.
- **Fix approach:** Same as base ID — centralize into variables.

### Hardcoded Developer Email Address

- **Issue:** `rizwan@velocyt.ca` is hardcoded as the "from" email address in the Evaluator, Housekeeper, and Alerter workflows.
- **Files:** `workflows/02-evaluator.json` (line 565), `workflows/04-housekeeper.json` (line 1168), `workflows/06-alerter.json` (line 232)
- **Impact:** If a user deploys without changing this, all notifications come from the developer's email. Also means the developer's personal email is committed to a public repo.
- **Fix approach:** Replace with a placeholder like `alerts@yourdomain.com` or pull from an environment variable.

### Opaque Credential IDs in Every Workflow

- **Issue:** Every credential reference uses opaque n8n instance IDs: `airtableTokenApi` with `"id": "Ngaw78ZStScPicDq"`, `openAiApi` with `"id": "kFMK08Shp2G4NxIN"`, `resendApi` with `"id": "7AfjbpJFdPBTrKVV"`, `httpHeaderAuth` with `"id": "bHbDyibFzOPyv8jj"`. These are specific to the developer's n8n instance and will not work on import for any other deployment.
- **Files:** Every workflow JSON file references these credential IDs.
- **Impact:** Every user must reconfigure all credentials after importing workflows. n8n does prompt for this, but it's a manual, error-prone process across 8 workflows and ~20 credential references.
- **Fix approach:** Consider generating a setup checklist or providing a script that validates credential setup post-import.

### Massive Duplication of Airtable Column Schema

- **Issue:** The full Airtable Pipeline table schema (the `schema` array under `columns`) is duplicated in every workflow that writes to or reads from the Pipeline table. This is a ~300-line block per workflow, totaling thousands of lines of nearly identical JSON across 7 workflows. Any schema change (adding/removing a field) must be replicated manually across all workflows.
- **Files:** `workflows/01a-scanner-greenhouse.json`, `workflows/01b-scanner-ashby.json`, `workflows/01c-scanner-lever.json`, `workflows/01d-scanner-jobspy.json`, `workflows/02-evaluator.json`, `workflows/03-tailor.json`, `workflows/04-housekeeper.json`
- **Impact:** Schema drift is almost guaranteed — different workflows have slightly different sets of "removed" columns: `01c-scanner-lever.json` includes "Tailored CV", "Tailored CV Text", "CV Tailoring Cost", "Interview Questions", "STAR Responses", "Interview Prep Cost" fields that `01a-scanner-greenhouse.json` does not. Over time these will diverge.
- **Fix approach:** There is no good solution within n8n's current workflow format. Consider external tooling to generate workflow JSON from a single schema definition, or document that schema changes must be replicated across all workflows.

### Duplicated JavaScript Code Nodes

- **Issue:** Core logic like FNV-1a hashing, HTML entity decoding, geography filtering, deduplication logic, and AI response parsing is duplicated across multiple workflow files. For example, the FNV-1a hash function appears in at least 4 scanner workflows. The `Deduplicate vs Pipeline` Code node has the same logic in 4 places. The geography filter configuration is duplicated across all 4 scanners with slightly different GEO_CONFIG arrays.
- **Files:** `workflows/01a-scanner-greenhouse.json` (lines 86-96, 166-176, 620-631), `workflows/01b-scanner-ashby.json`, `workflows/01c-scanner-lever.json`, `workflows/01d-scanner-jobspy.json`
- **Impact:** A bug fix or improvement to any shared logic must be applied 4 times. Inconsistencies exist already — the JobSpy scanner (01d) has hardcoded geography defaults `const userGeographies = ['Canada', 'Remote Global', 'Remote North America']` while the other 3 scanners read from the Profile table.
- **Fix approach:** n8n doesn't support shared Code nodes natively. Consider an external library pattern with sub-workflow calls, or at minimum a linting step that checks for consistency.

### Missing Workflow 05

- **Issue:** Workflows are numbered 01a-d, 02, 03, 04, and 06. There is no Workflow 05. The numbering gap is undocumented, which may confuse users trying to understand the pipeline sequence.
- **Files:** N/A — gap in `workflows/` directory listing
- **Impact:** Minor confusion for operators. The intent appears to be that 05 is intentionally skipped (possibly reserved for future use).
- **Fix approach:** Add a placeholder README in the gap or rename to close it.

### Duplicate Instance Meta in Workflow Files

- **Issue:** Every workflow JSON contains a `meta.instanceId` field pointing to `d7e19fca9705d4d0c36e6fe71822071e2ec1e1c76f266658ed6763dfc41db437` — the developer's n8n instance ID.
- **Files:** All 8 workflow JSON files
- **Impact:** Cosmetic — on import, n8n replaces this with the target instance's ID. But it's stale data committed to the repo.
- **Fix approach:** Strip the `meta` block from exported workflow JSON before committing, or generate workflows from templates.

## Known Bugs

### JobSpy Scanner Geography Not Read From Profile

- **Symptoms:** The JobSpy scanner (`01d-scanner-jobspy.json`) has hardcoded geography defaults `['Canada', 'Remote Global', 'Remote North America']` instead of reading from the Profile's `Target Geography` field like the other 3 scanners do. There's a TODO comment acknowledging this.
- **Files:** `workflows/01d-scanner-jobspy.json` (line 111, in the `Parse & Filter Jobs` Code node)
- **Trigger:** When a user configures a geography other than Canada/Remote Global/Remote NA in their Profile, the JobSpy scanner will silently use the wrong filter.
- **Workaround:** Manually edit the hardcoded array in the JobSpy Code node to match your Target Geography.
- **Fix:** Implement the same `$('Get Profile').first().json` pattern used in scanners 01a, 01b, and 01c.

### Schedule Triggers Use Hardcoded Times With No Timezone Awareness

- **Symptoms:** Scanner schedules are set to 8:00, 8:05, 8:10, 8:15 AM. The Evaluator at 9:00 AM. These fire based on the server's `GENERIC_TIMEZONE` (self-hosted) or UTC (n8n Cloud). Users regularly report triggers firing at unexpected times.
- **Files:** `workflows/01a-scanner-greenhouse.json` (lines 636-640), `workflows/01b-scanner-ashby.json` (lines 598-605), `workflows/01c-scanner-lever.json` (lines 647-654), `workflows/01d-scanner-jobspy.json` (lines 17-23), `workflows/02-evaluator.json` (lines 1144-1151), `workflows/03-tailor.json` (lines 17-24), `workflows/04-housekeeper.json` (lines 17-24), `workflows/06-alerter.json` (lines 17-24)
- **Trigger:** Any deployment where the server timezone differs from the developer's (America/Toronto).
- **Workaround:** Manually adjust schedule times based on UTC offset.
- **Fix:** Document that all schedule times should use UTC, or use n8n's timezone-aware CRON expressions.

### Glassdoor Search Returns 403

- **Symptoms:** Including "glassdoor" in the JobSpy Sites configuration results in 0 results. Glassdoor has blocked programmatic access since early 2026.
- **Files:** `docs/CUSTOMIZATION.md` (line 203) — documented as blocked. Also `scripts/jobspy_service.py` — still accepts "glassdoor" as a valid site name with no warning.
- **Trigger:** Any Search Query that includes "glassdoor" in its JobSpy Sites field.
- **Workaround:** Remove "glassdoor" from all JobSpy Sites configurations.
- **Fix:** Add server-side validation in `jobspy_service.py` that warns or rejects "glassdoor" as a site. Update the Search Queries template to not include it by default.

### OOM Kills on 1GB Droplet With Both Sidecars

- **Symptoms:** Running all 5 containers (n8n, Postgres, Caddy, jobspy-scanner, cv-renderer) on a 1GB RAM VPS causes the OOM killer to terminate containers. Memory usage can spike to 960MB under load.
- **Files:** `docs/SETUP.md` (lines 104-106), `docs/COST-GUIDE.md` (lines 29-30, 45-47), `docker-compose.example.yml`
- **Trigger:** Heavy scan volume where both jobspy-scanner and cv-renderer process simultaneously.
- **Workaround:** Stop sidecars when not in use: `docker compose stop jobspy-scanner cv-renderer`
- **Fix:** Document minimum 2GB requirement clearly in `docker-compose.example.yml`. Add Docker resource limits to containers.

## Security Considerations

### No Env Var Management for Workflow Config

- **Risk:** Airtable base IDs, table IDs, and credential references are hardcoded in workflow JSON files. If a user accidentally commits their modified workflow JSON (with their actual Airtable PAT or base ID) to a public fork, sensitive infrastructure details are exposed.
- **Files:** All 8 workflow JSON files
- **Current mitigation:** `.gitignore` excludes `.env` files. The issue template is public but contains no secrets. The exported workflow JSON does NOT contain the actual credential values — only credential IDs that reference the n8n credential store.
- **Recommendations:** Add a pre-commit hook that warns if any workflow JSON contains credential IDs that differ from the template defaults. Document that users should not commit their modified workflow exports to public repos.

### CV Renderer Has No Input Validation

- **Risk:** `cv_service.py` accepts arbitrary JSON and writes files to `/tmp/` using a user-controlled `filename` parameter. There is no path traversal protection. If an attacker can reach this service (port 3456), they could write DOCX files to arbitrary paths via `../../etc/passwd.docx` patterns.
- **Files:** `scripts/cv_service.py` (lines 37-52)
- **Current mitigation:** This service is only accessible within the Docker network (not exposed to the internet). But it has no authentication whatsoever.
- **Recommendations:** Sanitize the `filename` parameter to strip path separators. Add a simple API key or shared-secret authentication for internal service calls. Use `os.path.basename()` to prevent traversal.

### JobSpy Service Has No Authentication

- **Risk:** `jobspy_service.py` exposes `/scan` and `/batch` endpoints with zero authentication. Any container in the Docker network can trigger arbitrary LinkedIn/Indeed scraping.
- **Files:** `scripts/jobspy_service.py` (lines 143-288)
- **Current mitigation:** Only accessible within the Docker network. The n8n workflow is the only expected caller.
- **Recommendations:** Add a shared secret (e.g., `X-API-Key` header) validated on each request. This is a low-severity risk since it requires Docker network access, but defense-in-depth is cheap.

### Airtable PAT Exposed Via Header Auth Credential

- **Risk:** The Workflow 3 Tailor uses a Header Auth credential storing `Bearer <Airtable PAT>` to upload DOCX attachments directly to Airtable's content API. If this credential is shared or the n8n instance is compromised, the PAT is leaked.
- **Files:** `workflows/03-tailor.json` (line 669-671, HTTP Request node), `docs/SETUP.md` (lines 223-228)
- **Current mitigation:** The PAT is stored in n8n's encrypted credential store.
- **Recommendations:** Use an Airtable Personal Access Token with the minimum required scopes (`data.records:write` only for the content API). Document that this credential should use a separate, limited-scope PAT.

### No HTTPS for Internal Services

- **Risk:** Communication between n8n and sidecar services (`cv-renderer:3456`, `jobspy-scanner:3457`) is over plain HTTP with no TLS.
- **Files:** `docker-compose.example.yml`, `workflows/01d-scanner-jobspy.json` (line 87), `workflows/03-tailor.json` (line 187), `workflows/04-housekeeper.json` (line 1168)
- **Current mitigation:** Traffic is within the Docker internal network, not exposed externally.
- **Recommendations:** For production deployments on shared infrastructure, consider mTLS between sidecars.

## Performance Bottlenecks

### Sequential Workflow Pipeline

- **Problem:** The workflow pipeline is entirely sequential: scanners run at 8:00-8:15, Evaluator at 9:00, Tailor at 9:30. Each workflow must complete before the next starts. If any scanner takes long (many companies), the Evaluator may not find jobs in time.
- **Files:** Workflow schedule triggers across all workflows
- **Cause:** Hardcoded schedule times with no chain-triggering. The Evaluator doesn't wait for scanners to finish — it just runs at a fixed schedule time and assumes scanners are done.
- **Improvement path:** Use n8n workflow-to-workflow triggers (webhooks) so the Evaluator fires immediately when scanning completes, rather than waiting for the next scheduled time.

### AI Scoring Is Single-Threaded With Artificial 2-Second Delays

- **Problem:** The Evaluator processes jobs one at a time with a 2-second pause between each, even though jobs are independent. At 30 new jobs/day, this adds 60 seconds of unnecessary wait time.
- **Files:** `workflows/02-evaluator.json` (Wait 2s node, line 1165-1173)
- **Cause:** The 2-second delay was added to avoid Google AI Studio's 15 RPM rate limit. It's unnecessarily conservative for low job volumes.
- **Improvement path:** Make the delay dynamic based on the number of jobs and AI provider limits. Add a configurable batch size parameter.

### JobSpy Batch Processing Is Serial

- **Problem:** The `/batch` endpoint processes queries sequentially (one `run_single_query` at a time), even though queries are independent. With 10 queries at ~30 seconds each, a full batch takes 5 minutes.
- **Files:** `scripts/jobspy_service.py` (lines 245-273)
- **Cause:** Simple sequential for-loop in the batch handler.
- **Improvement path:** Use Python `concurrent.futures.ThreadPoolExecutor` to parallelize queries, with a configurable max_workers (default 3-4) to avoid overloading the scraping targets.

### Memory Spike During JobSpy Large Result Sets

- **Problem:** A single query with `results_wanted=100` can return a large DataFrame. With 10 queries in a batch, all results are held in memory before serialization. On a 1GB VPS, this contributes to OOM risk.
- **Files:** `scripts/jobspy_service.py` (lines 245-273, 88-109)
- **Cause:** Results are accumulated in a list-of-dicts per query, then combined into the response.
- **Improvement path:** Stream results in smaller chunks. Add a `max_results` safety brake at the batch level (not just per-query).

## Fragile Areas

### Workflow JSON Files Are Manually Maintained

- **Files:** All 8 workflow JSON files in `workflows/`
- **Why fragile:** These are n8n-exported JSON files that are edited only by exporting from the n8n UI. Any manual editing carries high risk of corrupting the JSON structure. Cross-referencing node IDs in the `connections` section is error-prone. The files contain n8n-specific GUIDs that must match between nodes and connections.
- **Safe modification:** Always edit workflows through the n8n UI and re-export. Never hand-edit the JSON unless you understand n8n's internal format completely.
- **Test coverage:** None — no tests validate workflow structure or node connections.

### Airtable Schema Dependencies

- **Files:** All workflows, `docs/AIRTABLE-SCHEMA.md`, `airtable/templates/*.csv`
- **Why fragile:** Every workflow implicitly depends on exact Airtable field names. If a user renames a field in Airtable (e.g., "Job Title" → "Role"), every expression referencing that name silently breaks. There is no schema validation layer.
- **Safe modification:** Never rename Airtable fields after starting to use the workflows. Add new fields instead.
- **Test coverage:** None — no tests verify that workflows can read/write expected Airtable fields.

### AI Response Parsing Is Brittle

- **Files:** `workflows/02-evaluator.json` (Parse AI Response node), `workflows/03-tailor.json` (Parse Tailored CV node)
- **Why fragile:** The code does JSON extraction by finding the first `{` and last `}` in the LLM response, with fallback chains for different response formats. This works for current models but will break if a model returns a different format (e.g., markdown code blocks, multiple JSON objects, streaming partial output). The `<thought>` tag stripping is also fragile — it assumes specific tag patterns.
- **Safe modification:** Test with any new AI model before switching. Add more robust JSON extraction (regex with balanced brace counting).
- **Test coverage:** None — no unit tests for AI response parsing logic.

### Python Sidecar Filename Handling

- **Files:** `scripts/cv_service.py` (lines 37-52)
- **Why fragile:** The `filename` parameter from the n8n request is used directly in a file path: `/tmp/{filename}.docx`. If the filename contains path separators or special characters, this can cause file write errors or overwrite existing files.
- **Safe modification:** Sanitize filenames to alphanumeric + underscore only.
- **Test coverage:** None — no tests for the CV renderer service.

### Pinned Dependencies Without Version Constraints

- **Files:** `scripts/requirements.txt`
- **Why fragile:** Dependencies are unpinned — `python-docx`, `flask`, `python-jobspy` with no version constraints. A breaking change in any of these packages will break the services on rebuild. The `python-jobspy` package in particular has had rapid iterations with API changes.
- **Safe modification:** Pin to known working versions: `python-docx==1.1.2`, `flask==3.1.0`, `python-jobspy==0.5.0` (verify current versions first).
- **Test coverage:** None — no build tests that validate the Docker images build and services start.

## Scaling Limits

### Airtable Free Tier Record Limit

- **Current capacity:** 1,000 records per base on Airtable free tier.
- **Limit:** At ~30 jobs/day (typical), the pipeline accumulates ~600 records/month (after initial data, ~20/day make it past filtering). With the Housekeeper archiving stale Low Fit jobs weekly, the 1,000 limit is manageable but tight. If a user has high scan volumes (100+ jobs/day), the limit is hit within weeks.
- **Scaling path:** Upgrade to Airtable Team ($20/user/month, 50,000 records). Or pay for Airtable credits. Or add a cron job to export and delete old records.

### JobSpy Rate Limiting / IP Bans

- **Current capacity:** No rate limiting implemented. The service sends requests as fast as `scrape_jobs()` returns.
- **Limit:** LinkedIn will rate-limit around page 10 (~250 results). Indeed may block after rapid successive queries. Excessive scraping can get the VPS IP banned.
- **Scaling path:** Add adaptive rate limiting with exponential backoff. Add a per-query delay configuration. Consider rotating proxies for high-volume use. Document the scraping limits clearly.

### Sequential Pipeline Wall-Clock Time

- **Current capacity:** The full pipeline (scanning all companies → evaluating → tailoring) takes approximately: 2-5 minutes for API scanners + 3-5 minutes for JobSpy batch + 30-60 seconds per evaluation (AI) + 30-60 seconds per tailoring (AI) + 5-15 seconds per CV render.
- **Limit:** With 50 new jobs and 5 High Fits, the complete pipeline takes ~45-60 minutes from first scan start to last CV generated.
- **Scaling path:** Parallelize the scanner workflows (they already run at staggered 5-minute offsets). Add webhook chaining to trigger downstream workflows immediately instead of on fixed schedules.

## Dependencies at Risk

### python-jobspy (Unpinned, Heavy External Dependency)

- **Risk:** The `python-jobspy` package scrapes LinkedIn, Indeed, and other job boards. These sites change their HTML structure frequently, causing scraping failures. The package has no SLA and is maintained by a single developer/group. Its heavy dependencies (Playwright for some features, Selenium fallback) add ~500MB to the Docker image.
- **Files:** `scripts/requirements.txt`, `scripts/Dockerfile.jobspy`, `scripts/jobspy_service.py`
- **Impact:** If the package breaks, the entire JobSpy scanner workflow is non-functional. LinkedIn/Indeed scraping stops until the package is updated or a workaround is found.
- **Migration plan:** No clear alternative. This is the only viable self-hosted job scraping library. Mitigation: pin the version after testing, and monitor the package's GitHub for breaking changes.

### n8n Workflow Engine Version

- **Risk:** The workflow JSON files were exported from a specific n8n version. Newer n8n versions may change the JSON schema, deprecate node types, or alter behavior of existing nodes (e.g., the Airtable node, OpenAI node). The `"typeVersion"` fields (2.1 for Airtable, 1.6 for OpenAI, 4.4 for HTTP Request) are tied to specific n8n releases.
- **Files:** All 8 workflow JSON files
- **Impact:** Importing workflows into a different n8n version may produce warnings, fail to import, or behave differently.
- **Migration plan:** Document the minimum n8n version required. Test workflows on new n8n versions before upgrading.

### Google AI Studio / OpenAI API Changes

- **Risk:** JobSignal relies on OpenAI-compatible API endpoints. Google AI Studio's OpenAI compatibility layer, OpenRouter's routing, and local LM Studio/Ollama servers all implement slightly different subsets of the OpenAI API. A change in any provider's API could break all three AI workflows.
- **Files:** `workflows/02-evaluator.json`, `workflows/03-tailor.json`, `docs/AI-PROVIDERS.md`
- **Impact:** All AI scoring, interview prep, and CV tailoring stops until the model configuration is updated.
- **Migration plan:** The architecture already supports provider switching by changing a single credential. Add test workflows that validate AI response format periodically.

## Missing Critical Features

### No Automated Testing

- **Problem:** The repository has zero tests — no unit tests, no integration tests, no end-to-end tests. There is no CI/CD pipeline. The only validation is manual workflow execution in n8n.
- **Blocks:** Safe refactoring. Any change to a Code node, Python service, or workflow structure must be manually verified across all 8 workflows. There is no regression detection.
- **Impact:** High. This is the single biggest quality gap.

### No Linting or Code Formatting

- **Problem:** No ESLint, Prettier, Black, Ruff, or any code quality tool configured. The embedded JavaScript in n8n Code nodes is not checked. The Python services have no linter.
- **Files:** The entire repository — no `.eslintrc`, `.prettierrc`, `pyproject.toml`, or `ruff.toml` found.
- **Impact:** Inconsistent code style across Code nodes and Python files. No automated detection of syntax errors in embedded JavaScript.

### No Change Log or Versioning

- **Problem:** The repository has version tags (`v1.0`, `v2.0`) but no CHANGELOG.md or migration guide. There is no documented process for upgrading between versions.
- **Files:** Repository root — no CHANGELOG.md
- **Impact:** Users on an older version have no guidance on what changed or whether they need to reconfigure their Airtable schema.

### No Health Check or Monitoring

- **Problem:** The sidecar services (`cv_service.py`, `jobspy_service.py`) expose `/health` endpoints, but there is no monitoring, alerting, or automated restart on health check failure. Docker's `restart: always` is the only recovery mechanism.
- **Files:** `scripts/cv_service.py` (lines 25-29), `scripts/jobspy_service.py` (lines 143-147), `docker-compose.example.yml`
- **Impact:** If a sidecar enters a bad state but doesn't crash (e.g., memory leak, hung thread), the n8n workflows will get timeout errors with no automated recovery.

### No Backup or Export Mechanism

- **Problem:** There is no automated backup for Airtable data, n8n workflow configurations, or credential store. If the Airtable base is accidentally deleted or corrupted, all pipeline data is lost. If the n8n Docker volume is lost, workflow configurations must be re-imported from the repo.
- **Files:** N/A — no backup tooling exists
- **Impact:** Complete data loss scenario with no recovery path.

## Test Coverage Gaps

- **What's not tested:** Everything. The entire codebase has zero test files.
- **Files:** All source files — `scripts/*.py`, `workflows/*.json`, `scripts/render_cv.py` (361 lines of untested CV layout logic)
- **Risk:** The CV renderer (`render_cv.py`) has complex layout logic (section header detection, bullet parsing, job title detection, project header detection, skills categorization) that is entirely untested. A change to any parsed pattern can silently break CV output formatting.
- **Priority:** High

---

*Concerns audit: 2026-06-09*
