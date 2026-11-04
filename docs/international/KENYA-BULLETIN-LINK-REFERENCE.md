# Kenya county bulletin links — bounded pilot milestone

This branch extends country foundation `66e2dffc62a197cdca46b1150bc0b105947a6249`
(draft PR #1167). It is independent of the harvest/nursery unit stack.

## What a grower can review

On `/international`, selecting Kenya and then explicitly choosing Kiambu reveals
a dated official bulletin page, its linked official PDF and KMD's county index.
County choice is a reference lookup, not a saved farm country or approved
agricultural region. Other countries/counties cannot borrow this reference.
Changing country discards the county choice.

The card is a curated reference, not a live forecast feed. It makes no automatic
request, embeds no PDF/image and imports no forecast measurements. External
links open only through user action, without app-supplied farm coordinates.
Dates and retrieval time stay separate from issue/publication times, local
validity instants, freshness and crop-planning approval. Readiness and existing
climate/ecology/planning authorities remain unchanged.

## New evidence, separate from historical research

The old generic Kiambu route linked a July 2025 archive. That did not establish
a county-wide outage or absence of newer posts. On 3 November 2026 the
coordinator independently fetched the dated Kiambu page and its distinct PDF.
Both returned HTTP 200; exact URLs/UTC times/bytes/SHA256 are in
[published response metadata](pilots/kenya-kiambu-dated-bulletin-receipts.json).
Raw HTML/PDF bodies, extracted text, rendered images and personal contacts
remain excluded from publication.

The coordinator rendered and visually inspected the actual PDF's first page.
Its Kiambu headline advertises 3–9 November 2026. The map caption has 09am
boundaries without a stated timezone and a duration label that does not align
with its multi-day range. These are retained limitations, never silently
normalised into UTC validity or a verified-current badge. The rest of the PDF
was not visually reviewed.

Credential-free public HTML/PDF retrieval does not establish an API contract,
automation permission, reuse licence, dataset update cadence, local farming
review or commercial readiness. Those remain unknown. This delivery is an
opt-in official-link reference, not a numerical weather API integration.

## Release gates

New meaningful resolver and mounted selection tests are registered without
dropping existing full-suite file arguments. Coordinator Node24 typecheck, 108/108 checks across ten affected files and
whitespace all passed in order. The initial test-only literal-array typing error
was narrowed without changing assertions or app code. A subsequent run correctly
failed four release-localization checks before the new translations existed;
those checks passed after the exact-source descriptions were added. Both prior
failures remain in private evidence; no assertion was weakened. Current-head
full CI and browser checks remain separate release gates.

AGY native Flash-tier produced twenty AI candidates, five each for isiZulu,
Sesotho, Xitsonga and Tshivenda. Independent source/hash/name/route checks passed
for all twenty and rejected seventeen damaged packets; notes measured143 words.
The descriptions were selected into existing disclosed AI-draft update tables,
with inherited bytes preserved. Original generation packets retain
`runtimeActivation:false`; no human fluency approval or new runtime language
is inferred. Exact source-file restamping is reconciled separately.

An independent read-only review found an import-time test gap: fetch activity
could be reset before assertions. The same UI owner installed guards before real
module imports and checked activity before resetting it. All eight mounted tests
passed, while an isolated mutation of the actual imported card that launched a
caught fetch failed the new guard as intended. The final combined ordered run
then passed typecheck, all108 checks and whitespace again. App bytes stayed
unchanged during that test correction.

This changes the country review screen. Chrome verification is now available
through the connected extension, but this new screen still needs its own hosted
desktop/phone review. The PDF source inspection and another branch's sample
checks do not verify this screen. No production merge/deployment, PLAN_VERSION, species
name, calibrated lesson/quiz, agronomic default or saved geometry is changed.
