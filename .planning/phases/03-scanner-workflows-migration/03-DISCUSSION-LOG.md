# Phase 3: Scanner Workflows Migration - Discussion Log

**Date:** 2026-06-10
**Mode:** Interactive (default)

## Areas Discussed

### 1. Integration Method
| Question | Answer | Options |
|----------|--------|---------|
| n8n interaction method | HTTP Request nodes to NocoDB Data API v3 | HTTP Request nodes (Recommended), NocoDB native node, Mix approach |
| Auth method | HTTP Header Auth credential with xc-token | HTTP Header Auth, n8n env var, NocoDB credential |
| NocoDB URL config | NOCODB_URL env var | Env var, Hardcode, n8n variables |
| Base/Table ID config | Env vars per table | Env vars, Hardcode |

### 2. Table Reference Strategy
| Question | Answer | Options |
|----------|--------|---------|
| Bootstrap ID communication | Print env var assignments to stdout | Print to stdout, Write to .env |

### 3. Code Node Data Access
| Question | Answer | Options |
|----------|--------|---------|
| HTTP Request output access | Add transform node to unwrap {list: [...]} | Transform node, Update Code nodes |
| Field naming | Title Case (match Airtable) | Title Case, camelCase |
| Profile fetch pattern | Separate HTTP Request per workflow | Separate node, Code node inline |
| JobSpy geography | Fix TODO — add Profile reading | Fix it now, Keep as-is |

### 4. Dedup Query Pattern
| Question | Answer | Options |
|----------|--------|---------|
| Query structure | Field projection, Job ID only | Field projection, Full record fetch |

## Deferred Ideas

None.
