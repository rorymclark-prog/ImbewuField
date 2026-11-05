# Field-block length entry in metres and international feet

The pure authority is `lib/length-units.ts`. It converts linear dimensions only. It imports no crop catalogue, country, language, account, storage or geometry module. `FieldBlockConfig` and saved design measurements remain metres. Rotations remain degrees; bed counts, areas and normalized/pixel positions are not converted by this helper.

## Verified factor

One international foot is exactly **0.3048 metre**. The coordinator-fetched [NIST SP 811 Appendix B.8](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b8) prints the foot-to-metre factor `3.048 E-01` in bold, marking it exact. The supplied primary body was fetched at 2026-11-03T03:17:40.010237Z, HTTP 200, 169494 bytes, SHA256 `be7334086bcb574317dd1f78a7822adb699670b7f2bece6ca8a252884158eb5f`. This implementation independently checked its actual body bytes/SHA and table row against the supplied receipt; it made no new network request.

Metres-to-feet uses arithmetic division by that factor. JavaScript numeric results retain ordinary binary floating-point limits. This is not the former U.S. survey foot. Inches, mass, area/density conversions, package weights and country-inferred units are outside this implementation. No farming dimensions or recommendations are introduced.

## Input convention

The form must explicitly describe decimal input: **a point or comma is a decimal separator; grouping marks and unit suffixes are not accepted**. Thus `1,000` means decimal one, never a thousand. A leading decimal (`.5` or `,5`), ordinary plus/minus sign and trailing decimal (`1.`) are accepted. Blank input, a sign alone or decimal mark alone remains incomplete. Mixed separators, grouping spaces, exponents, hexadecimal, fractions and appended units are invalid. A nonzero decimal outside the numeric range cannot silently become zero. Conversion also rejects nonzero-to-zero underflow and nonfinite overflow.

The parser permits finite negative values. Existing field geometry owns whether a particular bed or path dimension is permitted. The existing signed direction parser remains separate and degrees are never passed through a length conversion.

## Draft and save contract

`createLengthDraft` captures a supplied source key and detached immutable original metre dimensions. The UI must bind this key to its actual site, selected field, saved configuration and relevant source geometry/frame/exclusions. A source key is a caller-owned identity comparison, not authorization or a country declaration.

Each field stores its explicit input unit, text, edit status and staged canonical metres. A valid edit is converted once from that explicit unit. An unedited field retains its original canonical number exactly; merely focusing, formatting or reopening does not parse a rounded display back into geometry. The same text does not create an artificial edit.

Display uses six decimal places where practical. Very small nonzero values use an expanded plain decimal rather than display zero. This is presentation precision only. A valid unit switch formats the existing full-precision staged metres. It never derives canonical metres from the formatted text. An invalid, incomplete, unsupported, mixed-unit, stale-source or unrepresentable switch returns the original draft unchanged. No save or geometry mutation is performed by a render or unit switch.

`readLengthDraft(draft,currentSourceKey)` returns canonical metre dimensions only when the captured source matches and all explicit units/entries are ready. A same-value parent object clone does not change that key or discard unfinished input. An actual saved/source change must revoke stale apply; the UI owns its reload/discard interaction. Name, angle, mode and field selection remain UI responsibilities. Existing `bedsInsideField`/save validation remain the geometry authority.

## Verification scope

The dedicated tests cover the verified conversion direction, strict numeric convention and bounds, immutable source snapshots, full-precision edit/toggle/reopen behavior, source changes and mixed-unit drafts. A real tight-boundary `bedsInsideField` control proves a single exact-fit bed remains one bed after toggles; deliberately parsing the rounded feet display back into metres loses that bed. The check therefore detects the actual geometry drift, rather than merely confirming a constant.

Pure/helper tests do not prove the React draft lifecycle, account/sample preference isolation, screen layout or save/reload flow. Those require the separate UI tests and actual desktop/phone inspection. No new runtime language, translated calibrated lessons, region readiness or production release is claimed here. `PLAN_VERSION` is unchanged.
