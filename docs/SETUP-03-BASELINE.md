# Baseline Diagnosis Setup Guide

Setup walkthrough for the Phase 3 baseline measurement workflow. This workflow captures per-run metrics from the existing 01e hh.ru RSS scanner **without modifying it** — zero code changes to existing workflows.

**How it works (success path):** The 01e scanner workflow itself captures metrics inline — a Code node at the end of 01e calculates per-node item counts and writes them directly to the "Baseline Metrics" Airtable table. This means zero external API calls (no n8n API key needed). **Error path:** A separate lightweight workflow (the original 03-baseline-diagnosis.json) handles the Error Trigger — when 01e errors, it captures the failure data and writes error metrics to the same table. Phase 5 (Verification) will query this table for comparison.

**Reference decisions (CONTEXT.md):**
- **D-01:** Metrics extracted via n8n REST API, not manual UI inspection
- **D-02:** Separate measurement workflow — no changes to 01e
- **D-03:** Automatic trigger via Schedule Trigger (success) + Error Trigger (failure)
- **D-04:** Per-node item counts captured at each pipeline stage
- **D-05:** Error details captured for any node-level failures
- **D-06:** Metrics stored as Airtable records in "Baseline Metrics" table
- **D-07:** Full Profile snapshot recorded alongside each run's metrics
- **D-08:** Two-run protocol — back-to-back runs, compare results
- **D-09:** Debug-first protocol — do not record broken baselines

---

## 1. Overview

Baseline metrics are captured through two independent paths:

**Success path (inline within 01e):**
During normal 01e execution, a Code node at the end of the workflow calculates per-node item counts using the workflow's own live data. An Airtable node writes these metrics directly to the "Baseline Metrics" table. No external API calls needed.

```
01e runs (8:20 AM) → [normal execution] → Code: capture metrics → Airtable: record baseline
```

**Error path (measurement workflow):**
When 01e errors, the Error Trigger fires the measurement workflow (`workflows/03-baseline-diagnosis.json`). It parses the error execution data and writes error metrics to the same table.

```
01e errors → Error Trigger → Parse error data → Airtable: record error baseline
```

Both paths record to the same "Baseline Metrics" Airtable table, differentiated by their `Execution Status` field.

**Important:** This setup is purely observational. It reads 01e's execution data and writes to Airtable. It cannot interfere with or modify 01e's behavior.

---

## 2. Import Workflow

1. Open your n8n instance (Cloud or self-hosted)
2. Go to **Settings** (gear icon) → click the **...** menu → **Import from File**
3. Select `workflows/03-baseline-diagnosis.json` from the repo
4. The workflow will appear as **"JobSignal - Workflow 03 - Baseline Diagnosis"** in your workflows list

After import, the workflow will have:
- A **Manual Trigger** (for testing)
- An **Error Trigger** (catches 01e failures — this is the main trigger)
- A **Code node** (parses error runData for metrics)
- An **Airtable Search node** (gets Profile for snapshot)
- A **Code node** (combines metrics with Profile snapshot)
- An **Airtable Create node** (writes error metrics to Baseline Metrics table)

**Do not activate the workflow yet** — complete the remaining setup steps first.

---

## 3. Airtable Setup

### 3.1 Import the Baseline Metrics CSV template

1. Go to your **JobSignal Engine** Airtable base
2. Click **+** to add a table → **Import data** → **CSV file**
3. Select `airtable/templates/Baseline Metrics-Grid view.csv`
4. Name the new table **"Baseline Metrics"**

### 3.2 Update field types

CSV import creates all fields as plain text. Update these field types to match the schema:

| Field | Change Type To | Options / Notes |
|-------|---------------|-----------------|
| Execution ID | Text | Default |
| Run Timestamp | Date (DateTime) | Include time — format: `ISO` or `Local` |
| Execution Status | Single select | Add options: `Success`, `Error` |
| Feeds Generated | Number (Integer) | |
| Total RSS Items | Number (Integer) | |
| After Geography Filter | Number (Integer) | |
| After Dedup | Number (Integer) | |
| Net New Pipeline Records | Number (Integer) | |
| Pipeline Records Created | Number (Integer) | |
| Run Duration Seconds | Number (Decimal) | 1 decimal place recommended |
| Error Details | Long text | Default |
| Per Feed Items | Long text | Default (stores JSON array string) |
| Per Feed After Geo | Long text | Default (stores JSON array string) |
| Profile Snapshot | Long text | Default (stores JSON string) |
| Notes | Long text | Default |

See [`airtable/AIRTABLE-SCHEMA.md`](../airtable/AIRTABLE-SCHEMA.md) for the full field reference.

### 3.3 Update Baseline Metrics table ID in 01e

