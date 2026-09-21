# C07 - Record a sale once: verification record

Implementation route: `/student/guides/sales`. Six English steps, a four-stage invoice/payment explainer, a decision exercise, printing and links to existing guides. Uses the inspected lifelike market illustration copied unchanged from the course art archive.

## Actual app workflow

See [F5 app/source evidence](../finance/f5-sources.md) for baseline and limitations. Production sample invoice #0043 was updated from unpaid to fully paid, Saved stayed at 69, Sold exposed one matching invoice link, and that link reopened the same number and R50.00 amount. Changing the entry basis resets the form, so the guide places that choice first. An earlier new sample invoice saved but did not remain after navigation: new-entry persistence was not established and is not claimed here. No real customer data was entered or sent.

## Local checks

The local route and accessible guide content loaded. Welcome/consent onboarding obscured visual review on both fresh local origins. No consent was accepted on the user's behalf. Preview visual and interaction checks are required before merging. All four pages of the separately generated F5 workbook were rendered and inspected: readable tables, writing space, margins and footers; no overflow.

The payment explainer starts paused; its order, delivered invoice, part receipt and final receipt all refer to one sale. Amounts are authored, never generated image text. It offers direct stage buttons, previous/next and play/pause, and removes bar transitions for reduced motion. Browser behaviour and layouts remain to verify in the preview.

## Release checks

Record branch preview, mobile/desktop visuals, all four numeric states, play/pause/restart, exercise feedback and destination links in the release ledger before publication. Final production revision and deployed route must be checked after merge. This guide is not narrated, a filmed screen recording or a new accounting feature.
