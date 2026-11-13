# Provisional monthly temperature comparison — 13 November 2026

- Auditor: Codex; independent successor review and external release gates remain separate.
- Starting revision: `3253c91bbbe11f58ec94cf66b0bf2fda8a4441a2`.
- Branch: `codex/provisional-temperature-comparison-20261113`, stacked on PR #1373.
- Previous audit: [Temperature source receipts](power-temperature-receipt-codex.md).
- Scope: optional irrigated-tomato comparison, site cache, preview, saved origins, dated-cycle review and reports.
- Deployment: successor preview and current-head full CI still required; no production release.

## Findings and disposition

| ID | Problem | Disposition and evidence |
| --- | --- | --- |
| GLOBAL-G03-CLIMATE-RECEIPT-01 | Display arrays and a provider label cannot establish a comparable climate record. | Retain the response JSON representation and verify its SHA256 before rederiving the actual monthly T2M values, period, units, point and metadata. Endpoint/query validation never fetches saved URLs. Old display fallbacks stay outside the comparison. The digest proves local consistency, not provider authenticity. |
| G03-D1 | An unchanged profile does not imply the same comparison for a different planting month. | New v2 origins retain the explicit criterion/transfer and source capsule. Every actual candidate must match the current policy/climate key and the original month assessment. January's review cannot authorise February, even when both are grower-allowed. The required-input preflight uses the saved reviewed date rather than treating the search horizon start as a planting date. The actual guarded writer, save/reload, adopted record and report evidence are exercised. |
| G03-D2 | Old callbacks could reuse evidence after actor/site/country/date/cache changes. | Actual selected point, canonical mapped scope, country, policy, source, actor/sample and draft/action generation bind the preview. Raw cache bytes are a final callback check; observed storage changes retire the selection. Explicit load uses the existing authenticated location-analysis route and rechecks after every await. UI tests stub auth/transport only; real protected loading and device/account checks are unverified. |
| G03-D3 | Editable metadata, criteria or hash-shaped text could become independent truth. | Bounded detached JSON is hashed and parsed again; criterion snapshot and declaration are validated. Wrong point, units, endpoint, checksum, missing month, valid zero/negative and unrounded interval endpoints have counterexamples. Rule/version, response and assumptions survive offline replay. |
| G03-D4 | An older writer could drop an unrecognised new origin. | An isolated probe loads actual parent-commit modules and presents a v2-origin sample book. The previous guarded reader holds `raw-book-lossy-display`; its actual writer refuses the save and leaves the raw book unchanged. This proves that specific parent/sample path, not all historical clients or real-device sync. |
| G03-D5 | Crop-document reuse and NASA-data reuse are different admissions. | Preserve limited independently worded numerical facts/method from the Ethiopian guide, with its document licence unknown. Retain NASA public-information attribution/reuse qualifications separately. Source admission is not agronomic validation. |

## Source and applicability

The [Ethiopia Ministry of Agriculture SSIGL 8 guide](https://www.moa.gov.et/wp-content/uploads/2024/11/201811_SSIGL-8-Irrigation-Agronomy-and-Agricultural-Development-Plan-compressed-1.pdf), November 2018, section 4.4.2, printed19–20 / PDF41–42, explicitly compares a reported tomato optimum of18–25°C with long-term monthly project-area temperatures for irrigation cropping patterns. Original SHA256: `483a3443d6c63c1ba137f790890ea058337699574fa87141c8219c3db5f312f0`; accessed13 November2026. Both endpoints are included as an explicit comparison convention, not exact physiological failure boundaries.

The grower must explicitly choose this historical Ethiopian small-scale-irrigation methodology for transfer to irrigated field cropping. Current local applicability, cultivar and whole-season suitability remain unverified. It is not a nursery/soil threshold, planting calendar, frost test, hard crop-failure boundary, yield or water-demand model. There is no inferred `allowedEntryMonths` and no change to species, lessons, geometry or `PLAN_VERSION`.

NASA POWER is model/grid evidence, not a field measurement. The stored response supplies its actual period, statistic, source/version, requested/returned point and time standard. Client receipt time is not provider refresh. Country is grower-declared; the point is not proof of country or native grid-cell footprint. [NASA's copying statement](https://www.nasa.gov/organizations/disclaimer/) remains subject to contrary markings and [POWER attribution guidance](https://power.larc.nasa.gov/docs/referencing/) is retained. No endorsement or redistribution notification is claimed.

## Verification and limits

- Ordered typecheck, affected contracts and whitespace checks are recorded with exact source hashes in the private successor packet. The pre-print-layout run passed368 checks in25 existing files. Current-head full CI must still pass before merge/release; no ancestor result substitutes for it.
- The regression initially exposed a real cache-helper import cycle into auth/crop-book initialization. A lightweight shared cache-key module now preserves the exact v7/5dp key while avoiding that dependency; account and saved-cycle checks pass.
- The new canonical cycle case first used an insufficient nursery horizon. Giving it the required December horizon then exposed the preflight-date defect. The horizon-limited negative case remains held. Reintroducing the old preflight in a private module mutation makes the unchanged January adoption assertion fail with `provisional-temperature-needs-new-preview`.
- Independent review reproduced G03-REVIEW-01, a further G03-D1 search defect: when December is also grower-allowed, its unreviewed comparison stopped the search before a valid reviewed January cycle. The strengthened canonical case fails on the first candidate. Search now retains the new-preview reason and advances past that unreviewed month without granting it eligibility or labelling its climate unsuitable. Changed climate/policy still holds at preflight; an unreviewed February demand remains a gap.
- Actual public coarse Nairobi/London responses report2001–2025 climatology and January means20.51°C/4.14°C. Original HTML previews and saved-origin JSON were produced by the app functions, replayed and rendered for print. The climate-withheld control remains unknown. All use explicit synthetic10.5m² bed/date and28-day nursery estimates; they are engineering demonstrations, not farm validation.
- Actual print pages were inspected using a static HTML-to-PDF renderer. Browser connection is unavailable in this chat, including its recovery documentation; hosted browser/mobile/theme and protected fetch appearance remain unverified. This changes the preview/report picture. Raw original files, rendered pages and hashes are kept privately, not committed.
- Live/readback UI leads with the result and a plain-language limitation; detailed provenance is expandable. Printable output keeps supported arithmetic before the longer source explanation. Human output excludes raw response JSON and private policy/account handles.
- Automatic AGY/Claude-through-AGY routes remain disabled. Local manual packets do not constitute delivery or external review. Required same-candidate external review outcomes remain release gates. Independent Codex review is labelled as such.

## Next continuation

Resolve the exact successor review, inspect the hosted controls when browser access is available, and retain current-head full/rules/render/preview outcomes. Carry the original global-planning requirements and open regional/local-validation cases forward: this optional one-month comparison advances G03/P04 but does not complete either or the full programme.
