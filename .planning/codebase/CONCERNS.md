# Codebase Concerns

**Analysis Date:** 2026-06-05

## Tech Debt

**Airtable free-tier record cap (silent write failure):**
- Issue: Airtable free tier limits bases to 1,000 records. When the cap is hit, writes fail without surfacing a clear error in day-to-day use — the pipeline appears to run but new jobs stop landing in Pipeline.
- Files: `README.md` (Gotchas section), `docs/SETUP.md` (Step 1.1), `docs/COST-GUIDE.md`, `workflows/04-housekeeper.json` (weekly archive mitigates but does not eliminate risk)
- Impact: Missed job discoveries; stale pipeline; user may not notice for days
- Fix approach: Use a dedicated Airtable workspace; monitor record count; upgrade to Team tier at high volume; add explicit record-count check node before writes (roadmap Shadow Ledger would help audit)

**Workflow JSON ships with author's Airtable base/table IDs:**
- Issue: All 8 workflow exports embed the original developer's base ID (`appE808oZ5gTSQzUY`), table IDs, and credential references. Fresh imports point at the wrong base until manually reconfigured.
- Files: `workflows/01a-scanner-greenhouse.json`, `workflows/01b-scanner-ashby.json`, `workflows/01c-scanner-lever.json`, `workflows/01d-scanner-jobspy.json`, `workflows/02-evaluator.json`, `workflows/03-tailor.json`, `workflows/04-housekeeper.json`, `workflows/06-alerter.json`
- Impact: Silent misrouting to wrong base or credential errors on first run; common setup footgun
- Fix approach: Follow `docs/SETUP.md` Step 2.7 — re-point every Airtable node to your base/tables and credentials after import; consider shipping placeholder IDs or a setup checklist node

**JobSpy scanner ignores Profile Target Geography (hardcoded):**
- Issue: Workflow 1d uses hardcoded `userGeographies = ['Canada', 'Remote Global', 'Remote North America']` instead of reading Profile like scanners 1a/1b/1c. Explicit `TODO: Read from Profile.Target Geography in v1.1` in code.
- Files: `workflows/01d-scanner-jobspy.json` (Parse & Filter Jobs Code node)
- Impact: LinkedIn/Indeed results filtered for wrong regions; jobs outside hardcoded geos dropped or wrong jobs admitted
- Fix approach: Copy the dynamic geography pattern from `workflows/01a-scanner-greenhouse.json` Parse node (`$('Get Profile').first().json` + `Target Geography` field)

**SETUP.md template filenames don't match repo:**
- Issue: `docs/SETUP.md` references `profile-template.csv` and `tracked-companies-template.csv`, but actual files are `airtable/templates/Profile-Grid view.csv`, `Tracked Companies-Grid view.csv`, etc.
- Files: `docs/SETUP.md`, `airtable/templates/`
- Impact: New users fail at CSV import step
- Fix approach: Update SETUP.md filenames or add symlink/alias templates with documented names

**Duplicate Airtable schema documentation:**
- Issue: `airtable/AIRTABLE-SCHEMA.md` and `docs/AIRTABLE-SCHEMA.md` both exist — drift risk when one is updated and the other is not.
- Files: `airtable/AIRTABLE-SCHEMA.md`, `docs/AIRTABLE-SCHEMA.md`
- Impact: Field-type setup errors; inconsistent setup guidance
- Fix approach: Consolidate to single canonical path; link from the other

**Workflow 5 (Optimizer) not implemented:**
- Issue: README and workflow table reference closed-loop scoring analytics as v1.1; no `05-optimizer.json` exists.
- Files: `README.md` (Workflow Reference, Roadmap)
- Impact: No learning from interview outcomes; scoring weights stay static
- Fix approach: Deferred to roadmap; requires outcome data in Pipeline status fields

**Shadow Ledger audit trail not implemented:**
- Issue: Roadmap item for immutable JSONL audit log alongside Airtable writes — not present. Debugging relies on n8n execution logs and Airtable state only.
- Files: `README.md` (Roadmap)
- Impact: Hard to replay, audit, or prove what the system did on a given run
- Fix approach: Implement v1.1 Shadow Ledger per roadmap

