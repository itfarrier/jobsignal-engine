# Phase 3: Baseline Diagnosis - Research

**Researched:** 2026-06-07
**Domain:** n8n workflow orchestration, execution metrics collection, Airtable data recording
**Confidence:** MEDIUM

## Summary

Phase 3 builds a measurement workflow that automatically captures baseline vacancy volume metrics from the existing 01e hh.ru RSS scanner. The measurement workflow triggers after 01e completes (via schedule + error trigger), queries the n8n API for execution data (`includeData=true`), extracts per-node item counts from `data.runData`, and writes results to a new Airtable "Baseline Metrics" table alongside a Profile snapshot.

**Primary recommendation:** Build `workflows/03-baseline-diagnosis.json` — a measurement workflow using Schedule Trigger at 8:25 AM (5 min after 01e's 8:20) for success captures + Error Trigger for error captures. Use the n8n node's "Get Many Executions" operation with `Include Execution Details` to fetch 01e's execution data, then a Code node to parse `runData` for per-node item counts. Write results to a new Airtable "Baseline Metrics" table.

**Critical finding — D-03 trigger approach needs adjustment:** The n8n Workflow Trigger node [VERIFIED: Context7 /n8n-io/n8n-docs] only supports "Active Workflow Updated" and "Workflow Activated" events — NOT "workflow execution completed" as D-03 assumes. The recommended Schedule Trigger at 8:25 satisfies the same "automatic, no modification to 01e" constraint with a simpler, well-tested mechanism. Error Trigger for failures is also natively supported.

**No packages to install** — all work is within n8n (workflow JSON file). No npm/pip dependencies.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Trigger measurement run | n8n (backend) | — | Schedule Trigger at 8:25 + Error Trigger for failures. No human or client involvement. |
| Fetch 01e execution data | n8n (backend) | — | n8n node "Get Many Executions" calls n8n's internal REST API to retrieve execution results with per-node item data. |
| Parse runData for metrics | n8n Code node (backend) | — | JavaScript Code node reads `$json.data.runData` map, counts items per node (feeds, RSS items, geography filter, dedup, Pipeline). |
| Record metrics to Airtable | n8n Airtable node (backend) | — | Standard create operation on new "Baseline Metrics" table, same Airtable PAT credential as existing workflows. |
| Capture Profile snapshot | n8n Airtable node (backend) | — | Read Profile row via Airtable Search node (same as 01e's "Get Profile" node), serialize to JSON for snapshot field. |
| Detect error details | n8n Error Trigger (backend) | — | Error Trigger node catches 01e failures; execution ID from error payload used to fetch full runData for error diagnostics. |

All capabilities reside in the backend/orchestration tier. No browser, client, or frontend involvement — this is a pure measurement/logging workflow.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| n8n (self-hosted or Cloud) | Current instance | Workflow automation platform | Existing platform. All workflows are n8n JSON. |
| n8n Schedule Trigger node | n8n built-in | Trigger measurement at 8:25 AM daily | Well-tested existing pattern (used by 01a–01d, 02, 03, 04, 06). |
| n8n Error Trigger node | n8n built-in | Catch 01e execution failures | Native n8n node, documented pattern. Receives execution ID + error message. |
| n8n node (n8n-nodes-base.n8n) | n8n built-in | Query executions of 01e | Native n8n node, "Get Many" + "Get One" operations, filters by workflow/status, `Include Execution Details` option returns full runData. |
| n8n Code node | n8n built-in | Parse execution runData for item counts | Standard processing node in all existing workflows. Inline JS runs in n8n sandbox. |
| n8n Airtable node | n8n built-in | Write metrics to Baseline Metrics table | Standard persistence mechanism across all existing workflows. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| n8n HTTP Request node | n8n built-in | Fallback if n8n node doesn't return expected data | Only if n8n node's "Include Execution Details" doesn't surface the full runData depth needed. Raw API call with `X-N8N-API-KEY` header. |
| n8n Set node (Edit Fields) | n8n built-in | Assemble final metric payload before Airtable write | If aggregation logic is simpler in UI than in Code node. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| n8n node (n8n-nodes-base.n8n) | Raw HTTP Request to `/rest/executions` | n8n node is simpler (native auth, built-in filter UI). HTTP Request requires manual credential config and query string construction. Use raw HTTP only if n8n node omits needed data. |
| Schedule Trigger at 8:25 | Workflow Trigger (as D-03 assumed) | Workflow Trigger node doesn't support execution-completed events. Schedule is proven pattern. |
| Error Trigger | Polling for error status | Error Trigger is instant, native, and provides execution ID directly. Polling would add complexity. |
| Airtable "Baseline Metrics" table | JSON file export | Airtable is queryable by Phase 5, consistent with existing data layer, and supports structured field types. |

### Installation
No new packages to install. All work is creating a new n8n workflow JSON file.

## Package Legitimacy Audit

> This phase creates an n8n workflow JSON file only — no external packages are installed. The phase uses only n8n built-in nodes (Schedule Trigger, Error Trigger, n8n node, Code node, Airtable node). No npm/PyPI packages required.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    n8n Instance (self-hosted or Cloud)            │
│                                                                   │
│  ┌─────────────────────┐       ┌──────────────────────────────┐  │
│  │  01e Scanner         │       │  03 Baseline Diagnosis      │  │
│  │  (hh.ru RSS)         │       │  (measurement workflow)     │  │
│  │  Schedule: 8:20 AM   │       │                              │  │
│  │                      │       │  ┌────────────────────────┐  │  │
│  │  [Build Feed List]──►│       │  │ Schedule Trigger 8:25  │  │  │
│  │  [Loop Over Feeds]   │       │  └───────────┬────────────┘  │  │
│  │  [RSS Feed Read]     │       │              │               │  │
│  │  [Parse & Filter]    │       │  ┌───────────▼────────────┐  │  │
│  │  [Aggregate]────►    │       │  │ n8n node: Get Many     │  │  │
│  │  [Dedup vs Pipeline] │       │  │ Executions (01e,       │  │  │
│  │  [Create Pipeline]   │       │  │ success, limit=1,      │  │  │
│  └─────────────────────┘       │  │ includeDetails=true)   │  │  │
│                                │  └───────────┬────────────┘  │  │
│  ┌─────────────────────┐       │              │               │  │
│  │ Error Trigger       │       │  ┌───────────▼────────────┐  │  │
│  │ (links to 03)       │───────►  │ Code node: Parse       │  │  │
│  └─────────────────────┘       │  │ runData for item       │  │  │
│                                │  │ counts per stage       │  │  │
│                                │  └───────────┬────────────┘  │  │
│                                │              │               │  │
│                                │  ┌───────────▼────────────┐  │  │
│                                │  │ Get Profile (Airtable  │  │  │
│                                │  │ search, for snapshot)  │  │  │
│                                │  └───────────┬────────────┘  │  │
│                                │              │               │  │
│                                │  ┌───────────▼────────────┐  │  │
│                                │  │ Create Baseline        │  │  │
│                                │  │ Metrics record         │  │  │
│                                │  │ (Airtable node)        │  │  │
│                                │  └────────────────────────┘  │  │
│  ┌─────────────────────┐       └──────────────────────────────┘  │
│  │ Airtable            │                                          │
│  │  ├ Profile          │◄─────── Airtable PAT (read)              │
│  │  ├ Pipeline         │◄─────── 01e writes here                  │
│  │  └ Baseline Metrics │◄─────── 03 writes here                   │
│  └─────────────────────┘                                          │
└─────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
workflows/
├── 01e-scanner-hhru.json          # Existing — NOT modified
└── 03-baseline-diagnosis.json     # NEW — measurement workflow

airtable/
├── AIRTABLE-SCHEMA.md             # Update with Baseline Metrics table schema
└── templates/
    └── Baseline Metrics-Grid view.csv  # NEW — importable CSV for the new table

.planning/
└── phases/
    └── 03-baseline-diagnosis/
        ├── 03-CONTEXT.md          # User decisions
        ├── 03-RESEARCH.md         # This file
        └── 03-PLAN.md             # To be created by planner
```

**No changes to existing files.** Only additions to `workflows/` and `airtable/`.

### Pattern 1: Measurement Workflow Flow
**What:** A dedicated n8n workflow that measures another workflow's execution by querying the n8n API for runData.
**When to use:** Any scenario requiring external measurement of n8n workflow execution without modifying the target workflow.

**Node sequence:**
```
1. Schedule Trigger (8:25 AM, daily) ───┐
                                         ├──→ 3. If (has execution?) → Yes → 4. Code → 5. Airtable
2. Error Trigger (linked to 01e) ───────┘                                              ↑
                                                                                6. Get Profile
```

**Step 3 (Code node — determine execution ID):**
```
Node name: "Get Latest or Error Execution"
Purpose: Determine which execution to measure.
- On Schedule path: finds latest 01e execution from input
- On Error path: execution ID from error payload
```

### Pattern 2: Parsing runData for Item Counts
**What:** Read n8n execution `data.runData` map to extract per-node item counts.
**Source:** [CITED: n8n docs — OpenAPI spec shows `data.additionalProperties: true` for execution response]

The `runData` object maps node names → arrays of execution results. Key nodes to measure in 01e:
- `Build Feed List` — output item count = feeds generated
- `RSS Feed Read` — output array length aggregated across all feed loop iterations = total raw RSS items
- `Parse & Filter Jobs` — output item count after geography + keyword filter
- `Aggregate All Jobs` — output item count after within-run dedup
- `Deduplicate vs Pipeline` — output item count = net-new Pipeline records (or `_empty` sentinel)
- `Create Pipeline Records` — created records count

**Key challenge:** Nodes inside loops (`RSS Feed Read`, `Parse & Filter Jobs`) produce multiple execution entries in runData (one per loop iteration). These must be summed, not just counted.

**Example parsing logic (pseudocode):**
```javascript
const runData = executionJson.data.runData;

// Feeds generated: output count of Build Feed List node
const buildFeedOutput = runData['Build Feed List']?.[0]?.output?.[0]?.length || 0;

// Total RSS items: sum all loop iterations of RSS Feed Read
const rssFeedOutputs = runData['RSS Feed Read'] || [];
const totalRssItems = rssFeedOutputs.reduce((sum, iter) => {
  return sum + (iter.output?.[0]?.length || 0);
}, 0);

// After geography filter: sum all loop iterations of Parse & Filter Jobs
const parseOutputs = runData['Parse & Filter Jobs'] || [];
const afterGeoFilter = parseOutputs.reduce((sum, iter) => {
  return sum + (iter.output?.[0]?.length || 0);
}, 0);

// After dedup: Aggregate All Jobs output count
const aggregated = runData['Aggregate All Jobs']?.[0]?.output?.[0]?.length || 0;

// Net-new: Deduplicate vs Pipeline output count
const dedupOutput = runData['Deduplicate vs Pipeline']?.[0]?.output?.[0] || [];
const netNew = dedupOutput.filter(item => !item.json._empty).length;

// Pipeline records created
const pipelineCreate = runData['Create Pipeline Records']?.[0]?.output?.[0]?.length || 0;
```

### Anti-Patterns to Avoid
- **Assuming single execution entry for looped nodes:** `runData['RSS Feed Read']` has one entry per loop iteration, not one total. Sum, don't count.
- **Counting `_empty` sentinel items as valid jobs:** Empty batch markers (`_empty: true`) are not real jobs. Filter them out in counts.
- **Parallel Airtable queries feeding one Code node:** Follow the sequential chaining pattern — Get Profile then Code then Airtable create, not parallel.
- **Assuming execution ID from Error Trigger is same path:** Error Trigger provides `execution.id` already. Schedule path needs to find latest execution via API query.
- **Not respecting `data.resultData.runData` path vs `data.runData`:** The exact JSON path in execution data may differ between n8n versions. Verify by examining actual API response structure.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Query n8n executions | Manual HTTP to `/rest/executions` | n8n node "Get Many Executions" | Built-in auth, workflow picker, status filter, `Include Execution Details` option. Simplifies JSON response parsing. |
| Parse HTML entities | Manual character replace | Already handled in 01e's `stripHtml` | Not needed for Phase 3 — measurement workflow only reads execution data, not job content. |
| FNV-1a hashing | Reimplement hash | Already in 01e's `Parse & Filter Jobs` | Not needed — measurement reads counts from runData, doesn't re-hash. |
| Airtable authentication | Build Airtable API calls | n8n Airtable node with existing PAT credential | Reuse the same `airtableTokenApi` credential from all existing workflows. |

**Key insight:** The measurement workflow is a data pipeline, not a computation — it reads structured execution data, counts items, and writes to Airtable. All necessary capabilities exist as n8n built-in nodes.

## Common Pitfalls

### Pitfall 1: Workflow Trigger Node Doesn't Support Execution Events
**What goes wrong:** The workflow will fail to trigger automatically after 01e completes if using the Workflow Trigger node.
**Why it happens:** D-03 assumed the Workflow Trigger node supports "execution completed" events. Context7 documentation [VERIFIED: /n8n-io/n8n-docs] shows it only supports "Active Workflow Updated" and "Workflow Activated" events.
**How to avoid:** Use Schedule Trigger (8:25 AM, 5 min after 01e's 8:20) + Error Trigger (for failures). This satisfies D-03's intent without relying on a non-existent feature.
**Warning signs:** Measurement workflow never triggers; Workflow Trigger node shows no execution data.

### Pitfall 2: runData Structure Differs Between n8n Versions
**What goes wrong:** The JSON path to per-node item counts differs between n8n versions (Cloud vs self-hosted, v1.x vs v2.x).
**Why it happens:** The `data.runData` internal structure is not a stable public API — n8n may add/restructure fields.
**How to avoid:** Before building the parsing Code node, manually run 01e, then use n8n API or UI to inspect the actual execution data JSON structure. Build the Code node to match observed structure. Add defensive checks (`?.`) for all accessors.
**Warning signs:** Parsing returns zeroes; console.log shows unexpected data shapes.

### Pitfall 3: Loop Node Multiple Execution Entries
**What goes wrong:** Counting `runData['RSS Feed Read'].length` instead of summing all iteration outputs yields a count of feeds processed, not total RSS items.
**Why it happens:** Nodes inside `SplitInBatches` loops produce one runData entry per iteration, each with its own output array.
**How to avoid:** Sum `output[0].length` across ALL entries, not just the first.
**Warning signs:** "Items per feed" counts match the number of feeds, not actual job counts.

### Pitfall 4: Error Trigger Requires Manual Linking in n8n UI
**What goes wrong:** The Error Trigger node won't receive 01e's errors unless 01e is configured to use the measurement workflow as its error workflow.
**Why it happens:** Error Trigger is linked to a specific workflow via n8n UI (workflow settings → "Error Workflow" dropdown). This is NOT configured in the JSON file.
**How to avoid:** Document this manual setup step clearly in SETUP.md. The user must set 01e's "Error Workflow" setting to the measurement workflow after importing both.
**Warning signs:** Error Trigger branch never fires even when 01e errors.

### Pitfall 5: Schedule Timing Collision with Long-Running 01e
**What goes wrong:** Schedule at 8:25 fires while 01e (started at 8:20) is still running if it takes >5 minutes.
**Why it happens:** 01e execution time varies with feed count and vacancy fetch delays. If 01e runs long, the measurement workflow queries an incomplete execution.
**How to avoid:** Set schedule to 8:30 or 8:35 for safety buffer. Or add a retry loop in the Code node — if no completed execution found, wait 60s and re-query.
**Warning signs:** Execution found but status is "running" instead of "success"; metrics show partial data.

### Pitfall 6: Error Trigger Doesn't Always Have Full runData
**What goes wrong:** Error Trigger provides minimal data (execution ID, error message, last executed node) but NOT full runData.
**Why it happens:** Error Trigger [VERIFIED: /n8n-io/n8n-docs] sends `execution.id`, `execution.error`, `execution.lastNodeExecuted` — not the full node-by-node item data.
**How to avoid:** After receiving the error execution ID from the Error Trigger, make a SECOND API call using the n8n node to fetch the full execution data with `includeData=true`. The error workflow flow is: Error Trigger → n8n node (Get One Execution by ID, includeDetails=true) → Code node.
**Warning signs:** Error branch has limited data and can't calculate per-node metrics.

## Code Examples

### Code Node: Parse runData for Baseline Metrics
```javascript
// Source: n8n execution data structure from Context7 /n8n-io/n8n-docs OpenAPI spec
// This Code node receives the output of the n8n "Get Many Executions" node

const executionData = $input.first().json;

// The n8n node returns a results array; take the latest execution
const latestExecution = executionData.results?.[0] || executionData.data?.[0] || executionData;
const runData = latestExecution.data?.runData || {};

// Helper: count total items across all loop iterations for a node
function sumNodeOutputs(nodeName) {
  const entries = runData[nodeName] || [];
  return entries.reduce((total, iter) => {
    // iter.output is an array of output connections (main[0], main[1], etc.)
    // main[0] is the primary output
    const items = iter.output?.[0] || [];
    // Filter out _empty sentinels
    const realItems = items.filter(i => !i.json?._empty);
    return total + realItems.length;
  }, 0);
}

// Helper: count total items including _empty sentinels
function sumAllOutputs(nodeName) {
  const entries = runData[nodeName] || [];
  return entries.reduce((total, iter) => {
    const items = iter.output?.[0] || [];
    return total + items.length;
  }, 0);
}

// Extract metrics
const feedsGenerated = runData['Build Feed List']?.[0]?.output?.[0]?.length || 0;
const totalRssItems = sumAllOutputs('RSS Feed Read');
const afterGeoFilter = sumAllOutputs('Parse & Filter Jobs');
const afterDedup = runData['Aggregate All Jobs']?.[0]?.output?.[0]?.length || 0;

// Net-new from Deduplicate vs Pipeline (filter out _empty)
const dedupOutput = runData['Deduplicate vs Pipeline']?.[0]?.output?.[0] || [];
const netNew = dedupOutput.filter(i => !i.json?._empty).length;

// Pipeline records actually created
const pipelineCreated = runData['Create Pipeline Records']?.[0]?.output?.[0]?.length || 0;

// Error information
const errorInfo = latestExecution.data?.resultData?.error || latestExecution.error || null;
const executionStatus = latestExecution.status || 'unknown';

// Per-feed breakdown (from RSS Feed Read loop iterations)
const perFeedItems = (runData['RSS Feed Read'] || []).map((iter, idx) => ({
  feedIndex: idx,
  items: (iter.output?.[0] || []).filter(i => !i.json?._empty).length,
  total: (iter.output?.[0] || []).length
}));

// Items after geo filter per feed
const perFeedAfterGeo = (runData['Parse & Filter Jobs'] || []).map((iter, idx) => ({
  feedIndex: idx,
  items: (iter.output?.[0] || []).filter(i => !i.json?._empty).length
}));

return [{
  json: {
    executionId: latestExecution.id,
    executionStatus,
    startedAt: latestExecution.startedAt,
    stoppedAt: latestExecution.stoppedAt,
    feedsGenerated,
    totalRssItems,
    perFeedItemsJson: JSON.stringify(perFeedItems),
    afterGeoFilter,
    perFeedAfterGeoJson: JSON.stringify(perFeedAfterGeo),
    afterDedup,
    netNewPipelineRecords: netNew,
    pipelineRecordsCreated: pipelineCreated,
    errorDetails: errorInfo ? JSON.stringify({
      message: errorInfo.message,
      lastNodeExecuted: latestExecution.lastNodeExecuted,
      stack: errorInfo.stack?.split('\n').slice(0, 3).join('\n')
    }) : null,
    runDurationSeconds: latestExecution.startedAt && latestExecution.stoppedAt
      ? (new Date(latestExecution.stoppedAt) - new Date(latestExecution.startedAt)) / 1000
      : 0
  }
}];
```

### n8n Node Configuration: Get Latest 01e Execution
```
Operation: Get Many
Return All: false
Limit: 1
Filters → Workflow: [Select 01e from list OR enter workflow ID]
Filters → Status: Success
Options → Include Execution Details: true
```

### Error Trigger Configuration
```
Node type: n8n-nodes-base.errorTrigger
Parameters: {} (no configuration — automatically receives errors from linked workflows)
```

Linked via n8n UI: Workflow settings → "Error Workflow" dropdown on 01e's workflow.

## State of the Art

The 01e scanner currently runs at 8:20 AM daily with:
- Profile auto-feeds (up to 8 roles) + Search Queries (HH RSS type)
- Single feed per role (area=113, Russia-wide)
- RSS items post-filtered for geography + title keywords
- Within-run dedup then Pipeline dedup
- Safety brake: 100 net-new max
- Known ~160 raw items ceiling (observed from earlier runs)

This measurement workflow replaces the current manual "read from UI" approach with automated, structured data capture.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `data.runData` is the correct JSON path for per-node execution data in the running n8n instance | Architecture Patterns | Parsing returns zeroes. Fix: inspect actual API response, adjust path. |
| A2 | n8n node "Include Execution Details" returns the same full runData as `includeData=true` on raw API endpoint | Standard Stack | If it only returns metadata, fall back to HTTP Request node. |
| A3 | Summing `output[0].length` across all loop entries gives correct item counts | Patterns | If n8n returns items differently inside loops, alternative counting needed. |
| A4 | 01e completes within 5 minutes (8:20–8:25 window) | Pitfalls | If 01e runs longer, schedule must be pushed to 8:30/8:35. |
| A5 | Airtable "Baseline Metrics" table can use the same `airtableTokenApi` credential | Standard Stack | If permissions differ, new credential needed. Low risk — same base. |
| A6 | Error Trigger sends `execution.id` that can be used to fetch full runData via n8n node | Pitfalls (Pitfall 6) | If execution data is redacted on error, error diagnostics limited to error message only. |
| A7 | Workflow ID `HhRuRssScanner01e` from the JSON file matches the actual n8n instance ID | Code | n8n assigns its own numeric ID on import. User must verify actual workflow ID. |
| A8 | n8n Cloud or self-hosted instance has the n8n node (n8n-nodes-base.n8n) available | Standard Stack | Available in n8n 1.0+. Confirmed by existing documentation. |

## Open Questions (RESOLVED)

1. **What is the exact structure of `data.runData` in the user's n8n instance?** — RESOLVED: Exact structure varies by n8n version. Mitigation implemented: before building measurement workflow, do one manual test run to inspect the JSON response; use defensive `?.` accessors in parsing code so missing paths return `null` instead of crashing.

2. **Does the workspace at `workflows/` need a new airtable template CSV?** — RESOLVED: Yes. Plan 03-01 creates the CSV template at `airtable/templates/Baseline Metrics-Grid view.csv` and updates `airtable/AIRTABLE-SCHEMA.md` with the new table schema, following existing template patterns.

3. **Should the Error Trigger be part of the same measurement workflow JSON?** — RESOLVED: Yes. Include both Schedule Trigger and Error Trigger in the same `03-baseline-diagnosis.json` workflow, connected via an IF node checking which trigger fired. Single file keeps measurement logic together.

4. **What is the exact workflow ID of 01e in the user's n8n instance?** — RESOLVED: n8n assigns numeric IDs on import. Mitigation documented in SETUP-03-BASELINE.md as a post-import step: user copies workflow ID from n8n UI Settings → pastes into Error Trigger's Workflow ID field.

## Environment Availability

> This phase creates an n8n workflow JSON for import. The n8n instance runs externally (Cloud or self-hosted). No local execution dependencies.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| n8n instance (Cloud/self-hosted) | All measurement workflow operations | Not locally installed | — | User imports to their n8n instance |
| Airtable PAT credential | Airtable writes | Configured in existing n8n | — | Reuse existing `airtableTokenApi` |
| n8n API key | n8n node authentication | Requires setup | — | Generate from n8n Settings → API |
| Node.js | Support scripts (optional) | ✓ | 24.16.0 | — |
| Docker | Running n8n locally | ✗ | — | n8n Cloud or existing self-hosted |

**Missing dependencies with no fallback:** none — the phase produces a JSON workflow file that imports into the existing n8n instance.

**Missing dependencies with fallback:** 
- Docker/n8n not installed locally → measurement workflow runs on user's existing n8n instance (Cloud or server)
- n8n API key → generate from n8n Settings → API Keys (existing pattern documented in n8n docs)

## Validation Architecture

> `workflow.nyquist_validation` is enabled (absent = enabled per config.json)

### Test Framework
| Property | Value |
|----------|-------|
| Framework | n8n manual execution verification (no automated test suite) |
| Config file | None — n8n workflows are verified by manual execution |
| Quick run command | Execute measurement workflow manually in n8n UI |
| Full suite command | Run 01e, then verify measurement workflow captures correct metrics |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HH-12 | Measurement workflow correctly captures and records baseline metrics | Manual | Execute measurement workflow after 01e completes; inspect Airtable record | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** N/A — n8n JSON files cannot be run locally
- **Per wave merge:** Import workflow into n8n, trigger manually, verify Airtable record appears
- **Phase gate:** Two back-to-back successful 01e runs with matching metrics recorded in Baseline Metrics table, visible in n8n execution logs + Airtable

### Wave 0 Gaps
- [ ] No automated test framework exists for n8n workflows — all verification is manual (pre-existing pattern)
- [ ] `tests/` directory does not exist in this project (per STRUCTURE.md: "No automated test suite")

## Security Domain

> `security_enforcement` is enabled in config.json.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Read-only n8n API key access; Airtable PAT already configured |
| V3 Session Management | No | No user sessions |
| V4 Access Control | Partial | n8n API key should have read-only scope for executions |
| V5 Input Validation | No | All data is machine-generated from n8n internal APIs and Airtable |
| V6 Cryptography | No | No sensitive data handled; no encryption requirements |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key exposure in workflow JSON | Information Disclosure | Store n8n API key as n8n credential (Header Auth), not inline in workflow JSON. Reuse existing credential pattern. |
| Airtable PAT scope too broad | Elevation of Privilege | Use the existing read-write PAT. For this phase, read access to Profile + write to Baseline Metrics is sufficient. |

## Sources

### Primary (HIGH confidence)
- [CITED: /n8n-io/n8n-docs] — Workflow Trigger node events: "Active Workflow Updated" and "Workflow Activated" only
- [CITED: /n8n-io/n8n-docs] — n8n Trigger node events: own workflow events only
- [CITED: /n8n-io/n8n-docs] — Error Trigger node: catches failures from linked workflows, provides `execution.id`, `execution.error`, `execution.lastNodeExecuted`
- [CITED: /n8n-io/n8n-docs] — n8n node "Get Many Executions": workflow filter, status filter, includeDetails option
- [CITED: /n8n-io/n8n-docs] — API authentication via `X-N8N-API-KEY` header
- [CITED: /n8n-io/n8n-docs] — API execution endpoint with `includeData` parameter
- [CITED: /n8n-io/n8n-docs] — Execution response schema: `data.additionalProperties: true` contains runData
- [CITED: /n8n-io/n8n-docs] — Code node expected output format: `[{ json: { ... } }]`

### Secondary (MEDIUM confidence)
- [CITED: Project 01e workflow JSON] — Workflow ID `HhRuRssScanner01e`, node names, execution flow
- [CITED: Project ARCHITECTURE.md] — Architectural patterns, anti-patterns, error handling
- [CITED: Project STRUCTURE.md] — File naming conventions, workflow import patterns
- [CITED: Project AIRTABLE-SCHEMA.md] — Existing table schemas, field types, credential patterns

### Tertiary (LOW confidence)
- [ASSUMED] — `data.runData` exact JSON path for per-node execution data (may be `data.resultData.runData` in some versions)
- [ASSUMED] — `output[0]` contains raw item arrays in runData entries (verified in loop patterns but exact nesting may vary)
- [ASSUMED] — 01e execution time < 5 minutes (8:20–8:25 window). Known to process ~160 items with 1s delay per fetch — likely under 5 min but needs confirmation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all nodes are n8n built-in, well-documented
- Architecture: MEDIUM — trigger approach differs from D-03 assumption; runData structure unverifiable without inspecting user's instance
- Pitfalls: MEDIUM — based on documented n8n behavior and cross-referenced with project patterns

**Research date:** 2026-06-07
**Valid until:** 2026-07-07 (stable — core n8n API changes slowly)
