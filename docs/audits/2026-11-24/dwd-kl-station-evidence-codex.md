# Berlin-Tempelhof station evidence audit

- Auditor — Codex. Source intake incorporates Antigravity’s manual Berlin review.
- Base — `f967472f5a906b3a24926ab81ed58b1dfcf85930`, tree `7d89fe1d0a27630ecb884c1923831d3a8e26dbff`.
- Branch — `codex/dwd-kl-station-evidence-20261124`. Day 1 covers the data contract and original archive replay.
- Previous audit — [Canadian daily station evidence](../2026-11-19/eccc-daily-station-evidence-codex.md).

## Data contract and evidence

The growing-area reference is limited to the DWD KL recent archive for `00433`, Berlin-Tempelhof. The catalogue still listed `Frei` on 24 November 2026. DWD describes the data as a rolling 500-day series, with quality control incomplete. The retained original provider file has 550 days. The parser limits selection to a maximum of 366 days within the documented 500-day lookback through yesterday UTC. The archive remains preliminary regardless of individual quality levels. The published dataset applies CC BY 4.0. [DWD dataset specification](https://opendata.dwd.de/climate_environment/CDC/observations_germany/climate/daily/kl/DESCRIPTION_obsgermany-climate-daily-kl_en.pdf) · [Catalogue and archives](https://opendata.dwd.de/climate_environment/CDC/observations_germany/climate/daily/kl/recent/)

The recorded sensor rows support 2 m air measurements and a separate 5 cm near-ground minimum. Berlin's active temperature extrema metadata uses a midnight-to-midnight UTC interval. The mean uses at least 21 hourly readings. The recorded precipitation interval is 06:00 UTC to 06:00 the next day. The parser checks the metadata for the date of each returned reading. It retains the two quality columns and distinguishes a reported missing reading from an absent date.

The [test fixture](../../../tests/fixtures/dwd-berlin-tempelhof-00433-recent.zip) is an original archived DWD download retrieved 19 November, SHA-256 `9d3004fe42ef3fd05f10975ae27714e0621cbe31a45a59f047a5f91a181831ec`. A fresh fetch at 19:32 UTC on 24 November provided 41,772 bytes, SHA-256 `ff097ba2336e8054d311c16819958997a294f7d7e9aa2fdeebd5c7f374937908`, member `produkt_klima_tag_20250523_20261123_00433.txt`. An independent Python CSV read agreed with all 2,562 readings and quality cells for 366 of 366 requested dates from 23 November 2025 through 23 November 2026. Both downloads originate from DWD.

## Findings and disposition

| ID | Problem | Status | Executed evidence |
| --- | --- | --- | --- |
| DWD-07 | A recent row appeared as a finalized historical row in the prototype. | Verified in parser | Original recent row `2026-11-15` preserves codes 1 and 1. The historical filename is held. |
| DWD-12 | The prototype admitted contradictory air extrema. | Verified in parser | A deliberately inverted original row is held. Actual 5 cm values above and below the 2 m minimum pass. |
| DWD-14 | The prototype labelled the active observation basis MEZ. | Verified in parser | Actual UTC metadata passes. Substituted MEZ, Fahrenheit, incorrect sensor height and geographic identity mismatch are held. |
| DWD-01 / DWD-08 | Reported zero, a missing value and no station day must remain distinct. | Verified in parser | Original zeroes and a dated synthetic omission and missing sentinel were replayed. |
| DWD-13 | Earlier instruments and observation regimes differ. | Held | The current release scope uses a single recent station and current metadata. Earlier regimes and additional station eligibility need their own review. |

## Verification

- Node 24 typecheck passed. The seven new Berlin checks and twelve Canadian regressions passed. The app integration, export, CI and visual checks remain open at this checkpoint.
- This step has no rendered change. Preserve user selections, crop records and existing observation/forecast paths during integration.

## Next continuation

### Day 2 integration

The Germany provisional crop preview offers an explicit Berlin-Tempelhof selection and bounded dates. The new read-only route accepts only a known station and two days. It fetches the fixed DWD archive under a deadline. The DWD response checked from the production origin omits browser CORS permission. ZIP extraction checks content type, member size, CRC, duplicate names, one exact data product and the required metadata. It only decodes the admitted text members and uses the original archive's Windows-1252 encoding.

The panel and HTML disclose incomplete quality control, preserve the two quality codes, show the separate 2 m and 5 cm fields and distinct precipitation interval, and distinguish a missing reading from an absent date. This adds a rendered panel. It makes no writes to crop profiles, site details or geometry. The mounted planner retires pending requests and old downloads on changes to dates, station, country, site or accepted acting account. A live server-loader read for 7 April 2026 returned a 2 m minimum of 2.2 °C and a 5 cm minimum of −5.0 °C.

Node 24 typecheck, 116 affected checks and whitespace passed on local integration checkpoint `a401dc023e906c77122c3fecdfbc168f007bb995`. Those checks cover the actual export payload, stale date/country/site/actor cases, Canadian station regressions, the grower workflow and the 12 px type floor. The candidate was then brought onto released main `0cad92a78ec8ad2dbbcddcf0c5fb40836cec43ca`, retaining both audit index entries from the shared date.

### Day 3 hosted verification

The signed-out sample at hosted `c6cfe1471` returned five original Berlin days. The actual downloadable and rendered HTML matched all 35 readings and codes, with measured zeroes, attribution and both instrument heights. A live April record showed distinct 2 m and near-ground minimums. The profile save and reopen retained a grower-entered 37-day nursery interval, an unknown first harvest and no station readings. Date and country changes retired old results. Ottawa's measured zero, both Wisconsin tomato intervals and the South African sample calendar still reproduced. This is evidence of the named station, the signed-out sample and the selected archive only. Local agronomy and additional station admissions require their own evidence.

The integration is refreshed against published main `31e8916bb005246683de2018348237da61ef1e46` after an intervening earthworks release. The station application and test files are byte-identical to the hosted candidate. The dated audit index and update notes retain both changes. The integration has its own required release checks.
