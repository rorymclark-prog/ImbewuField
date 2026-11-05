# NRCS Bounded Query Adapter Contract (Documentation Only)

Coordinator-fetched SDA documentation and one synthetic probe (manifest `debeeac86eaf3ad003601b7ed5d0cdc9ff977fc384ad7a7a546ea95555445710`) inform a future read-only adapter.
- Documentation: `https://sdmdataaccess.nrcs.usda.gov/WebServiceHelp.aspx` (HTTP 200, fetched 2026-11-05 17:00:57 UTC).
- Query Endpoint: `https://SDMDataAccess.sc.egov.usda.gov/Tabular/post.rest` (HTTP 200, 199 bytes, fetched 2026-11-05 17:03:25 UTC).

### Documented Query Service Parameters
The `post.rest` Query Service accepts POST form parameters:
- `QUERY` (required): SQL select script or Shape command.
- `SERVICE` & `REQUEST`: Documented optional query selectors (`SERVICE=query`, `REQUEST=query`); the observed probe explicitly submitted both selectors.
- `FORMAT` (optional, documented default `XML`): Documented options include `XML`, `JSON`, `JSON+COLUMNNAME`, `JSON+COLUMNNAME+METADATA`, and `~` (echoes unexecuted query text with full macro expansion).

### Response Parsing: `JSON+COLUMNNAME+METADATA`
For the chosen format, the returned JSON structure is `{"Table": [row0, row1, row2, ...]}`:
1. **Row 0 (Column Names)**: Array of column header strings (e.g. `["probe"]`).
2. **Row 1 (Metadata)**: Column schema metadata strings formatted as comma-separated `name=value` pairs derived from SQL Server schema tables (e.g. `ColumnOrdinal`, `ProviderType`, `DataTypeName`).
3. **Row 2+ (Data Rows)**: The observed probe contains string `"1"`, a synthetic constant, not soil data. The help does not establish every future scalar/null representation; validate template-specific types and widths.

### Operational Boundaries & Scope
- **Caps & Limits**: The documented 100,000-row maximum is an official query-result cap; the 100,000-byte cap was a coordinator-selected transport safety limit for curl. Neither represents an app default or request-rate ceiling.
- **Observed Access vs. Unknowns**: One unauthenticated constant-only probe succeeded, providing direct endpoint evidence. General authentication policies, reuse terms, rate limits, update cadence, and service SLAs remain unverified beyond this single request.
- **Adapter Scope**: This research does not authorize raw client SQL pass-through, persistent Area of Interest (`pAOI`) creation, interpretation/rating services, report endpoints, or transmission of farmer locations. Future adapters must use explicitly approved, bounded query templates that satisfy privacy and country readiness gates.
- **Failures**: Errors, empty datasets, or transport failures must never be converted into zero soil limitations, crop spacing advice, fertilizer recommendations, or farming approvals.

### Proposed checks (unexecuted)
- *Next Verification*: Write a strict response parser asserting that data extraction starts exclusively at row index 2 when using `JSON+COLUMNNAME+METADATA`.
- *Negative Scenarios*:
  1. Reject parsing if header (row 0) or metadata (row 1) is parsed as soil data.
  2. Reject treating synthetic probe values or test constants as soil findings.
  3. Abort unapproved queries attempting arbitrary client SQL, `pAOI` creation, or coordinate transmission.
  4. Block converting transport failures or null responses into zero soil risk.

```json
{
  "status": "documentation-only",
  "manifestSha256": "debeeac86eaf3ad003601b7ed5d0cdc9ff977fc384ad7a7a546ea95555445710",
  "review": "unreviewed-ai-draft",
  "coordinatorProbePerformed": true,
  "commandsRun": false,
  "testsRun": false,
  "validation": "UNKNOWN",
  "workersActive": 0,
  "runtimeActivation": false,
  "soilObserved": false,
  "countrySupported": false,
  "productApiImplemented": false,
  "humanFluentApproval": false,
  "localLegalApproval": false,
  "customerTestingPerformed": false
}
```