**FNV-1a deduplication instead of crypto hash:**
- Issue: n8n Code nodes cannot use `require('crypto')`; JobSignal uses pure-JS FNV-1a for Job IDs (title + company + apply link). Collision probability is low but non-zero vs SHA-256.
- Files: `workflows/01a-scanner-greenhouse.json`, `workflows/01b-scanner-ashby.json`, `workflows/01c-scanner-lever.json`, `workflows/01d-scanner-jobspy.json`, `README.md`
- Impact: Rare duplicate or merged records if hash collides
- Fix approach: Acceptable tradeoff documented in README; external hash precompute in sidecar if stronger IDs needed

**Unpinned Python dependencies:**
- Issue: `scripts/requirements.txt` lists `python-docx`, `flask`, `python-jobspy` without version pins. Dockerfiles use `pip install` without lockfile.
- Files: `scripts/requirements.txt`, `scripts/Dockerfile.cv-renderer`, `scripts/Dockerfile.jobspy`
- Impact: Reproducible builds break when upstream packages change (especially `python-jobspy` tied to LinkedIn HTML)
- Fix approach: Pin versions in requirements.txt; regenerate Docker images on upgrade

**Monolithic n8n workflow JSON:**
- Issue: Core logic lives in large exported JSON with embedded JavaScript strings. `workflows/02-evaluator.json` (~1,375 lines) and `workflows/04-housekeeper.json` (~1,349 lines) are hard to diff, review, and unit-test.
- Files: `workflows/02-evaluator.json`, `workflows/04-housekeeper.json`, all `workflows/*.json`
- Impact: Regressions during edits; no IDE support for embedded Code node JS
- Fix approach: Extract shared JS to documented snippets; test Parse nodes in isolation; consider n8n sub-workflows for Evaluator loops

## Known Bugs

**JobSpy geography mismatch (confirmed TODO):**
- Symptoms: Profile Target Geography changes have no effect on LinkedIn/Indeed pipeline; only Canada/Remote Global/Remote North America used
- Files: `workflows/01d-scanner-jobspy.json`
- Trigger: Any user whose Profile geography differs from hardcoded list
- Workaround: Edit the Code node `userGeographies` array manually, or align Profile to hardcoded values

**n8n parallel fan-out into single Code node:**
- Symptoms: "node hasn't been executed" errors when multiple Airtable branches feed one Code node
- Files: `workflows/04-housekeeper.json` (sequential query pattern enforced), `README.md` (Gotchas)
- Trigger: Refactoring Housekeeper or other workflows to parallel Airtable reads
- Workaround: Chain Airtable queries sequentially, not in parallel

## Security Considerations

**Unauthenticated Python sidecars on 0.0.0.0:**
- Risk: `cv_service.py` and `jobspy_service.py` bind `0.0.0.0` with no API key or auth. Any host/network access to ports 3456/3457 can render CVs (PII in markdown) or trigger JobSpy scrapes.
- Files: `scripts/cv_service.py`, `scripts/jobspy_service.py`, `docker-compose.example.yml` (sidecars use `expose` only — mitigated inside Docker network; risk rises if ports are published)
- Current mitigation: Docker Compose exposes sidecars to internal network only; n8n calls via service name
- Recommendations: Add shared-secret header check; bind to Docker internal network only; never publish 3456/3457 to host without auth

**n8n admin UI exposed on port 5678:**
- Risk: `docker-compose.example.yml` publishes `5678:5678` for n8n. Without `N8N_BASIC_AUTH_*` and HTTPS, instance is vulnerable to takeover (workflows contain Airtable PAT via credentials, AI keys).
- Files: `docker-compose.example.yml`, `docs/SETUP.md`
- Current mitigation: Docs recommend basic auth + Caddy HTTPS; not enforced in example compose
- Recommendations: Require basic auth in example; document firewall rules; use Caddy-only exposure

**PII concentration in Airtable and email:**
- Risk: Profile table stores full CV markdown, skills, email; Pipeline stores job details; High Fit alerts and digests email job + candidate context.
- Files: `airtable/AIRTABLE-SCHEMA.md`, `workflows/02-evaluator.json`, `workflows/06-alerter.json`, `workflows/03-tailor.json`
- Current mitigation: User-controlled Airtable access; Resend/Gmail transport
- Recommendations: Dedicated Airtable base/workspace; minimal PAT scopes; encrypt sensitive fields if Airtable tier supports; redact in logs

**JobSpy error responses leak stack traces:**
- Risk: `jobspy_service.py` returns full Python `traceback` in JSON 500 responses to callers.
- Files: `scripts/jobspy_service.py` (`/scan`, `/batch` error handlers)
- Current mitigation: Sidecar internal-only in default deploy
- Recommendations: Log tracebacks server-side only; return generic error to n8n

