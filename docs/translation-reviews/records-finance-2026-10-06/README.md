# Participant finance interface — regional drafts (6 October 2026)

Scope: the money book at `/records` (`/finances` redirects there) — Picked · Sold · Spent · Charts
frame, the manual sale and cost forms, receipt photo attach/read/view, ledger rows, delete/edit
controls, validation, save/queued-save messages, recovery links, and the crop/product picker.
Languages: Sesotho (`st`), Tshivenda (`ve`), provisional standard written Xitsonga (`ts`), plus
audit and fallback fills for isiZulu (`zu`). English is the source authority and is unchanged.

**Status of every shipped string: unreviewed machine draft.** Nothing here has been checked by a
fluent speaker or a local farming reviewer. Xitsonga is provisional standard written Xitsonga;
no Shangani comprehension is claimed. A visible notice says so on the screen.

## How the drafts reach the screen

`lib/records-regional-drafts.ts` looks a draft up by the **exact English** the screen shows
(`lib/records-regional-drafts-data.ts`, generated from `draft-<lang>.json` here by
`scripts/build-records-drafts.mjs`). Edit the English and its draft stops matching, so the screen
falls back to the new English. Existing wording always wins: the isiZulu inline wording and the
st/ve/ts values already in `lib/locales/*` are never replaced. Instructions that a farmer may act
on (money, saved records, recovery) show the English source first and the draft after it. A draft
whose `{placeholders}` differ from the English is refused, so no rand/kg figure can be lost.

## Method

1. **Inventory** (`inventory.json`): 270 English strings (batch 1) plus 14 more (batch 2: crop/product picker and payment-method words), rebuilt from the
   current source because the original two candidate packets were not available in the cloud
   container. The Charts-tab components are not in it (see "Not covered").
2. **Drafting**: one machine drafting lane per language (`DRAFTING-BRIEF.md`).
3. **Independent review** (`REVIEW-BRIEF.md`, `reviews/`): a separate reviewer per language wrote a
   blind back-translation from the draft alone, then compared it with the English. Verdicts:
   ok / repair / hold. Phase C reviewed wording **already shipped** in `lib/locales` for meaning
   errors only.
4. **Integration** (`draft-<lang>.json`, `summary.json`): `ok` ships; a reviewer repair ships when it
   is a wording/minor fix or a very short meaning fix; a meaning-level repair of a whole sentence
   was **not** re-reviewed and therefore shows English; every hold shows English. Items listed with
   `status: held` are the remaining dependencies for a fluent speaker.

Honest limits: drafters and reviewers are models. "ok" means a reviewer found no meaning error, not
that the wording is natural. The phase-A usage notes were English descriptions, so the blind pass
was not perfectly blind. Reviewer repairs were not independently re-reviewed.

## Second-session backcheck (read-only, 6 October)

A separate read-only session re-checked the shipped rows. Mechanical checks were clean (placeholders,
negations, no cross-language copies). It raised meaning-level risks, and 31 accepted rows were moved to
`held` (English shown) with the reason in each row's `decision`: Tshivenda "amount" rendered with the
word for price; income/balance/margin wordings that blur income with profit or lose "gross"; Sesotho
"gross margin" reading as total profit; Xitsonga "xitirhisiwa" (device/tool) on the device-only photo
warnings; "of the lender" instead of "for a lender"; the Delete and Remove-photo verb collision;
"Category" words that also mean tribe/clan; and a few unverified words. The CSV export also keeps
English headings and columns for Sesotho, Tshivenda and Xitsonga, because that file can leave the app.
Not acted on (flagged for a speaker): Xitsonga "muholo" for income (existing dictionary term),
"lisiti"/"risiti" one letter apart, Xitsonga "ndhawu yo kurisa" for growing area, past-tense Sold/Spent
headings becoming nouns in Tshivenda and Xitsonga.

## Changes to existing wording (specific demonstrated errors only)

- `zu` `myRecordsSaveSale` "Londoloza ukudayisa" dropped "& invoice" while the button creates and opens
  an invoice. Now "Londoloza ukudayisa ne-invoyisi".
- `st` `myRecordsSaveSale` "Boloka thekiso" dropped "& invoice". Now "Boloka thekiso le invoyese".

Other audit findings about existing isiZulu wording (`audit-zu-existing-wording.json`) were **not**
applied because they rest on a machine grammar judgement; they are flagged for a speaker, e.g.
`Okuvunyiwe`/`kuvunyiwe` for picked/harvested, `Inani` used for quantity, amount and price,
`Isivande sezithelo` for orchard, dead dictionary keys `myRecordsProdValidationError` and
`myRecordsKgSold*`.

## Product observation for a human (English not changed)

The English "retry this cost" (`lib/expense-receipts.ts`, "cost was saved, but its receipt could not
be confirmed") can be read as re-entering the cost, which would duplicate it. Both the Tshivenda and
isiZulu reviewers flagged this. The English source is canonical here, so it is unchanged and
translated faithfully.

## Not covered (remaining dependencies)

- Charts-tab components: `CashflowChart`, `FinanceGraphs`, `ComingUpHarvests`,
  `HarvestReconciliation`, `AreaReturnCards` (isiZulu-only inline text; st/ve/ts still English).
  They overlap crop planning and plan-vs-actual, which are out of this scope.
- Dates print with English month abbreviations (`en-ZA`), and user-entered text is never translated.
- `/invoice` document and tool wording, global navigation and Lima chat.
- Held strings: see `status: "held"` rows in each `draft-<lang>.json` (units such as eggs, jars,
  crates and bunches, fuel, the lender disclaimer, the gross-margin line, and Tshivenda "Export").
