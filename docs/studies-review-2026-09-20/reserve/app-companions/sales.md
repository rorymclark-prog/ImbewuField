# C07 - Record a sale once: verification record

Implementation route: `/student/guides/sales`. Six English steps, a four-stage invoice/payment explainer, a decision exercise, printing and links to existing guides. Uses the inspected lifelike market illustration copied unchanged from the course art archive.

## Actual app workflow

See [F5 app/source evidence](../finance/f5-sources.md) for baseline and limitations. Production sample invoice #0043 was updated from unpaid to fully paid, Saved stayed at 69, Sold exposed one matching invoice link, and that link reopened the same number and R50.00 amount. Changing the entry basis resets the form, so the guide places that choice first. An earlier new sample invoice saved but did not remain after navigation: new-entry persistence was not established and is not claimed here. No real customer data was entered or sent.

## Local checks

The local route and accessible guide content loaded. Welcome/consent onboarding obscured visual review on both fresh local origins. No consent was accepted on the user's behalf. Preview visual and interaction checks were subsequently completed below. All four pages of the separately generated F5 workbook were rendered and inspected: readable tables, writing space, margins and footers; no overflow.

The payment explainer starts paused; its order, delivered invoice, part receipt and final receipt all refer to one sale. Amounts are authored, never generated image text. It offers direct stage buttons, previous/next and play/pause, and removes bar transitions for reduced motion. Browser behaviour and layouts were subsequently verified below.

## Release checks

Record branch preview, mobile/desktop visuals, all four numeric states, play/pause/restart, exercise feedback and destination links in the release ledger before publication. Final production revision and deployed route must be checked after merge. This guide is not narrated, a filmed screen recording or a new accounting feature.

## Preview acceptance — 21 September 2026

Inspected `https://imbewufield-finance-sales-unit.vercel.app/student/guides/sales` at initial branch `5583d2c`. The configured preview exposed the guide without the local-only onboarding obstruction. At desktop width 1280 and phone width 390, the hero, payment cards and reading/practice sections were visually inspected. The phone document width and scroll width both measured 390; no horizontal overflow. All four stages displayed the expected invoice/received/owed values. Direct selection, Previous, disabled end controls, immediate pause, full playback with automatic stop and replay to the order stage were checked. Pause held the order stage during the separate practice exercise. Both incorrect answers gave specific corrective feedback; the correct choice showed R40.00 received/R80.00 outstanding. Read the steps reached the first step; Open Sold exposes `/records?tab=sold`. Browser error log was empty.

A final source review found that `lib/finance-series.ts` assigns the full paid invoice amount to its single payment date. A follow-up clarification preserves actual instalment dates in the separate supporting record and states the chart limitation explicitly. Its workbook page was re-rendered and inspected; four pages remain. Final deployed-copy and Studies-entry checks belong in issue #35 after publication. No partial-payment feature is implied by the animation.


## Production release

Published by [PR471](https://github.com/rorymclark-prog/ImbewuField/pull/471), merge `02b445e7d648ac0290ed670e5cf8825a1fd84611`. Production deployment35561778676 succeeded; `/api/build-info` reported main / `02b445e` from its environment. The live `/student/guides/sales` hero, layout, part-payment stage (R120.00 / R40.00 / R80.00), controls and final instalment-date paragraph were inspected. The source and PDF remain reserve drafts; this readable app companion is public. [Release ledger](https://github.com/rorymclark-prog/ImbewuField/issues/35#issuecomment-5755486697) tracks the release-note follow-up and main checks.
