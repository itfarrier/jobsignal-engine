# Airtable Schema

## Quick Start — Import CSV Templates

To save time, import the CSV templates from the `airtable/templates/` folder instead of creating tables manually:

1. In Airtable, create a new base called **"JobSignal Engine"** in its own workspace (important — Airtable free tier caps at 1,000 records per base)
2. For each CSV file, click **"+" → "Import data" → "CSV file"**
3. Import in this order:
   - `Profile-Grid_view.csv`
   - `Tracked_Companies-Grid_view.csv` (pre-loaded with 139 verified companies — remove any you don't want)
   - `Pipeline-Grid_view.csv`
   - `Search_Queries-Grid_view.csv` (only needed if using JobSpy on self-hosted)
4. **After importing, update field types** as shown in the tables below — CSV import creates all fields as plain text, but some need to be Select, Number, Checkbox, Date, etc.

---

## Tables Overview

| Table | Records | Purpose |
|-------|---------|---------|
| **Profile** | 1 row | Your skills, target roles, geography, CV markdown. Drives all AI prompts. |
| **Tracked Companies** | 139 pre-loaded | Companies to scan daily. Remove any you don't want — keep what's relevant to your industry. |
| **Pipeline** | Auto-populated | Every discovered job with full lifecycle tracking. |
| **Search Queries** | User-configured | JobSpy search parameters (self-hosted only). |

---

## Profile Table

After importing, update these field types and fill in your row:

| Field | Change Type To | Required | Notes |
|-------|---------------|:--------:|-------|
| Full Name | Text | ✅ | Used in CV generation |
| Professional Summary | Long text | ✅ | Injected into AI scoring prompts — 2-3 sentences positioning you |
| Core Skills | Multiple select | ✅ | Add your primary technical skills as options |
| Secondary Skills | Multiple select | | Supporting skills |
| Target Roles | Multiple select | ✅ | Job titles you're pursuing |
| Target Industries | Multiple select | ✅ | Preferred industries |
| Negative Filters | Multiple select | ✅ | Hard exclusions (Junior, PHP, Blockchain, etc.) |
| Seniority Level | Single select | ✅ | Options: Mid, Senior, Staff, Lead, Head |
| Location Preference | Single select | | Options: Remote Only, Hybrid, On-site, Any |
| Target Geography | Multiple select | ✅ | Options: Canada, USA, Remote Global, Remote North America, EMEA, UK, APAC, **Russia**, **Moscow**, **Saint Petersburg**, **Remote Russia** |
| AI Model | Text | | Informational reference — the actual model is configured in each n8n OpenAI node. Use this field as a reminder of which model you're running. |
| Scoring Rubric Override | Long text | | Custom instructions appended to the AI scoring prompt |
| CV Markdown | Long text | ✅ | Your full CV in markdown — critical for STAR responses and CV tailoring |
| Notification Email | Text | ✅ | Where alerts and digests go |

### Target Geography — Russia (hh.ru)

Scanner `01e` uses **area=113 (Russia-wide)** on RSS fetch whenever any RU-relevant geography is selected (D-08), then post-filters parsed region, description, and title against substring unions from **all** selected Profile geographies (D-10, D-11) — same pattern as Greenhouse `01a`.

| Airtable option | hh `area` ID | Scanner behavior |
|-----------------|--------------|------------------|
| Russia | 113 | RSS `area=113`; post-filter via `GEO_MAP` substrings below |
| Moscow | 1 | Same fetch area (113 per D-08); post-filter Moscow substrings |
| Saint Petersburg | 2 | Same fetch area (113 per D-08); post-filter SPb substrings |
| Remote Russia | (none) | `area=113` + post-filter remote RU substrings in region/description/title (D-09) |

**GEO_MAP extensions for `01e` Parse & Filter** (substring arrays, case-insensitive match in region + stripped description + title):

| Profile value | Substrings |
|---------------|------------|
| Russia | `россия`, `russia`, `рф` |
| Moscow | `москва`, `moscow`, `мск` |
| Saint Petersburg | `санкт-петербург`, `saint petersburg`, `spb`, `питер` |
| Remote Russia | `удаленно`, `удалённо`, `remote`, `дистанцион` |

Area ID reference: [api.hh.ru/areas/113](https://api.hh.ru/areas/113)

---

## Pipeline Table

After importing, update these field types. **Do not fill in any rows** — workflows populate this automatically.

| Field | Change Type To | Auto-populated | Notes |
|-------|---------------|:--------------:|-------|
| Job ID | Text | ✅ | FNV-1a hash of title + company + apply link |
| Job Title | Text | ✅ | |
| Company | Text | ✅ | |
| Location | Text | ✅ | |
| Apply Link | URL | ✅ | Direct application URL |
| Job Description | Long text | ✅ | Full JD for AI scoring |
| Source | Single select | ✅ | Add options: LinkedIn, Indeed, Greenhouse, Ashby, Lever, Glassdoor, **hh.ru** |
| Source Query | Text | ✅ | Which query or company found this job |
| Source Tag | Text | ✅ | Label from the query that discovered it |
| Discovery Date | Date | ✅ | When first seen |
| Status | Single select | ✅ | Add options: New, Evaluated, Applied, Interview, Offer, Rejected, Archived |
| Fit Score | Number (1 decimal) | ✅ | 1-10 scale |
| Fit Tier | Single select | ✅ | Add options: High, Medium, Low |
| Match Reasoning | Long text | ✅ | AI explanation of the score |
| Matched Skills | Long text | ✅ | Skills from your profile that matched the JD |
| Missing Skills | Long text | ✅ | Skills the JD wants that you lack |
| CV Tailoring Notes | Long text | ✅ | AI suggestions for CV customization |
| Salary Info | Text | ✅ | Extracted from JD if present |
| AI Evaluation Cost | Number (6 decimals) | ✅ | Token cost for this evaluation |
| Applied Date | Date | | Set manually when you apply |
| Response Date | Date | | Set manually when you hear back |
| Outcome Notes | Long text | | Interview feedback, rejection reason, etc. |
| Tailored CV Text | Long text | ✅ | Markdown version of tailored CV |
| CV Tailoring Cost | Number (6 decimals) | ✅ | Token cost for CV tailoring |
| Tailored CV | Attachment | ✅ | DOCX file (self-hosted only) |
| Interview Questions | Long text | ✅ | 15 tailored questions (High Fit only) |
| STAR Responses | Long text | ✅ | 5 STAR stories (High Fit only) |
| Interview Prep Cost | Number (6 decimals) | ✅ | Token cost for interview prep |

---

## Tracked Companies Table

After importing, update these field types. The CSV comes pre-loaded with 139 verified companies across 30 categories. Remove companies outside your industry or add new ones as needed.

| Field | Change Type To | Notes |
|-------|---------------|-------|
| Company Name | Text | Display name |
| Careers URL | URL | Link to company careers page |
| API Endpoint | URL | Greenhouse/Ashby/Lever API URL |
| Scan Method | Single select | Add options: Greenhouse API, Ashby, Lever |
| Title Keywords | Text | Comma-separated positive keywords (blank = all roles at that company) |
| Enabled | Checkbox | Toggle scanning on/off |
| Notes | Text | Why this company is tracked |
| Last Scan | Date | Auto-updated by workflows |
| Jobs Found Last Scan | Number | Auto-updated by workflows |

---

## Search Queries Table (JobSpy + HH RSS)

Skip this table if using n8n Cloud (JobSpy only). After importing, update these field types:

| Field | Change Type To | Notes |
|-------|---------------|-------|
| Query | Text | Human label (e.g., "AI Automation — Canada") |
| Source Type | Single select | Add options: **JobSpy**, **HH RSS** (D-12) |
| Query String | Text | Search term for `text=` param (e.g., "AI automation engineer") |
| Title Keywords | Text | Comma-separated per-query title filters |
| JobSpy Sites | Text | **JobSpy-only** — comma-separated: indeed, linkedin |
| Location | Text | JobSpy: city name (e.g., "Toronto, Canada"). **HH RSS:** hh area ID as plain text (`"1"`, `"2"`, `"113"`) — not city name (D-14) |
| Country Filter | Text | **JobSpy-only** — e.g., "Canada" (for Indeed filtering) |
| Hours Old | Number | **JobSpy-only** — recency filter (e.g., 72 for last 3 days) |
| Results Wanted | Number | **JobSpy-only** — max results per query (capped at 100 by safety brake) |
| Source Tag | Text | Label applied to discovered jobs (e.g., "AI Hunter") |
| Enabled | Checkbox | Toggle on/off without deleting the query |
| Last Run | Date | Auto-updated by workflows |
| Results Last Run | Number | Auto-updated by workflows |

### Search Queries (HH RSS)

Enabled rows with `Source Type = HH RSS` merge with Profile auto-feeds in scanner `01e` (D-17). Reused columns:

- **Query** — human label for the row
- **Query String** — overrides RSS `text=` when set (D-13)
- **Title Keywords** — comma-separated; any keyword must appear in vacancy title (case-insensitive)
- **Location** — hh **area ID** as plain text (`"1"`, `"2"`, `"113"`). When empty, derive area like auto-feeds: `113` if Profile has any RU-relevant geography (D-15). Allowed IDs: `{1, 2, 113}` only.
- **Source Tag**, **Enabled**, **Last Run**, **Results Last Run** — same semantics as JobSpy rows

**JobSpy-only columns** (ignored for HH RSS rows per D-16): JobSpy Sites, Country Filter, Hours Old, Results Wanted.

**Example HH RSS row:**

| Query | Source Type | Query String | Title Keywords | Location | Source Tag | Enabled |
|-------|-------------|--------------|----------------|----------|------------|---------|
| Python RU manual | HH RSS | python developer | Python, FastAPI | 113 | RU Hunter | ✓ |

---

## Manual Airtable Setup (required before first `01e` run)

n8n typecast may **not** create new single-select options. Add these manually in the Airtable UI before the first `01e` Create node succeeds:

1. **Profile → Target Geography:** add Russia, Moscow, Saint Petersburg, Remote Russia
2. **Search Queries → Source Type:** add HH RSS
3. **Pipeline → Source:** add `hh.ru`

---

## Recommended Airtable Views

Create these views in your Pipeline table for easier workflow:

| View | Filter | Purpose |
|------|--------|---------|
| **High Fit — Review** | Fit Tier = "High" AND Status = "Evaluated" | Daily action list — apply to these |
| **Medium Fit — Review** | Fit Tier = "Medium" AND Status = "Evaluated" | Weekly review of borderline matches |
| **Applied — Tracking** | Status = "Applied" | Monitor response pipeline |
| **Interview Pipeline** | Status = "Interview" | Active interview tracking |
| **All Active** | Status NOT IN ("Archived", "Rejected") | Full pipeline view |
