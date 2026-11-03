# UK Historical Station Reference Contract: Yeovilton

## 1. Fetched Source Receipts & Provenance
Four public HTTPS URLs were fetched unauthenticated via coordinator `curl` on `2026-11-03` (`httpStatus: 200`, `exitCode: 0`). Root verified all bytes, SHA256 digests, and parsed rows; AGY ran zero commands, fetches, or tests, and no adapter is implemented:
- **Directory**: [https://www.metoffice.gov.uk/research/climate/maps-and-data/historic-station-data](https://www.metoffice.gov.uk/research/climate/maps-and-data/historic-station-data) (`2026-11-03T08:47:24.759897+00:00`, `164649` bytes, `f96dee75e5999b9fd0860fe1cc14ad2501185c19c9b4428554eae1d8df084211`).
- **Station**: [https://www.metoffice.gov.uk/pub/data/weather/uk/climate/stationdata/yeoviltondata.txt](https://www.metoffice.gov.uk/pub/data/weather/uk/climate/stationdata/yeoviltondata.txt) (`2026-11-03T08:47:24.979488+00:00`, `39641` bytes, `4cc4286694a3330df589f6045c215111fc62cdea249f5eca976399ecf8c830ea`).
- **Legal**: [https://www.metoffice.gov.uk/policies/legal](https://www.metoffice.gov.uk/policies/legal) (`2026-11-03T08:47:25.264548+00:00`, `89302` bytes, `86798fe18d85f44a89d7f86301f0511691ea5d29521ef8df6f5902ecb0848c4e`).
- **Terms**: [https://www.metoffice.gov.uk/policies/tandc](https://www.metoffice.gov.uk/policies/tandc) (`2026-11-03T08:47:25.427303+00:00`, `108896` bytes, `51a50016c9d5f6d8d4e088fa76058dd704d9205ce539b056db51b99385678dfb`).

## 2. Station Format, Rolling Cadence & Validation
- **Printed Facts (`yeoviltondata.txt`)**:
  - `Yeovilton` (opened `1964`): 753 lines (5 preamble, 2 header, 746 monthly rows `1964-09`–`2026-10`). Files update on a **rolling monthly cadence**; rows stay `Provisional` (`2026-01`–`2026-10`, 10 rows) until full network quality control completes.
  - Columns/units: `yyyy` (year), `mm` (`1`–`12`), `tmax` (`degC`), `tmin` (`degC`), `af` (integer `days` of air frost), `rain` (`mm`), `sun` (`hours`).
  - Markers: `---` missing (>2 days missing); `*` HadUK-Grid interpolated estimate; `#` on `sun` Kipp & Zonen sensor (else Campbell-Stokes); trailing `Provisional`.
- **Proposed Validation & Coverage Boundary**:
  - Verify headers/units, enforce ascending `(yyyy, mm)` without duplicates/internal gaps, parse `---` as `null` (never zero), strip `*`/`#` into metadata flags, and set `provisional: true`.
  - Parsers can reject non-200 HTTP, timeouts, header changes, and malformed/truncated lines, but **cannot detect omitted complete trailing months** from file grammar alone; freshness/coverage requires external period checks.

## 3. Agronomic & Network Limitations
Monthly `af` values are air-frost **day counts**, never first/last frost dates, daily minimums, forecasts, or sowing permissions. Yeovilton is one station, not whole-Somerset suitability or the live UK network; files are for general interest, not operationally used by the Met Office (HadUK-Grid is primary), and may reflect site/instrument changes.

## 4. Terms, Attribution & Unresolved Automated-Access Gate
Crown Copyright applies. Terms grant reuse under UK Open Government Licence v3.0 with attribution `"Contains public sector information licensed under the Open Government Licence v3.0"` and forbid implying endorsement. Gadget/email clauses are scoped separately, without resolving this file's terms. However, the OGL content grant is separate from exclusions for underlying services/differently licensed content and a clause prohibiting automated monitoring/copying except expressly provided or authorised APIs. Although the coordinator fetch succeeded unauthenticated, product/API auth is **UNKNOWN** and recurring automated-fetcher permission remains **UNRESOLVED** unless explicit source terms resolve this endpoint.

## 5. Proposed Negative Requirements
1. **No Silent Coercion**: Never convert `---` to `0`, drop missing-`sun` rows, fail on `*`/`#`, or treat `Provisional` rows as final.
2. **No Frost-Date Inference**: Never derive frost dates or planting approvals from monthly `af` counts.
3. **Fail-Closed Gate & Trailing-Month Check**: Block recurring fetches while automated-use permission is unresolved, reject malformed/duplicate rows, and never assume grammar proves latest-month completeness.
