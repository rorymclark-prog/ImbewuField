# Canadian daily station evidence · 19 November 2026

Baseline `79adc2321ab22afdf8f921399d7f68dea23b30ad`, tree `0162f9627328f2e93f8b5614b483b2dbefda1c89`. Follow-up to the [Wisconsin harvest evidence audit](wisconsin-tomato-first-harvest-codex.md). The bounded reader and read-only planner panel share the same report wording and typed weather observations.

## Source and boundaries

The input is the ECCC MSC GeoMet daily climate observations GeoJSON, scoped to an explicitly requested climate identifier and inclusive provider-local day range. The parser preserves the representative station segment and public daily minimum, mean and maximum air-temperature values in degrees Celsius. Station observations give retrospective context. Crop recommendations, site conditions, frost and heat clearance and irrigation demand need their own evidence. UTC arithmetic counts calendar days without moving the provider's labels.

Data Source: Environment and Climate Change Canada. The archived public Saskatoon RCS fixture was retrieved on 19 November 2026 for 1–7 October 2018. File SHA-256 `c50b5bd324bf21070e6f49e8bc1b4a43db5312595b66ec453a372ac9b49a39fa`. Seven dates and all 21 values and quality flags matched the retained ECCC CSV. A separate live request for the station segment 4057120 over 24–27 January 2012 reproduced the archived estimated and missing flags. Those comparisons use two output formats from the same provider. [Daily schema](https://api.weather.gc.ca/collections/climate-daily/schema?f=html) · [Data Services End-use Licence](https://eccc-msc.github.io/open-data/licence/readme_en/) · [Historical data flag guide](https://climate.weather.gc.ca/FAQ_e.html#Q4)

## Findings

| ID | Behavior verified or needed |
| --- | --- |
| ECCC-DAY-01 | Date coverage is counted for the requested station and window. A missing returned field, a whole day without records, a provider estimate, other flags and an observed zero remain distinct. |
| ECCC-DAY-02 | Data held for wrong station, segment conflicts, mismatched source or units, invalid days, or incomplete response metadata. Identical overlapping daily rows count once and conflicting rows hold the series. |
| ECCC-DAY-03 | The real Production plan accepts an explicit Canadian context and station request. The 24–27 January 2012 result displayed four dates, two fully unflagged days, estimates and reads marked missing. Its downloaded HTML retains values, flags, coverage, provider attribution, licence and standalone scope. A real 0 °C maximum stayed visible at a 390 px viewport. |
| ECCC-DAY-04 | The mounted planner regression covers a country/workspace round trip with a pending request and a station change that revokes an earlier download. The sample route saved and reopened a separately entered 35-day cabbage nursery estimate. The 27 April 2027 nursery date survived while first harvest, crop weight and entry window stayed unknown. |

The reader emits evidence only. It leaves the existing planning, saved records and reference eligibility code paths untouched. The browser proof used a backend-free synthetic sample and actual requests to the public station endpoint. Physical printing, real-account writes and local agronomic validation remain separate. Exact candidate CI and outside reviews must pass before release.