**LinkedIn/Indeed scraping legal and account risk:**
- Risk: JobSpy scrapes LinkedIn public HTML — violates LinkedIn ToS; IP/account flagging possible; scraper breaks when HTML changes.
- Files: `scripts/jobspy_service.py`, `workflows/01d-scanner-jobspy.json`, `README.md` (Honest Limitations)
- Current mitigation: Self-hosted optional; API scanners (1a/1b/1c) as primary sources
- Recommendations: Treat JobSpy as best-effort supplement; monitor JobSpy upstream; prefer ATS APIs

## Performance Bottlenecks

**Sequential AI evaluation with rate limits:**
- Problem: Evaluator scores jobs one-by-one with wait nodes; Google AI Studio free tier: 15 RPM, 1,500 RPD. Large batches (50+ new jobs) hit limits and defer to next run.
- Files: `workflows/02-evaluator.json`, `docs/AI-PROVIDERS.md`
- Cause: Provider rate limits + intentional throttling
- Improvement path: Batch smaller daily scans; upgrade to GPT-5 mini; increase wait intervals only as last resort

**1GB VPS OOM with both sidecars:**
- Problem: Running `cv-renderer` and `jobspy-scanner` simultaneously on 1GB RAM causes OOM kills.
- Files: `docker-compose.example.yml`, `README.md`, `docs/SETUP.md`
- Cause: Memory footprint of n8n + Postgres + Caddy + two Python services
- Improvement path: Use 2GB+ droplet; run one sidecar at a time on 1GB

**Airtable API pagination on large Pipeline:**
- Problem: Scanners fetch all existing Job IDs for deduplication each run. Pipeline growth increases Airtable read volume and n8n execution time.
- Files: `workflows/01a-scanner-greenhouse.json`, `workflows/01b-scanner-ashby.json`, `workflows/01c-scanner-lever.json`, `workflows/01d-scanner-jobspy.json`
- Cause: Full-table Job ID scan per run
- Improvement path: Archive aggressively via Housekeeper; Airtable views filtered to active jobs; external dedup store (Shadow Ledger)

## Fragile Areas

**AI response parsing (JSON and CV content):**
- Files: `workflows/02-evaluator.json` (Parse AI Response, Parse Interview Prep), `workflows/03-tailor.json` (Parse Tailored CV)
- Why fragile: Open-source models wrap output in `<thought>` tags, markdown fences, or preamble; n8n "Output Content as JSON" unreliable for Gemma 4
- Safe modification: Preserve strip logic (`indexOf('{')`, `</thought>` removal); test with target model before changing prompts
- Test coverage: None automated

**Greenhouse company slug discovery:**
- Files: `companies-default.csv`, `docs/CUSTOMIZATION.md`, `README.md`
- Why fragile: ~40–60% of manual slug guesses fail; many companies migrated to Ashby
- Safe modification: Always `curl` verify endpoint before adding to Tracked Companies; empty `jobs` array means valid endpoint
- Test coverage: CSV is manually curated; no CI validation of endpoints

**Scanner HTTP nodes with continueOnFail:**
- Files: `workflows/01a-scanner-greenhouse.json`, `workflows/01d-scanner-jobspy.json` (HTTP/sidecar nodes use `continueOnFail: true`)
- Why fragile: Per-company API failures silently skipped; user may think company has no openings vs broken endpoint
- Safe modification: Monitor n8n execution logs; spot-check Tracked Companies with zero recent Pipeline entries
- Test coverage: None

**Housekeeper workflow complexity:**
- Files: `workflows/04-housekeeper.json` (~1,349 lines)
- Why fragile: Multiple sequential Airtable queries, batch updates, summary email; sensitive to n8n execution order constraints
- Safe modification: Run manually before activating; change one query path at a time
- Test coverage: None

## Scaling Limits

**Airtable free tier (1,000 records/base):**
- Current capacity: ~30 filtered jobs/day → ~600 records/month before archive pressure
- Limit: Silent write failure at 1,000
- Scaling path: Weekly Housekeeper archives; Team plan ($20/user, 50k records); NocoDB migration (roadmap)

**Scanner safety brake (100 net-new jobs/run):**
- Current capacity: Hard error if deduplicated new jobs exceed 100 per scanner run
- Limit: Workflow throws and aborts run — intentional guard against misconfigured keywords
- Scaling path: Tighten Title Keywords; increase cap in Code node intentionally if volume is expected

