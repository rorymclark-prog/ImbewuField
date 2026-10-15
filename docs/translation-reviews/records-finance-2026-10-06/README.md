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

## Round 2 (10 October): the Charts tab

Batch 3 adds the five Charts-tab components (`CashflowChart`, `FinanceGraphs`, `ComingUpHarvests`,
`HarvestReconciliation`, `AreaReturnCards`) and `IsiZuluDraftSource`: 119 more English templates (figures and
names are `{placeholders}`, so a draft is bound to the sentence, not to one amount), 12 of them isiZulu
fallback fills. Same method: per-language drafting lane, independent blind back-translation review, the same
integration rules, plus an automatic hold for any draft that contains a word already rejected in an earlier
backcheck (Tshivenda "Mbuelo"/"Masheleni o salaho"; Xitsonga "xitirhisiwa", "Vatirhi", "Rixaka", "Muxaka",
"swiharhi"). Drafters were told to hold finance concepts they were unsure of; these show English: running
total, cash surplus/shortfall, benchmark, harvest reconciliation, net profit and overheads, and "returns per
growing area" in Sesotho and Tshivenda (it can read as profit). Month names and the month labels in the charts
stay English on purpose (a machine-drafted month name was already caught wrong once). Crop names are
catalogue data and are never translated.

Layout fix found by looking at the phone: the drafted "Harvested X · Sold Y" line was cut off at 390px, so the
harvest-reconciliation rows now wrap.

## Round 3 (12 October): the Invoice page

Batch 4 adds the `/invoice` screen (`app/invoice/page.tsx`): 159 more English strings, 144 for Sesotho, Tshivenda
and Xitsonga and 18 isiZulu fallback fills (the Invoice page already carried existing isiZulu wording for the rest).
Same method: one drafting lane per language, an independent blind back-translation review, and the same integration
rules (meaning-level repairs of whole sentences and every hold show English; automatic hold for words rejected earlier).
Result: Sesotho 131 accepted / 3 held, Tshivenda 123 / 11, Xitsonga 118 / 16, isiZulu 18 / 0. Held rows are the ones
reviewers could not confirm: price-guide confidence notes, "Sourced guide", VAT / tax no., the eggs/crates/bunches
words, "types" (Customer types, Invoice type) and "Remove item" for Tshivenda and Xitsonga, "Buyer address & contact"
and the two-devices sentence for Xitsonga.

What the screen does now: the page's `ui()` helper reads the same English-keyed lookup. A sentence a farmer acts on
(payment status, sale linking, sync retry, delete) keeps the English beside the draft. The price-guide sentences
became `{price}` / `{date}` templates so a figure cannot be lost. A visible notice says the drafts are unreviewed and
that **the invoice a buyer receives stays English**: the printed page, the PDF and the document preview are not
translated for Sesotho, Tshivenda or Xitsonga (a buyer files it and pays from it). Dates keep English month names.

Changes to existing behaviour (each was a demonstrated defect):
- isiZulu: a paired instruction with no isiZulu wording printed its English twice ("English — English"); it now shows
  the English once. Seven isiZulu sentences that were English-only now carry machine-drafted fills that a second machine reviewed.
- Layout, found at 390px: the long Tshivenda word for "each" pushed the line-item price box past the card edge. The
  price box now takes its own line only when that word is long; English, isiZulu, Sesotho and Xitsonga keep one row.

Deliberately not translated: the ten buyer-type names ("Neighbour", "School", "Church"...). They are the *value* of the
customer list and print as the buyer's name on the invoice, so translating the label would put a different word on screen
than on the document. A speaker should decide whether to show both.

## Round 4 (12 October): retrying held rows

Rows an earlier pass held (drafter hold, reviewer hold, meaning-level repair, or the second-session backcheck) were
given a second try where a safe wording might exist: 6 Sesotho, 27 Tshivenda, 36 Xitsonga and 2 isiZulu rows. Rows that
turn on a finance concept (gross margin, running total, reconcile, VAT...) or a unit word (eggs, jars, crates...) were
not retried: a machine cannot confirm those words. Each retry drafter was told why the row was held and which words were
already rejected, and was allowed to hold again; a second, blind reviewer then back-translated every new draft.
Result: Sesotho 5 of 6 now accepted, Tshivenda 7 of 27, Xitsonga 20 of 36, isiZulu 1 of 2. The rest stay held and show
English (Tshivenda "amount" rows, "lender" for Tshivenda, flat/profit/staple/category/type/cash/returns; Xitsonga
"Remove item", category/type, cash, profit; isiZulu "Mobile"). Held rows now carry a `retry` note with the round 4 reason.
One integrator change: the isiZulu orchard sentence uses the records page's own "Ingadi yezihlahla", not the drafter's
"Ingadi yezithelo". Note for a speaker: the existing isiZulu keys `recordsOrchardIn/Out/OutNote` say "Isivande sezithelo"
(isivande is a pumpkin dish), which the page does not use for the same idea; that existing wording was not changed.
Still machine drafts and machine review only; Xitsonga "ntirho" (labour), "mubolekisi" (lender) and the payment words
"Cash" / "Mobile" in Sesotho are the weakest and need a speaker. The Xitsonga device-only photo warning now says
"this phone only" instead of the ambiguous "xitirhisiwa".

## Round 5 (14 October): month names

The money book, its charts, the harvest list and the saved-invoice list printed English month words whatever the
language. `lib/records-months.ts` now names the month in Sesotho, Tshivenda, Xitsonga and isiZulu: record dates
(`05 Phu 2026`), the chart month axis, the selected-month readout, "Your records start in {month}", the clipped-month
note and "picking runs into {month}". The day number, the year, the order and every stored date are unchanged, and
English (or any other language) prints exactly what it printed before (`tests/records-months.test.ts` pins that).

Sources: isiZulu reuses the month names the app already carries (`components/ComingUpHarvests.tsx`), with 3-letter
truncations for the axis. Sesotho, Tshivenda and Xitsonga are **unreviewed machine drafts**: two independent drafts per
language agreed on all 36 long names, and a blind reviewer shown the names shuffled mapped every one back to the right
month with no low-confidence answers (`reviews/months/`). Short forms (3 to 4 letters, all different) were chosen to fit
a 390px chart axis and are not an established convention. A machine cannot settle spelling or regional variants, so the
sheet `speaker-sheets/speaker-review-month-names.csv` lists them: Sesotho Mmesa/Mmese, Leotshe/Lwetse,
Pundungwane/Pudungwana, Pherekgong/Phesekgong; Tshivenda Fulwi/Fulwana (and Fulwi reading as winter); Xitsonga's
January to April block, which some sources shift by one month. A wrong month name would mislead, so a month with no
name in a language falls back to English for that month alone.

Not changed on purpose: the printed and PDF invoice and the CSV export (English dates), the design-sharing date in
"My designs", isiZulu sentences that already carry an English month inside a Zulu phrase ("ku-Feb 2024"), and crop names.

## Speaker review sheets

`speaker-sheets/` holds one CSV per language (all strings, held rows first) for a fluent speaker to mark OK / CHANGE / BAD. See its README.

## Not covered (remaining dependencies)

- Crop names (catalogue data), the Design Studio and
  production-plan page names, and every held row listed in `draft-<lang>.json`.
- The printed invoice, PDF and CSV print English dates; user-entered text is never translated.
- The printed and PDF invoice (English on purpose), the buyer-type names, global navigation and Lima chat.
- Held strings: see `status: "held"` rows in each `draft-<lang>.json` (units such as eggs, jars,
  crates and bunches, fuel, the lender disclaimer and the gross-margin line; Round 4 retried the rest).