After creating the table, update the Airtable Create node in the 01e scanner workflow:

1. Open the **01e scanner workflow** in n8n
2. Find the **"Record Baseline Metric"** Airtable node
3. In the **Table** field, select the new **"Baseline Metrics"** table
4. Also update the **"Create Error Baseline Metric"** node in the **"JobSignal - Workflow 03 - Baseline Diagnosis"** workflow
5. Click **Execute Node** on each to verify the table is reachable

---

## 4. Credential Setup

The measurement workflow uses only Airtable nodes — no n8n API key is required. Metrics are captured inline by 01e itself (success path) or via the Error Trigger (error path), which receives execution data directly without API calls.

### 4.1 Verify Airtable credential access

The measurement workflow uses the same `airtableTokenApi` credential as all other workflows:

1. In n8n, go to **Credentials** → **airtableTokenApi**
2. Click **Check Credential** to verify it still works
3. The credential must have scopes: `data.records:read`, `data.records:write` for the JobSignal Engine base
4. If expired, regenerate at [airtable.com/create/tokens](https://airtable.com/create/tokens) and update the credential

> **No n8n API key needed:** Because metrics are captured inline during 01e execution, the measurement workflow does not need to query the n8n REST API. This avoids the API key requirement (which is gated behind n8n paid plans) and simplifies setup.

---

## 5. Configure Error Trigger

> **Why this is needed (RESEARCH Pitfall 4):** The Error Trigger node won't receive 01e's errors unless 01e is explicitly configured to use this workflow as its error handler. This is a manual n8n UI setting — it cannot be configured in workflow JSON. Since the measurement workflow no longer has a Schedule Trigger (success metrics are captured inline by 01e), the Error Trigger is its only automatic trigger.

1. Open the **01e scanner workflow** (named `JobSignal - 01e - hh.ru RSS Scanner` or similar)
2. Click the **Workflow Settings** icon (gear icon in the workflow editor toolbar)
3. Scroll to the **Error Workflow** dropdown
4. Select **"JobSignal - Workflow 03 - Baseline Diagnosis"**
5. Click **Save** (important — this setting persists only after saving)
6. **Verify:** Reopen settings and confirm the selection is still there
7. **Activate** the measurement workflow (toggle to Active) so the Error Trigger works

> **Troubleshooting:** If the measurement workflow doesn't appear in the dropdown, ensure it has been imported (Step 2) and activated (Step 7). If it still doesn't appear, save and reload the n8n page.

---

## 6. Verify 01e Workflow ID

> **Why this is no longer needed:** The measurement workflow no longer has an n8n API node. Error data is received directly via the Error Trigger — no workflow ID lookup needed. Success metrics are captured inline by 01e itself.

**No action required for this section.** The architecture was changed from "query via API" to "capture inline" to avoid requiring an n8n API key (which is a paid n8n feature).

---

## 7. Two-Run Protocol

> **Per D-08:** Run 01e twice, back-to-back on the same day. If both runs produce similar metrics, the baseline is stable. Variance is itself informative.

### Day 1 — First Run

1. Ensure all previous setup steps are complete (Airtable credentials assigned, Error Trigger configured, 01e active)
2. Ensure the **01e scanner workflow** is **Active** (toggle on)
3. Execute **01e manually** (or wait for the 8:20 AM schedule)
4. Wait for 01e to complete (usually 2–5 minutes)
5. Check the **Baseline Metrics** table in Airtable — a new record should appear with:
   - A valid `Execution ID` matching the n8n execution log
   - `Execution Status` = Success
   - Numeric metrics filled in (Feeds Generated, Total RSS Items, etc.)
   - A `Profile Snapshot` containing your Profile fields as JSON
   - Notes: "Inline capture from 01e"
6. Metrics are captured automatically during 01e execution — no separate measurement workflow run needed for the success path

### Day 1 — Second Run (immediately after)

1. Execute **01e manually** again (immediately after confirming the first run succeeded)
2. Wait for 01e to complete
3. Check the **Baseline Metrics** table again — a second record should appear
4. **Compare** the two records:
   - Are Feeds Generated the same? (Expect yes — same Profile configuration)
   - Are Total RSS Items similar? (Small variance is normal for RSS)
   - Is Net New Pipeline Records similar? (Should be similar if no new jobs appeared between runs)
   - If they differ significantly (>20% variance), investigate before proceeding

### Interpreting Results

| Scenario | Interpretation | Action |
|----------|---------------|--------|
| Both runs similar (<10% variance) | Baseline is stable | Proceed to Phase 5 (Verification) |
| Both runs similar but very low numbers | Scanner needs improvement | Continue to Phase 4 (Diagnosis) |
| Runs differ significantly (>20% variance) | Variance is the finding | Document the variance pattern, investigate root cause |
| First run errors/has no results | Do not record | Debug first (see Section 8) |

---

## 8. Debugging

> **Per D-09:** If a run produces zero results or errors, debug first before proceeding. Do not record a broken baseline.

### 8.1 Measurement shows zero results

**Check:** Did 01e execute successfully first?
- Open 01e's execution history in n8n (clock icon on the workflow)
- Look at the latest execution — did it complete with items?
- If 01e had zero items, the measurement correctly records zero — no bug
- If 01e had items but measurement shows zero, the inline capture Code node may have issues accessing `$items()` from nodes inside loops
- Open the 01e execution details and check the "Capture Baseline Metrics" node output

**Fix:** Check 01e execution logs for the "Capture Baseline Metrics" node output. If it shows `feedsGenerated: 0`, inspect the `$items("Build Feed List")` call — the node reference name must match exactly.

### 8.2 No Airtable record appears

**Check:** n8n execution history for the measurement workflow
- Open the measurement workflow → clock icon
- Look for error messages in failed executions
- Common causes:
  - **Airtable credential expired** — re-authenticate `airtableTokenApi`
  - **Airtable table not found** — verify table is named exactly "Baseline Metrics"
  - **Field mapping mismatch** — the Airtable Create node schema may need refreshing (click the node, select base and table again)
  - **n8n API Key credential missing** — verify the Header Auth credential is assigned to the n8n node

### 8.3 n8n node returns no data

**Check:** Execution ID and workflow ID filter
- Run the n8n node manually (click **Execute Node**)
- If it returns empty, the filter may be wrong or 01e hasn't run yet
- Run 01e first, then re-execute the n8n node
- Verify credentials (X-N8N-API-KEY header) are correct

### 8.4 Error Trigger doesn't fire

**Check:** Error Workflow setting in 01e
- Open 01e's Workflow Settings → Error Workflow dropdown
- Confirm it's set to **"JobSignal - Workflow 03 - Baseline Diagnosis"**
- Click **Save** again — this setting must be saved explicitly
- If the measurement workflow isn't in the list, ensure it's been imported

### 8.5 Common Errors Reference

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Measurement shows zeros but 01e had items (RESEARCH Pitfall 2) | runData JSON path differs in your n8n version | Inspect actual 01e execution JSON from n8n API; adjust Code node paths with defensive `?.` accessors |
| n8n node returns "authentication failed" (T-03-02) | n8n API Key credential missing or expired | Regenerate API key in n8n Settings → API Keys; update the Header Auth credential |
| Error Trigger never fires (RESEARCH Pitfall 4) | Error Workflow not set in 01e settings | Configure Error Trigger per Section 5 |
| Run Timestamp is empty or wrong format | Date field type not set correctly | Update Baseline Metrics → Run Timestamp to Date (DateTime) type |
| Profile Snapshot is garbled or truncated | Long text field type not set | Update Baseline Metrics → Profile Snapshot to Long text type |
| Schedule Trigger fires but 01e is still running (RESEARCH Pitfall 5) | 01e takes >5 minutes to complete | Increase schedule delay to 8:30/8:35, or add retry loop to measurement workflow |

### 8.6 Debug-First Protocol (D-09)

1. **Identify the symptom** — no record, zero values, or error state
2. **Check the measurement workflow execution logs** — n8n shows exactly which node failed and why
3. **Isolate the fault** — is it a credential issue, a data parsing issue, or a configuration issue?
4. **Fix the root cause** — update credentials, adjust Code node paths, or correct settings
5. **Re-run the measurement workflow** — execute it manually after fixing
6. **Verify the Airtable record** — does it have correct values?
7. **Only then proceed** — do not record a broken baseline for Phase 5 comparison

---

## 9. Scraping After Baseline

After the two-run protocol is complete and the baseline is recorded, metrics continue being captured automatically:

- **8:20 AM:** 01e scanner runs (existing schedule, unchanged)
- **During 01e execution:** Inline capture nodes record success metrics to Baseline Metrics table
- **On 01e error:** Error Trigger fires, measurement workflow captures error details

Each successful 01e run adds a new row to the Baseline Metrics table.

### Phase 5 Handoff

Phase 5 (Verification) will query the Baseline Metrics table to:

1. **Compare pre- and post-improvement metrics** — did feed diversity increase items captured?
2. **Identify variance patterns** — are some days significantly different from others?
3. **Validate improvements** — did changes to 01e parameters produce measurable gains?

> Keep the Baseline Metrics table accumulating data. A longer baseline (7–14 days) provides more reliable comparison data than two runs.
