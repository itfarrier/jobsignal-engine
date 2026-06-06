# Baseline Diagnosis Setup Guide

Setup walkthrough for the Phase 3 baseline measurement workflow. This workflow captures per-run metrics from the existing 01e hh.ru RSS scanner **without modifying it** — zero code changes to existing workflows.

**What this workflow does:** After 01e completes (or errors), the measurement workflow queries the n8n API for 01e's execution data, extracts per-node item counts (feeds generated, RSS items, geo-filtered items, dedup results, Pipeline records created), reads a Profile snapshot, and writes everything to the new "Baseline Metrics" Airtable table. Phase 5 (Verification) will query this table for comparison.

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

The baseline measurement workflow (`workflows/03-baseline-diagnosis.json`) is a data-capture pipeline:

```
01e runs (8:20 AM daily) → Schedule Trigger (8:25 AM) fetches execution data
                      ↓ Error → Error Trigger captures execution ID
                      ↓
          n8n node: Get execution with full runData
                      ↓
          Code node: Parse runData for per-node item counts
                      ↓
          Airtable node: Get Profile for snapshot
                      ↓
          Airtable node: Create Baseline Metrics record
```

The workflow handles both success and error outcomes from 01e. It runs fully automatically after initial setup — no manual intervention required once configured.

**Important:** This workflow is purely observational. It reads 01e's execution data and writes to Airtable. It cannot interfere with or modify 01e's behavior.

---

## 2. Import Workflow

1. Open your n8n instance (Cloud or self-hosted)
2. Go to **Settings** (gear icon) → click the **...** menu → **Import from File**
3. Select `workflows/03-baseline-diagnosis.json` from the repo
4. The workflow will appear as **"JobSignal - Workflow 03 - Baseline Diagnosis"** in your workflows list

