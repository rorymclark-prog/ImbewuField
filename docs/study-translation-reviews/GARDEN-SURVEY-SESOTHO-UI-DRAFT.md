# Garden Survey shell labels — Sesotho AI draft

**Status:** unreviewed machine draft for the wizard shell only. No fluent Sesotho speaker has
checked this text. Do not treat it as approved. The learner screen shows each candidate beside
its exact English source and displays a bilingual draft notice.

Generated with Agy Gemini 3.8 Flash Low on 26 September 2026. The bounded prompt requested
standard Sesotho for Sesotho-speaking farmers in Free State, South Africa; it prohibited translating
farming instructions, questions, crops, measurements, timing, consent and privacy language. English
sources and generated candidates:

| English source | Sesotho machine draft | Review note |
| --- | --- | --- |
| Garden Survey | Patlisiso ya Tsimu | Agy suggested `Patlisiso ya Jarata`; the screen uses the existing `navGardenSurvey` label in `lib/locales/st.ts` for consistency. |
| Learn | Ithute | |
| Print | Hatisa | |
| Building… | E ntse e aha… | Used while a PDF is being built; confirm naturalness in this UI context. |
| Your garden | Jarata ya hao | Confirm whether this should use the existing route term `tsimu` for consistency. |
| Survey for | Patlisiso ya | An incomplete label followed by a saved place name; confirm the phrase in that construction. |
| No parcel yet | Ha ho setsha ha jwale | Agy chose “setsha” for a land plot/site and flagged register uncertainty. |
| Back | Morao | |
| Continue | Tswela pele | |
| See my plan | Bona moralo wa ka | |

Held in English: the progress counter's `of` (Agy flagged its equivalent as context-dependent in
“1 of 6”), and `Done` on the result screen (it could be read as confirmation that the plan was
saved). These uncertain or completion-related labels are not shipped as Sesotho drafts.

Notice shown on the Sesotho survey screen:

| English source | Sesotho machine draft |
| --- | --- |
| Sesotho UI draft. This notice and the labels below are AI-generated and have not been reviewed by a fluent Sesotho speaker. English is shown beside each draft. All questions and the garden plan remain in English; check them before using this plan. | Moralo wa UI wa Sesotho. Tsebiso ena le mabitso a ka tlase a hlahisitswe ke AI mme ha a so hlahlojwe ke motho ya buang Sesotho ka thello. Senyesemane se bontshitswe pela moralo o mong le o mong. Dipotso tsohle le moralo wa jarete di dula di le ka Senyesemane; di hlahlobe pele o sebedisa moralo ona. |

Gemini noted two terminology uncertainties in the notice: `AI` is retained as a technical acronym,
and `moralo wa jarete` is used for “garden plan” (`serapa` is another possible word for a garden
or plot). Both need fluent-speaker review. Agy also flagged standalone `of` as context-dependent;
it remains English in the progress counter.

## Scope held in English

Only these inert shell labels are wired into the Sesotho view. Survey questions and choices, map
analysis, generated plan copy, crop names, figures, bed dimensions, weeks and tasks remain English.
The Week 5 “Side-dress with compost tea” task remains English. This packet does not translate or
approve any consent, privacy, permission or completion wording.

Before removing the English pairing or draft notice, have a fluent Sesotho speaker review the
candidate table in context, especially the progress counter, plot terminology and notice.
