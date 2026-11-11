# Grower release descriptions: disclosed draft integration

This coordinator integration selects existing AGY candidates for the app's four
existing South African update-description tables (`zu`, `st`, `ts`, `ve`). It
adds no language, lesson, quiz, agronomic guidance or new translation. All selected
text remains **unreviewed AI draft**. Structural/source checks are not fluent,
human, agronomic or country-readiness approval.

## Selected parent sources

| Frozen packet | Whole `source.json` SHA256 | Selected messages | Existing-language candidates |
|---|---|---|---|
| `agy-grower-acceptance-release-copy-2026-11-03` | `563f7debc7acced18fb79b3bdae79eadbab7df6a433576447fbfd943db13e03b` | `growerAcceptanceRelease01`–`06`, original order | Six each in `zu`, `st`, `ts`, `ve`: 24 |
| `agy-grower-cutover-release-copy-2026-11-03` | `995635430ac2753284e1e264194f6a0e12657fa60bf4984258b8ffd1606cdcf1` | `growerCutoverRelease01`–`06`, original order | Six each in `zu`, `st`, `ts`, `ve`: 24 |

Paths above are under `docs/international/`. The coordinator independently checked
the actual whole-file source digest, exact English/key/order/message digest,
locale, candidate count, nonempty target and matching placeholder/number/literal
sets. Every selected English string matches current `RELEASE_NOTES` exactly.
No selected parent English key was already in the existing update tables, so the
48 additions replace no historical wording and create no duplicate keys.

The acceptance packet captures an earlier complete release-note file. Its
whole-source-file digest differs from today's file because later entries were
prepended; its six exact English/message digests remain unchanged. The cutover
packet's complete release-note file digest matched the pre-restamp parent snapshot.
The coordinator's later coverage restamp preserves every selected English pair;
`grower-release-coordinator-reconciliation-2026-11-03.json` binds the new file hash.
The packets and their generation-time status/source metadata were not rewritten.

## Generation metadata versus selected display

The archived packets retain `reviewStatus: unreviewed-ai-draft` and
`runtimeActivation: false`. Those fields describe their generation handoff, when
no candidates were connected to display. This later root-authorised coordinator
change selects these 48 exact candidate pairs into the **existing disclosed
update-copy surface**. Generation metadata is historical, not a claim that this
later selected display is inactive. Other packet languages/candidates remain
unselected; none is silently activated by copying these four tables.

`UpdateCopyText`, the update banner and guide retain the existing draft notice,
full English source backing, exact-source lookup, token checks and English
fallback. Control wording, original locale dictionaries, calibrated course
content, release-note history and guide destinations are unchanged. A missing,
changed, wrong-language or invalid pair continues to fall back to English.
No localization assertions were changed to hide missing descriptions.

## Verification scope

This repair responds to the actual terminal full-suite localization failures for
new acceptance/storage descriptions. Ordered Node 24 typecheck passed, followed
by **46/46 tests across seven files**: actual update-notice localization/banner/
guide, update-tour, four-language control preservation, control-icon localization
and the release-note gate/lazy-import/type-split contracts. No assertions or test
files were edited. Coordinator packet checks also validated all 48 selected pairs
and rejected 112 damaged-packet controls. Removing only these new table groups
restores the exact prior table bytes; all historical keys/values remain intact.

Passing these checks establishes source wiring and existing disclosure/fallback
behavior. It does not certify translations or replace browser, full current-head
CI and release gates. The separate finance-contract failures remain outside this
localization repair's ownership and validation claim.

A later field-unit child branch has separate source-bound release candidates.
It must inherit these parent pairs through coordinator integration. Duplicate
English identities must reuse the existing table authority rather than overwriting
or adding a second key. That later selection is not part of this parent repair.
`PLAN_VERSION`, species and calibrated lesson/quiz bodies remain unchanged.

## Child field-block unit release selection

The field-unit child selects only messages `fieldBlockUnits16`–`20`, in their
frozen order: two release descriptions followed by the tour title, location and
detail. Their shared source is
`docs/international/agy-field-block-unit-translations-2026-11-03/source.json`,
SHA256 `b60a09754ec9965e7110d7ecaa690222077821f2495a4d9f8e01233691f8a321`.
The four South African candidate files are under
`docs/international/agy-field-block-unit-sa-translations-2026-11-03/`.
The source's original locale list describes the earlier global job; the separate
South African follow-on candidates bind the same frozen English source.

All 20 selected candidate pairs were checked. **16 exact candidate pairs are
added; four existing location pairs are reused.** The English identity
`Site design → Planting → Field blocks` already has one translation authority in
each table. Its existing wording is retained even though all four new packet
variants differ. No duplicate English key or replacement translation is added.
Removing only the new field-unit group restores each inherited table byte for
byte, including all 48 parent acceptance/storage pairs and earlier history.

The five English messages match the current top release entry in exact order.
The frozen release-file hash is generation provenance, not the identity of the
later merged/restamped complete release file. Packet source/status files remain
unchanged. Their `runtimeActivation: false` records the original handoff; this
later coordinator selection displays only these chosen descriptions in the
existing disclosed, English-backed unreviewed draft surface. Rows 1–15 and the
other packet languages are not selected by this change. No fluent or human
approval, new runtime language, unit logic or farming guidance is claimed.

Child verification checks exact source/message digests, keys, English, order,
locale, placeholders/numbers/literals, selected counts and prior pair preservation.
All 60 damaged-packet controls were rejected. Ordered Node 24 typecheck passed,
followed by 65/65 tests across eight affected update/localization/UI files
(including mounted field-block unit entry), with no failures, skips or TODOs;
all five complete owned files are whitespace-clean. Full current-head CI,
preview/browser and release decisions remain coordinator gates; this selection
does not extend the parent repair's validation claim to those gates.
