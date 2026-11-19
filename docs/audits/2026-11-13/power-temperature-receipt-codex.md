# Temperature source receipt — 13 November 2026

- Auditor: Codex; exact successor review required.
- Starting revision: `2fb067569dd0464b6a24eccf0e4c14d33acc8760`.
- Branch: `codex/power-temperature-receipt-20261113`, stacked on PR #1372.
- Previous audit: [Kenya tomato interval](kenya-tomato-nursery-codex.md).
- Scope: existing NASA fetch and shared temperature evidence; no new network route or UI.

## Findings and disposition

| ID | Problem | Disposition |
| --- | --- | --- |
| GLOBAL-G03-CLIMATE-RECEIPT-01 | Existing site fetch discards the response period, point and metric metadata, and missing display months become20°C. A future crop comparison cannot treat that display array as source observations. | New optional detached receipt keeps raw monthly missingness, exact averaging period, requested/returned point, API version, sources, time standard and client receipt time. Absent/invalid metadata yields no receipt. Existing displays and coverage retain their contract. |
| GLOBAL-G03-CLIMATE-RECEIPT-02 | Country reference and site fetch could disagree on averaging-period interpretation. | One shared parser supports the returned range and legacy explicit years; contradictory period declarations are withheld. |

The new receipt is not account/site/country admission. Returned coordinates are an API point, not a native grid-cell boundary. Existing cached records without metadata stay without a receipt. No crop threshold, calendar, temperature suitability, frost date or water demand is inferred. SA permissions, saved provisional replay, species, lessons, geometry and `PLAN_VERSION` remain unchanged.

## Verification

- Ordered typecheck,126 checks across10 existing files (115 feature checks plus11 release-note checks), and whitespace checks pass. Required full CI and exact successor review remain separate.
- Existing provider calls remain two: NASA and the independent Open-Meteo rainfall request. No added refresh, retry or authenticated/paid bypass.
- Missing months, valid zero/negative values, wrong units/points, contradictory/missing periods, invalid acquisition dates, detached/frozen values and old payload compatibility are covered. A private missing-to20 mutation fails the unchanged raw-month assertion with20 where null was expected. The initial mutation hook failed to locate its source; that setup failure was corrected before observing this semantic failure.
- Actual public coarse Nairobi response was decoded into a receipt. It reports API v2.10.1, a2001–2025 averaging period, T2M Celsius and twelve returned values. It is a public demonstration, not farm evidence or crop validation. Local acquisition time is distinct from the historical period. Private raw response, output and checksums are retained outside Git.
- No picture changes and no browser/PDF claims. This is a necessary evidence-retention prerequisite, not completion of G03/P04 or the global-planning goal.

## Next continuation

Bind a qualified receipt to current actor/site/country and the separately reviewed compatible crop criterion, explicit irrigation/transfer conditions, actual UI/export and versioned historical replay. A reference or decoder alone does not fulfil the original climate-derived planning requirement. Same-candidate external roles, required CI and release gates remain open; no provider orchestration or release.
