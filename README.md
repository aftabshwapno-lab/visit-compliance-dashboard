# Visit Compliance Dashboard — GitHub Pages Package

This repository builds a static GitHub Pages dashboard from **two Excel workbooks**:

1. a visit schedule workbook; and
2. a Store Operations Compliance Audit response workbook.

The dashboard layout and logic are designed to match the supplied **August 2026 Visit Compliance Dashboard** reference: KPI cards, status/officer filters, officer search, sortable officer-wise table, visible-row CSV download, completion coloring, and officer outlet details.

## Important: Excel filenames are NOT fixed

You can replace the two Excel files with **any filenames**. The build identifies each workbook by its **sheet names and column headers**, not by the filename.

Keep the workbook structure/headers the same.

### Schedule workbook contract

The workbook must contain:

- Sheet `Zonal` with headers: `SL`, `CODE`, `Outlet Name`, `Zonal HR Name`, followed by date columns.
- Sheet `RHO` with headers: `SL`, `CODE`, `Outlet Name`, `Regional Head HR Name`, followed by date columns.
- Planned cells use `Yes` (case-insensitive).

### Response workbook contract

The workbook must contain sheet `Response Summary` with at least:

- `Response ID`
- `Date`
- `Time`
- `Site Code`
- `Created By User ID`

Extra columns are allowed.

## First-time GitHub setup

1. Create a **brand-new GitHub repository**.
2. Extract this ZIP and upload **all files and folders** to the repository. Make sure `.github/workflows/deploy-pages.yml` is present.
3. Commit to the `main` branch.
4. In GitHub, open **Settings → Pages**.
5. Under **Build and deployment**, choose **Source: GitHub Actions**.
6. Open the **Actions** tab and wait for **Deploy Visit Compliance Dashboard** to finish.
7. Open the Pages URL shown in the deployment.

> Recommended: keep the repository private/appropriately access-controlled because the source response workbook contains operational data. Do not publish sensitive workbooks in a public repository.

## How to refresh the dashboard later

This is the key workflow:

1. Open the repository `data/` folder.
2. **Delete the old schedule Excel and old response Excel.**
3. Upload the new two Excel files. Their filenames can be completely different.
4. Keep the same respective sheets and headers listed above.
5. Commit the change.
6. GitHub Actions automatically detects which file is the schedule and which is the response workbook, rebuilds `dashboard_data.json`, and redeploys the dashboard.

If old and new copies are both kept in `data/`, the build intentionally fails rather than guessing which workbook to use.

## Snapshot date

By default, the dashboard uses the **latest response date in `Response Summary`** as the snapshot date. Therefore, Till-Date plans, Remaining Visits, Never Visited Outlets, and Completion % update automatically as the response workbook changes.

To force a historical cutoff, edit `config/dashboard.config.json`:

```json
{
  "snapshotDateOverride": "2026-08-04"
}
```

Set it back to `null` for automatic latest-date behavior.

## Metric logic

- **Total Planned Visits (Full Month):** every `Yes` assignment in the schedule workbook.
- **Total Planned Visits (Till Date):** planned assignments whose date is on/before the snapshot date.
- **Accepted Responses:** unique Response Summary rows through the snapshot with Response ID, Date, Site Code, and Created By User ID.
- **Planned-Date Responses:** accepted response rows matching the same resolved officer + outlet code + date.
- **Other / Unplanned Responses:** accepted responses not matching the same resolved officer + outlet + date.
- **Distinct Planned Visits Completed:** each due officer + outlet + date assignment is counted once if one or more matching responses exist.
- **Remaining Visits:** due assignments with no same-officer, same-outlet, same-date response.
- **Never Visited Outlets Till Date:** each due outlet code is counted once per officer if that officer has no response for that outlet on **any date** through the snapshot. A response on a non-planned date removes the outlet from the never-visited count, but does not complete the planned-date assignment.
- **Completion %:** Distinct Planned Visits Completed ÷ Total Planned Visits (Till Date).

The **Visible Officers** KPI excludes `Unmapped` response-only rows, matching the reference dashboard behavior; the table can still display `Unmapped` rows.

## Officer name matching

The build tries, in order:

1. exact normalized officer name;
2. punctuation-insensitive normalized officer name;
3. officer-name + site-code disambiguation where needed;
4. reviewed aliases in `config/officer_aliases.json`;
5. otherwise the response stays under `Unmapped`.

Do not delete the alias file unless you are intentionally changing mapping behavior.

## Local test (optional)

Install Python 3.11+ (no third-party packages are required), then run:

```bash
python scripts/build.py
```

Serve the `site/` folder with any local static web server. Do not open `site/index.html` directly with `file://` because browsers block the JSON fetch in that mode.

## Troubleshooting

### Action says it cannot identify the two workbooks

Check that `data/` contains only one schedule workbook and one response workbook and that the required sheets/headers are unchanged.

### Missing header error

Restore the exact header text. Filenames may change; required headers may not.

### Dashboard shows Unmapped officer rows

A `Created By User ID` does not uniquely match a schedule officer. Add a reviewed mapping to `config/officer_aliases.json` if appropriate.

### GitHub Pages is blank / 404

Open **Actions** and inspect the latest workflow. Also verify **Settings → Pages → Source = GitHub Actions**.

## Repository structure

```text
.github/workflows/deploy-pages.yml   GitHub Pages build/deployment
config/dashboard.config.json         snapshot and calculation settings
config/officer_aliases.json          reviewed officer-name variants
data/*.xlsx                           the two replaceable input workbooks
web/                                  static dashboard UI
site/                                 generated build output (recreated by workflow)
scripts/build.py                      schema detection, Excel parsing + calculations
```
