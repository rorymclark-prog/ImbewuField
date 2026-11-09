# Seed-pack purchase budget

This milestone extends the reviewed nursery and non-nursery field seed worksheets with a temporary seed-pack budget. The existing seed-sourcing review owns required seeds, allocation and whole-pack counts. Budget prices do not change those quantities or the automatic crop plan.

The grower explicitly chooses one of the existing pilot denominations (ZAR, KES, GBP, USD, EUR or BRL), then enters a price per pack for each eligible supply group. App language controls presentation independently of the chosen denomination. Choosing another denomination clears entered prices; no exchange conversion or country-based default is applied.

`lib/seed-pack-cost.ts` reuses the existing exact authored-decimal parser, recorded-currency admission and decimal-product authority. Blank prices and unknown counts remain unknown; entered zero remains known when every input is admitted. The 256-character price-entry ceiling is a software work bound. Dot or comma means a decimal separator, never grouping. Group labels, field dates and crop identities never imply a price, package weight or seed quantity.

The shared budget component consumes the original parent-owned review proof and currentness callback. Nursery and field consumers retain their existing actor, source, sample and operation authorities. Only complete groups with complete pack-count reviews and unique canonical group identities may be priced. A surviving numeric count from an overflow review is insufficient. A different proof clears the temporary budget; rejected or replaced proofs cannot be revived by matching labels or replaying callbacks.

Complete line costs contribute to a known subtotal using the existing decimal sum and round-trip comparison helpers. Missing groups or prices keep the budget incomplete. No known lines is unknown; known zero-cost lines can form a known zero. Unrepresentable sums are withheld. A complete represented budget still does not establish whole-farm coverage; omitted, held and other source exclusions remain visible. Display rounding never feeds arithmetic.

These values are grower-entered planning estimates. This milestone does not record seed stock, place an order, create an invoice or observed expense, change measured geometry, add crop species or lessons, or establish local farming suitability. Inputs are unsaved and reset with their review. Existing seed-sourcing CSVs retain their previous scope; budget amounts are not added to them.

Validation is tracked against the final branch bytes: pure arithmetic, shared React component and both real parent consumers, including source retirement and retained callbacks. Current-head full CI and genuine populated desktop/phone inspection remain release gates. Root browser access is disabled; no alternate browser route is used. No PLAN_VERSION change or production release is implied by this document.