After import, the workflow will have:
- A **Schedule Trigger** (runs at 8:25 AM daily — 5 min after 01e's 8:20)
- An **Error Trigger** (catches 01e failures)
- An **n8n node** (queries 01e execution data)
- A **Code node** (parses runData for metrics)
- An **Airtable Search node** (gets Profile for snapshot)
- An **Airtable Create node** (writes to Baseline Metrics table)
- An **IF node** (routes between schedule path and error path)

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

### 3.3 Verify Airtable credential access

The measurement workflow uses the same `airtableTokenApi` credential as all other workflows. Verify it has write access to the new table:

1. In n8n, go to **Credentials** → **airtableTokenApi**
2. Click **Check Credential** to verify it still works
3. The credential must have scopes: `data.records:read`, `data.records:write` for the JobSignal Engine base
4. If expired, regenerate at [airtable.com/create/tokens](https://airtable.com/create/tokens) and update the credential

---

## 4. n8n Credential Setup

The measurement workflow uses an n8n node to query execution data. This requires an **n8n API key** stored as an n8n Header Auth credential.

### 4.1 Generate an n8n API key

1. In n8n, go to **Settings** (gear icon) → **API Keys**
2. Click **Add API Key**
3. Enter a label like `Baseline Measurement`
4. Copy the generated key — it starts with `n8n_api_...`

> **Security note:** The API key provides access to execution data (read-only). Store it as an n8n credential — never embed it as plain text in the workflow JSON. See threat mitigation T-03-02.

### 4.2 Create the Header Auth credential

1. In n8n, go to **Credentials** → **Add Credential**
2. Search for **Header Auth**
3. Configure:
   - **Credential Name:** `n8n API Key`
   - **Header Name:** `X-N8N-API-KEY`
   - **Header Value:** (paste the key from step 4.1)
4. Click **Save**

### 4.3 Assign the credential

1. Open the **"JobSignal - Workflow 03 - Baseline Diagnosis"** workflow
2. Find the **n8n** node (it queries 01e executions)
3. In the node settings, under **Credential**, select **n8n API Key**
4. The node will now authenticate to the n8n REST API on execution

---

## 5. Configure Error Trigger

> **Why this is needed (RESEARCH Pitfall 4):** The Error Trigger node won't receive 01e's errors unless 01e is explicitly configured to use this workflow as its error handler. This is a manual n8n UI setting — it cannot be configured in workflow JSON.

1. Open the **01e scanner workflow** (named `JobSignal - 01e - hh.ru RSS Scanner` or similar)
2. Click the **Workflow Settings** icon (gear icon in the workflow editor toolbar)
3. Scroll to the **Error Workflow** dropdown
4. Select **"JobSignal - Workflow 03 - Baseline Diagnosis"**
5. Click **Save** (important — this setting persists only after saving)
6. **Verify:** Reopen settings and confirm the selection is still there

> **Troubleshooting:** If the measurement workflow doesn't appear in the dropdown, ensure it has been imported (Step 2) and that you have workflow editor permissions. If it still doesn't appear, save and reload the n8n page.

---

## 6. Verify 01e Workflow ID

> **Why this is needed (RESEARCH A7):** n8n assigns a numeric workflow ID on import. The workflow JSON may have a static ID that doesn't match your instance. The measurement workflow must query the correct 01e workflow.

1. Open the **01e scanner workflow** in n8n
2. Look at the browser URL — the path contains `/workflow/<numeric_id>`
3. Note this numeric ID (e.g., `42`)
4. Open the **"JobSignal - Workflow 03 - Baseline Diagnosis"** workflow
5. Find the **"Get 01e Execution"** n8n node
6. In the **Workflow** filter field, enter the numeric ID from step 2
7. Also update the **Error Trigger** node if it has a Workflow ID field
8. **Verify:** Click **Execute Node** on the n8n node — it should return the latest 01e execution without errors

> **Tip:** If the n8n node returns no results, check that 01e has run at least once (even an error run counts). The filter looks for completed executions.

---

## 7. Two-Run Protocol

> **Per D-08:** Run 01e twice, back-to-back on the same day. If both runs produce similar metrics, the baseline is stable. Variance is itself informative.

### Day 1 — First Run

1. Ensure all previous setup steps are complete (credentials assigned, Error Trigger configured, workflow ID verified)
2. **Activate** the **"JobSignal - Workflow 03 - Baseline Diagnosis"** workflow (toggle to Active)
3. Execute **01e manually** (or wait for the 8:20 AM schedule)
4. Wait for 01e to complete (usually 2–5 minutes)
5. Wait for the measurement workflow to trigger at 8:25 AM (or trigger it manually after 01e completes)
6. Check the **Baseline Metrics** table in Airtable — a new record should appear with:
   - A valid `Execution ID` matching the n8n execution log
   - `Execution Status` = Success or Error
   - Numeric metrics filled in (Feeds Generated, Total RSS Items, etc.)
   - A `Profile Snapshot` containing your Profile fields as JSON

### Day 1 — Second Run (immediately after)

1. Execute **01e manually** again (immediately after confirming the first run succeeded)
2. Wait for 01e to complete
3. Wait for the measurement workflow to trigger
4. Check the **Baseline Metrics** table again — a second record should appear
5. **Compare** the two records:
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
- If 01e had zero items, the measurement workflow correctly records zero — no bug
- If 01e had items but measurement shows zero, the n8n node may have the wrong workflow ID or filter

**Fix:** Verify the Workflow ID filter in the n8n node (Step 6) and re-execute.

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

After the two-run protocol is complete and the baseline is recorded, the measurement workflow continues running daily:

- **8:20 AM:** 01e scanner runs (existing schedule, unchanged)
- **8:25 AM:** Baseline measurement workflow runs, records metrics for the latest 01e execution
- **On 01e error:** Error Trigger fires, measurement workflow captures error details

Each day adds a new row to the Baseline Metrics table with that day's measurements.

### Phase 5 Handoff

Phase 5 (Verification) will query the Baseline Metrics table to:

1. **Compare pre- and post-improvement metrics** — did feed diversity increase items captured?
2. **Identify variance patterns** — are some days significantly different from others?
3. **Validate improvements** — did changes to 01e parameters produce measurable gains?

> Keep the Baseline Metrics table accumulating data. A longer baseline (7–14 days) provides more reliable comparison data than two runs.