**JobSpy batch limits:**
- Current capacity: Max 10 queries/batch, 100 results/query (`scripts/jobspy_service.py`)
- Limit: Large Search Queries tables need multiple runs or batch splitting
- Scaling path: Add queries across days; raise caps with RAM/network awareness

**Single-user Profile model:**
- Current capacity: One Profile row drives all AI prompts
- Limit: Not suitable for teams, agencies, or multi-seeker households
- Scaling path: Not in scope; separate Airtable bases per user

## Dependencies at Risk

**python-jobspy:**
- Risk: Tied to LinkedIn/Indeed HTML structure; breaks industry-wide when sites change
- Impact: Workflow 1d returns empty or errors; LinkedIn/Indeed discovery stops
- Migration plan: Rely on Greenhouse/Ashby/Lever scanners; watch JobSpy releases; pin and test before upgrading

**Google AI Studio / Gemma 4 free tier:**
- Risk: Rate limits (15 RPM, 1,500 RPD as of docs) and model ID changes (`gemma-4-26b-a4b-it`)
- Impact: Deferred evaluations; parse failures if model behavior shifts
- Migration plan: OpenAI GPT-5 mini (~$3–5/month); document limits in `docs/AI-PROVIDERS.md`

**n8n platform:**
- Risk: Workflow JSON format and Code node sandbox rules (`crypto` blocked) are platform constraints
- Impact: Cannot use standard Node crypto; upgrades may change node behavior
- Migration plan: Stay on documented n8n patterns; test imports after n8n version bumps

**Airtable API:**
- Risk: Vendor lock-in; PAT rotation; field type strictness (multi-select rejects unknown values)
- Impact: Writes fail on type mismatch; all state in one vendor
- Migration plan: Long text for AI-generated lists (already done for skills); NocoDB backend on roadmap

## Missing Critical Features

**Closed-loop scoring (Workflow 5 Optimizer):**
- Problem: No feedback from interview outcomes into scoring weights
- Blocks: Improving match quality over time without manual prompt edits

**Minimum salary filter:**
- Problem: Jobs below salary floor still consume AI evaluation credits
- Blocks: Cost-efficient filtering before Evaluator runs (roadmap item)

**n8n Cloud full feature parity:**
- Problem: Cloud deployment cannot run JobSpy or DOCX cv-renderer sidecars
- Blocks: LinkedIn/Indeed scanning and tailored DOCX CVs on Cloud-only setups (`docs/COST-GUIDE.md`, `README.md`)

## Test Coverage Gaps

**No automated test suite:**
- What's not tested: Any workflow behavior, Python sidecars, markdown→DOCX rendering, FNV-1a dedup, geography filters, AI parse nodes
- Files: Entire repo — no `*.test.*`, `*.spec.*`, `pytest`, or CI workflow beyond `.github/ISSUE_TEMPLATE/bug_report.md`
- Risk: Regressions in JSON exports undetected until manual n8n execution
- Priority: High

**Python sidecars (cv_service, jobspy_service, render_cv):**
- What's not tested: `/health`, `/render`, `/scan`, `/batch` endpoints; markdown parsing edge cases; error paths
- Files: `scripts/cv_service.py`, `scripts/jobspy_service.py`, `scripts/render_cv.py`
- Risk: DOCX corruption or scrape failures in production
- Priority: Medium

**Company API endpoint registry:**
- What's not tested: 139 entries in `companies-default.csv` — no automated curl/health check in CI
- Files: `companies-default.csv`
- Risk: Stale or broken endpoints ship; scanners skip companies silently (`continueOnFail`)
- Priority: Medium

**AI provider compatibility matrix:**
- What's not tested: Documented providers (Gemma 4, GPT-5 mini, LM Studio, Ollama, OpenRouter) against all three AI workflows
- Files: `docs/AI-PROVIDERS.md`, `workflows/02-evaluator.json`, `workflows/03-tailor.json`
- Risk: User switches provider and hits parse/scoring failures
- Priority: Medium

**Email notification paths:**
- What's not tested: Resend, Gmail SMTP, Discord webhook configurations
- Files: `workflows/02-evaluator.json`, `workflows/06-alerter.json`, `docs/NOTIFICATION-SETUP.md`
- Risk: Alerts fail silently (`continueOnFail` / graceful degradation design) — user misses High Fit jobs
- Priority: High for onboarding; Medium ongoing

---

*Concerns audit: 2026-06-05*
