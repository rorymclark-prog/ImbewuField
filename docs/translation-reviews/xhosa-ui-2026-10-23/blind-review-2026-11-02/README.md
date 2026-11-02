# Blind back-translation review, 2 Nov 2026: scale exercise and prepared-example shards

Scope: the newest small isiXhosa machine drafts (g49 was reviewed separately).

| Unit | Strings |
|---|---|
| `lib/locales/xh-inline/g50-ui-gaps-3.ts` (Design scale exercise notice and diagram text) | 4 |
| `lib/locales/xh-inline/g51-prepared-example.ts` (prepared-example scope note, AI-report language notice) | 2 |

**The reviewer is a model, not a fluent isiXhosa speaker.** "ok" means no meaning error was found, not that the wording
is natural or in the Eastern Cape farming register. This review does not replace the fluent-speaker pass in `../README.md`.

## Method
Same as `../blind-review-2026-11-01/`. A script extracted only the isiXhosa values (row number and text, no English key)
to a scratch file. An English back-translation was written for every row before the keys were opened. The two were then
joined and each row got a verdict. The join script also checked that `{placeholders}` and digits match the English before
and after, and that the shard still holds exactly the text recorded.

## Result
| Verdict | Count |
|---|---|
| ok | 2 |
| minor (left as drafted) | 3 |
| repair (applied in the shard) | 1 |

`review.csv` has one row per string: file, english, xhosa_before, back_translation, verdict, xhosa_after, note.

## Repair
- **"No gap"**: *Akukho msantsi* became *Akukho msantsa*. The sibling drafts spell gap *umsantsa* (*Umsantsa onikeziweyo*,
  *Umsantsa ocacileyo*), so *msantsi* was a different, unattested form. The meaning ("no gap") was already readable.

## Checked and kept (caveats stay strong)
- "They are not recommended bed or access widths": *Ayiyiyo ububanzi obucetyiswayo bebhedi okanye bendlela yokungena*
  keeps the negation over both bed and access widths. The noun-class agreement of *ayiyiyo* is awkward.
- "MODEL ONLY · not site measurements": *IMODELI KUPHELA · ayiyiyo imilinganiselo yendawo* keeps both the "only" and the
  negation.
- Prepared-example note: "not a comprehensive site assessment, design report or evidence of progress. No new AI analysis."
  keeps all three negations plus *Akukho hlalutyo lutsha lwe-AI*. *Uyilo* (design) is used correctly in *ingxelo yoyilo*
  (design report). *Olubanzi* is "broad" for "comprehensive" and *olungiselelweyo* agrees with the wrong noun class; both
  are understandable, and the text is pinned in `tests/report-summary-localization.test.ts`, so it was not changed.
- AI-report notice: *Ayikahlolwa ngumntu othetha ulwimi kakuhle; jonga amanani ngokuthelekisa nomthombo wesiNgesi* keeps
  "has not been reviewed by a fluent speaker; check figures against the English source". `{language}` intact. No *-bala*
  (count) misuse appears in these shards.

## Minor, left as drafted
*Kuphando lomhlaba* (research/inquiry of the land) for "ground survey"; the *ayiyiyo* concord in two rows; *olubanzi* for
"comprehensive". A fluent reviewer should settle these.

## Tests
`node --import ./tests/register-alias.mjs --test tests/xh-inline.test.ts tests/report-summary-localization.test.ts`: 33 pass, 0 fail. No test expectation changed. `git diff --check` is clean.
