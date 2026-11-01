# Blind back-translation review, 1 Nov 2026 (batch c): UI gaps shard

Scope: the isiXhosa machine drafts for the English gaps found in the 1 Nov browser check (Farm memory journal controls,
programme record cards on /funder and /ngo, the two /samples/farm photo captions, the site-report contents heading).

| Unit | Strings |
|---|---|
| `lib/locales/xh-inline/g48-ui-gaps.ts` | 84 |

**The reviewer is a model, not a fluent isiXhosa speaker.** "ok" means no meaning error was found, not that the wording
is natural or in the Eastern Cape farming register. This review does not replace the fluent-speaker pass in `../README.md`.

## Method
Same as `../blind-review-2026-11-01/`. A script extracted only the isiXhosa values (row number and text, no English key)
to a scratch file. An English back-translation was written for every row before the keys were opened. The two were then
joined and each row got a verdict. A script checked that `{placeholders}`, digits, `R/m²`, `·` and `…` match the English
before and after.

## Result
| Verdict | Count |
|---|---|
| ok | 76 |
| minor (left as drafted) | 6 |
| repair (applied in the shard) | 2 |

`review.csv` has one row per string: file, english, xhosa_before, back_translation, verdict, xhosa_after, note.

## Repairs
- **Crop-plan task draft note** ("Draft from your crop plan. Check what happened before saving. ..."): it opened with
  *Uyilo*, which is the app's word for "design" (Saved design = *Uyilo olugciniweyo*), so a farmer read it as a design from
  the crop plan and lost that it is a draft to be checked. Now *Idrafti esuka kwisicwangciso sakho sezityalo.* The caveat
  that it does not record a harvest quantity or mark the task complete was intact and is unchanged.
- **`{n} enrolled farmers are withheld from the portfolio for consent.`**: *ngenxa yemvume* is "because of consent", which
  does not say consent is missing. Now *ngenxa yokungabikho kwemvume* (because consent is absent).

Checked and kept: the photo caveat (*Iifoto zodwa azilinganisi ukukhula okanye ziqinisekise isivuno*) keeps its negation over
both verbs; "does not establish continued participation" (*akuqinisekisi ukuqhubeka kokuthatha inxaxheba*), "coverage is not
total project reach" and "those ratios are not calculated here" (*azibaliswa apha*) all keep their negation. *-bala* in
"physical area counted once" means count, correctly. Offline storage warning ("These notes stay on this device. Keep a copy
before clearing browser storage ...") is intact.

## Minor, left as drafted
*Ibhedi okanye isiza* (bed or site) for "bed or plot"; *ziqinisekise* (confirm) for "prove"; *indawo* (place) for measured
"area" in two record-card labels; *iqela lonke* (whole group) for "Portfolio"; *ezidibeneyo* (combined) for "cumulative".
Plural and singular keys that share one draft (`Keep a copy of this/these {n} entry/entries`, `{n} entry/entries`) work
because the count is in the string. A fluent reviewer should settle these.

## Tests
No test expectation changed. `node --import ./tests/register-alias.mjs --test tests/xh-inline.test.ts
tests/farm-memory-copy.test.ts tests/farm-memory-ui.test.ts tests/programme-evidence.test.ts`: 42 pass, 0 fail.
`git diff --check` is clean.
