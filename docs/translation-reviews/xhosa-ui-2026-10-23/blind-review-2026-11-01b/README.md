# Blind back-translation review, 1 Nov 2026 (second batch)

Scope: the isiXhosa machine drafts for the MEL evidence report, the facilitator and staff reports, and the field report.

| Unit | Strings |
|---|---|
| `lib/locales/xh-inline/g45-mel-report.ts` | 188 |
| `lib/locales/xh-inline/g46-staff-reports.ts` | 56 |
| `lib/locales/xh-inline/g47-field-report.ts` | 109 |
| **Total** | **353** |

**The reviewer is a model, not a fluent isiXhosa speaker.** "ok" means no meaning error was found, not that
the wording is natural or in the Eastern Cape farming register. This review does not replace the
fluent-speaker pass in `../README.md`.

## Method
Same as `../blind-review-2026-11-01/`. A script extracted only the isiXhosa values to a scratch file. The
reviewer wrote an English back-translation of each before opening the English keys, then joined the two and
gave each string a verdict. These reports are full of evidence-limit caveats ("does not establish", "must not
be added", "not a reconstruction"), so each was checked for negation, strength and scope: every one of them is
still negated and as cautious as the English. Also checked: observed against self-reported, unique people against
visits or session places, money against quantity, privacy and sharing warnings, and every placeholder and digit.

## Result
| Verdict | Count |
|---|---|
| ok | 337 |
| minor (wording nit, left as drafted) | 12 |
| repair (applied in the shards) | 4 |
| hold | 0 |

Every repair keeps its key, `{placeholders}`, digits, symbols and `|`. `review.csv` has one row per string: file,
english, xhosa_before, back_translation, verdict, xhosa_after, note.

## Repairs
- **`Indicator / basis`** (column header, g45): *Isalathisi / isiseko* became *Isalathisi / uhlobo lokulinganisa*. The English "basis" means cumulative, snapshot or period. *Isiseko* means baseline in these tables, so the header read "Indicator / baseline" beside a Baseline / target column.
- **`Intending to try a practice after training does not establish that it was adopted.`** (g46): *Ukujonga ukuzama inkqubo* ("looking at trying the programme") became *Injongo yokuzama indlela yokwenza* ("the intention to try a way of doing it"). The caveat itself was intact; the subject was misread.
- **`Published and internal records are not interchangeable access scopes.`** (g46): *neziphakathi* ("the ones in the middle") became *nezangaphakathi* (internal), the form used elsewhere.
- **`Check a named practical skill ... Record later application separately before claiming adoption.`** (g47): *phambi kokuthi bekwamkelwe* read as "before it had been adopted", which inverts the caveat. Now *phambi kokuba uthi kwamkelwe* ("before you say it was adopted").

## Minor, left as drafted
See the `minor` rows in `review.csv`. For a fluent reviewer to confirm: *lokondla* (feeding) for "nutrition" and *lokuzimela*
(self-reliance) for "sustainability score" in the no-claim sentence; the loss of "ordinal" in *amanqaku ohlelo*
and *inqaku lokuzithemba lohlelo*; *imeko* for "snapshot"; *ithutyana* for "provisional"; *imfundo* for "qualification";
*uqeqesho* for "coaching"; and "productivity" not carried in *Imveliso nokuvelisa*.

## Checked and kept
- "assigned" (people given an assessment, or participants given to a mentor) is *abachongiweyo* in every place it occurs, so the two uses read alike.
- "due or overdue" is *ezimele zenziwe okanye ezidlulelwe lixesha* and reads correctly in all three places it appears.
- "Present / registered" and "registered session places" are consistently session places, not unique learners, and the unique-learner lines name the participant IDs.
- The sample-records banners say the evidence is invented and not real results.
