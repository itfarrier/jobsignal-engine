# Phase 3: Baseline Diagnosis - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-07
**Phase:** 03-baseline-diagnosis
**Areas discussed:** Metric capture method, Baseline data format, Execution conditions

---

## Metric Capture Method

| Option | Description | Selected |
|--------|-------------|----------|
| Manual n8n UI read | Run workflow, read metrics from n8n execution log manually | |
| n8n API export | Use n8n REST API to fetch execution data programmatically | ✓ |
| Lightweight logging script | Write a small external script that captures execution output | |

**User's choice:** n8n API export
**Notes:** User wanted programmatic extraction via n8n's built-in API.

Follow-up: What should the script look like?
| Option | Description | Selected |
|--------|-------------|----------|
| Standalone Node.js script | scripts/ folder, trigger via n8n API | |
| Shell script with curl | Simple bash using curl | |
| n8n workflow that exports itself | Separate measurement workflow in n8n | ✓ |

**User's choice:** n8n workflow that exports itself

Follow-up: Which data points?
| Option | Description | Selected |
|--------|-------------|----------|
| Item counts only | Just items in/out per node | |
| Item counts + error details | Error messages, 429/403, safety brake | ✓ |
| Item counts + per-feed breakdown | Per-feed breakdown of items | |

**User's choice:** Item counts + error details

Follow-up: Trigger approach?
**User's response:** "Runs automatically after 01e: for error or success final."
The measurement workflow should trigger automatically when 01e completes, regardless of success or error outcome. n8n Workflow Trigger node pattern identified as the approach.

---

## Baseline Data Format

| Option | Description | Selected |
|--------|-------------|----------|
| Markdown report only | Readable document with metrics | |
| JSON + Markdown | Both programmatic and human-readable | |
| Airtable record | Write metrics to a new Airtable table | ✓ |

**User's choice:** Airtable record

Follow-up: Where in Airtable?
| Option | Description | Selected |
|--------|-------------|----------|
| New Baseline Metrics table | Clean separation, queryable by Phase 5 | ✓ |
| Existing Pipeline table field | Hackier for querying | |
| Search Queries record | Semantically odd | |

**User's choice:** New Baseline Metrics table

Follow-up: How many runs?
| Option | Description | Selected |
|--------|-------------|----------|
| Single run | Quick snapshot | |
| Two runs back-to-back | Check consistency | ✓ |
| Three runs over 3 days | Most trustworthy average | |

**User's choice:** Two runs back-to-back
**Notes:** User needed clarification on terminology. After explaining items = job vacancies and baseline = before measurement, user chose two runs.

---

## Execution Conditions

| Option | Description | Selected |
|--------|-------------|----------|
| Full Profile snapshot | Record all Profile fields | ✓ |
| Target Geography & Roles only | Just feed-relevant fields | |
| No Profile snapshot | Assume Profile is stable | |

**User's choice:** Full Profile snapshot

Follow-up: What if zero results or error?
| Option | Description | Selected |
|--------|-------------|----------|
| Retry once | If zero/error, retry immediately | |
| Record as-is | Zero IS the baseline | |
| Debug first | Pause and figure out why | ✓ |

**User's choice:** Debug first

---

## the agent's Discretion

No areas deferred to agent discretion — all decisions were explicitly captured.

## Deferred Ideas

None.

---

*Discussion: 2026-06-07*
