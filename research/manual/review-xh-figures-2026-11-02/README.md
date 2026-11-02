# Blind back-translation review, 2 Nov 2026: isiXhosa Manual figure captions

Scope (commit `fb3a8d7`):

| Unit | Strings |
|---|---|
| `content/manual/figures.json`, `caption.xh` (all 95 figures) | 95 |
| `lib/locales/xh-inline/g49-ui-gaps-2.ts` (site-survey picker, funders checkbox, "isiXhosa draft.") | 6 |
| `lib/manual.ts` `FIGURE_CREDIT_XH` (the AI illustration credit) | 1 |

**The reviewer is a model, not a fluent isiXhosa speaker.** "ok" means no meaning error was found, not that the wording is
natural or in the Eastern Cape farming register. This review does not replace the fluent-speaker pass.

## Method
A script extracted only the isiXhosa captions (row number and text, no id, no English) to a scratch file. An English
back-translation was written for every row, then the English was joined and each row got ok / minor / repair. A script checked
that every number matches the English before and after (no mismatch). Latin names (only `Leonotis leonurus`, caption 37)
are unchanged. Caveat on blindness: the English of caption 1 and, for the six UI drafts and the credit line, the English
keys were visible in git output before the back-translations were written, so those 8 rows are not fully blind.

## Result
| Verdict | Count |
|---|---|
| ok | 89 |
| minor (left as drafted) | 8 |
| repair (applied) | 5 |

`review.csv` has one row per string: figure_id, english, before, back_translation, verdict, after, note.

## Repairs
- **06-slope-analysis**: *kwithambeka eliphezulu elisleyo* read as "the upper slope that slopes"; "steep" was lost. Now
  *elithe nkqo*, the wording the chapters use for steep ground.
- **05-pig-tractor**: *iihagu ziyadlala* ("the pigs play") for "pigs graze". Now *iihagu ziyadla ingca*.
- **05-hive-on-tyres**: *uphezu komhlaba ofumileyo* ("on top of damp ground") reversed "off the damp ground". Now
  *ukude nomhlaba ofumileyo* (away from the damp ground).
- **06-wild-dagga**: *esiqhobosha umoya* ("that pierces the wind") for "windbreak shrub". Now *esithintela umoya* (blocks the
  wind; glossary *isithintelo somoya*). *Leonotis leonurus* untouched.
- **g49 site-survey card**: *umklamo* for "design" is not the app's word (*uyilo*); now *phambi koyilo oluneenkcukacha*.

Checked and kept: TLB caption keeps both safety clauses (people well away from a working machine, sloped sides); the biogas
caption keeps "can explode" and "keep flames away from leaks, let fresh air in"; the greywater drum keeps "stored greywater goes
bad"; the solar cooker keeps the hot-pot glove warning; the owl box keeps "at least 3 m" and 1 000; the planting hole keeps
"two to three times"; compass keeps 20 to 28 degrees west; the keyhole/swale/berm terms are the glossary ones.

## Minor, left as drafted
Hedge as "tree fence"; "pests" as plain "insects" (Muscovy caption); "seasonal" as *wexesha elithile*; "organic matter" as
*izinto eziphilayo* (living things); greywater "same day" as *ngosuku olunye*; "rodents" as mice; "thick gloves" as
*ezityebileyo*; the credit "for this manual" as *kule ncwadi* (in this book). A fluent reviewer should settle these.

## Tests
`node --import ./tests/register-alias.mjs --test tests/manual.test.ts tests/xh-inline.test.ts`: 32 pass, 0 fail.
`figures.json` parses. `git diff --check` is clean. Not committed or pushed; PROGRESS.md untouched.
