# isiXhosa app dictionary — machine draft (23 October 2026)

Rory asked for the whole app in isiXhosa. This record covers the UI dictionary
(`lib/locales/xh.ts`) and the money-book drafts (`docs/translation-reviews/records-finance-2026-10-06/draft-xh.json`).

**Status of every string: unreviewed machine draft.** No fluent isiXhosa speaker or local farming
reviewer has checked any of it. The screen says so: `components/LanguageDraftNote.tsx` (farmer,
records, prices, login, student pages) and an isiXhosa line under the language grid in Settings
(`components/ThemePanel.tsx`), the same pattern Xitsonga uses.

## What was done
- **Coverage:** 693 → 2,514 of 2,556 English keys rendered in isiXhosa (98.4%). The remaining keys
  are codes and names that are the same in both languages (GPS, pH, Köppen, ERA5, ImbewuField, 3D …).
- **New keys:** 1,863, drafted in 8 batches against one shared glossary (`DRAFTING-BRIEF.md`). Each
  batch was checked by script for identical `{placeholders}` and line breaks.
- **Existing keys:** a separate reviewer read all 693 shipped strings for meaning errors and fixed 185.
  Examples: `popiaShareDesc` said programmes "produce damage" (umonakalo) instead of tracking impact;
  `challengeLabour` said "enough labour" (negation flipped); `roofMainHint` said the opposite of the
  English; `insightLowSoilCarbon` promised doubled yields; contour toggles said "boundaries" (imida);
  frost strings used *ikhephu* (snow) instead of *iqabaka*.
- **Kept English on purpose:** the six `soilImprovement*` advice sentences (DataPanel shows the
  English source for every language except the paired isiZulu drafts) and `langPartialTag` /
  `langPartialActiveNote` (isiXhosa is no longer partial).
- **Money book:** 544 inventory strings drafted, then a separate model reviewer wrote a blind
  back-translation before comparing with the English (`../records-finance-2026-10-06/reviews/xh-*.json`):
  535 ok, 9 repair. Wording/minor repairs and one very short meaning fix (R167 seedlings, not heifers)
  ship; the whole-sentence meaning repair (I129) is held, so it shows English; R045 is retired like the
  other languages. 543 strings reach the screen through `lib/records-regional-drafts.ts`.
- **Draft-notice strings** that named isiZulu (`*ZuluDraftNotice`, `languageDraftNotice*`) are worded
  for isiXhosa in this locale.

## Honest limits
- Drafters and reviewer are models. "Checked" means no meaning error was found, not that the wording
  is natural, nor that it is the Eastern Cape farming register.
- Coined terms that need a fluent speaker first: *Isitudiyo soyilo* (Design studio), *Amandla omhlaba*
  (sectors), *imigca yokuphakama* (contours), *ingca yokugquma* (mulch), *umxhasi-mali* (funder),
  the glossy-design style names (*Imephu yoyilo*, *Ipolishwe yi-AI*, *Ukugqitywa okupheleleyo*),
  tree names in `biomeSpecies*`, and Köppen climate names in `reportKoppenDesc*`.
- Placeholders whose noun class changes at runtime (`{crop}`, `{site}`, `{season}`, `{direction}`,
  `{d}` with 1) are worded to avoid concords, so some lines read stiffly.
- Short forms: `surveyMonth*` use loan abbreviations (Jan, Feb, Mat …); the Home date uses the everyday
  loan month names (Janyuwari …), not the traditional ones (EyoMqungu …).

## Not covered yet (the rest of "the whole app")
- About 400 inline `lang === 'zu' ? isiZulu : English` branches in components (survey, atlas, MEL,
  contact inbox, exchange, report view …) still show English for isiXhosa.
- Studies (course decks, narration, assignments) and the Permaculture Manual have no isiXhosa yet.
- `toLocaleDateString(language === 'zu' ? 'zu-ZA' : 'en-ZA')` date lines outside Home.
