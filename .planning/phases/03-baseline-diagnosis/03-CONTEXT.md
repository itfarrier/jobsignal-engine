# Phase 3: Baseline Diagnosis - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Diagnose current 01e hh.ru RSS scanner vacancy volume by running it with execution logging. Measure feeds generated, items per feed, items after geography filter, items after dedup, and net-new Pipeline records per run. Zero code changes to existing workflow JSON files — measurement is external to 01e.

</domain>

<decisions>
## Implementation Decisions

### Metric Capture Method
- **D-01:** Extract structured metrics via n8n REST API, not manually from the UI or via external scripts. n8n execution history tracks per-node items in/out — the measurement workflow will query this via API.
- **D-02:** Implement as a **separate n8n workflow** (new `.json` file in `workflows/`) that reads 01e execution data via the n8n API. This avoids modifying 01e and keeps measurement decoupled.

### Trigger Strategy
- **D-03:** The measurement workflow runs **automatically after 01e completes**, on both success and error outcomes. Use n8n's built-in **Workflow Trigger** node (execution event listener) — no modification to 01e, no polling, no schedule hack.
- D-03 captures the full item count + error state per run without manual intervention.

### Data Points Captured
- **D-04:** Per-node item counts — feeds generated (from Build Feed List), raw RSS items per feed, items after geography filter, items after dedup (within run), net-new after Pipeline dedup, Pipeline records created.
- **D-05:** Error details — 429/403 response codes from vacancy fetches, safety brake triggers, any node-level errors or timeouts.

### Baseline Data Format
- **D-06:** Store baseline metrics as **records in a new Airtable table** ("Baseline Metrics") rather than JSON files or markdown reports. Ties into the existing Airtable data layer and is queryable by Phase 5.
- **D-07:** Record a **full Profile snapshot** alongside each run's metrics — Target Roles, Core Skills, Target Geography, Seniority Level, Location Preference — so Phase 5 knows what feed configuration produced the baseline.

### Run Protocol
- **D-08:** Two runs **back-to-back** (same day, minutes apart). If both runs produce similar metrics, the baseline is stable. If they differ significantly, the variance itself is informative.
- **D-09:** If a run produces **zero results or errors**, **debug first** before proceeding. Do not record a broken baseline.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Phase Scope
- `.planning/REQUIREMENTS.md` — HH-12 (Baseline Diagnosis requirement)
- `.planning/ROADMAP.md` — Phase 3 goal, success criteria, phase boundary

### Subject of Measurement
- `workflows/01e-scanner-hhru.json` — The 01e scanner workflow being measured. Understanding its node structure is essential for building the measurement workflow.

### Airtable Schema
- `airtable/AIRTABLE-SCHEMA.md` — Existing table schemas; relevant for designing the new Baseline Metrics table.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **n8n execution history** — Built-in per-node items in/out counts available via n8n REST API (no custom instrumentation needed).
- **01e Build Feed List** — Already logs debug via `console.log` for area ID resolution.
- **Scanner patterns** — Existing 01e flow (Get Profile → Build Feed List → Loop Over Feeds → RSS Read → Parse & Filter → Aggregate → Dedup → Pipeline Write) is well-understood and documented in the Sticky Note node.

### Established Patterns
- **Workflow-as-JSON** — All n8n workflows are `.json` files in `workflows/`. The measurement workflow follows the same pattern.
- **AlwaysOutputData** — Many 01e nodes use `alwaysOutputData: true` and `continueOnFail: true`, meaning execution data is available even for empty/error results.
- **Airtable as source of truth** — All operational data lives in Airtable tables, making a new Baseline Metrics table the natural fit.

### Integration Points
- **n8n REST API** — `/rest/executions/{id}` endpoint provides per-node execution data. The measurement workflow calls this via HTTP Request node.
- **Workflow Trigger node** — n8n's built-in trigger type that listens for workflow execution events (started, succeeded, errored).

</code_context>

<specifics>
## Specific Ideas

- User confirmed understanding: RSS items = individual job vacancies from hh.ru feeds
- User understands baseline concept as "before measurement" for Phase 5 comparison
- No specific UX/styling preferences — measurement workflow is backend-only
- User wants zero-touch operation: measurement workflow runs and records automatically

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 3-Baseline-Diagnosis*
*Context gathered: 2026-06-07*
