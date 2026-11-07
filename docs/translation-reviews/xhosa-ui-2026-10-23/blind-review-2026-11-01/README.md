# Blind back-translation review, 1 Nov 2026

Scope: the isiXhosa machine drafts added on 1 Nov for the site report.

| Unit | Strings |
|---|---|
| `lib/locales/xh-inline/g43-site-report-document.ts` | 390 |
| `lib/locales/xh-inline/g44-report-preparation.ts` | 40 |
| `lib/update-copy-locales/xh.ts` (five harvest-target release notes) | 5 |
| **Total** | **435** |

**The reviewer is a model, not a fluent isiXhosa speaker.** "ok" means no meaning error was found,
not that the wording is natural or in the Eastern Cape farming register. This review does not replace
the fluent-speaker pass in `../README.md`.

## Method
Same as the earlier inline reviews. A script extracted only the isiXhosa values to a scratch file. The
reviewer wrote an English back-translation of each before opening the English keys, then joined the two
and gave each string a verdict. Some back-translations contain honest misreads that the English
later corrected (for example `ulandelelweyo` read as "continuous" when it means "that was traced",
`lithiye` read as "hired" when it means "named"). Where the English settled it, the verdict is ok.

## Result
| Verdict | Count |
|---|---|
| ok | 407 |
| minor (wording nit, left as drafted) | 17 |
| repair (applied in the shard) | 11 |
| hold | 0 |

Every repair keeps its key, `{placeholders}`, digits, units and trailing spaces. `review.csv` has one row per
string: file, english, xhosa_before, back_translation, verdict, xhosa_after, note.

## Repairs
- **Berm** (`Berm / Contour Bank`): the loanword *Ibhamu* is the isiXhosa word for a gun. It is now *Induli yomhlaba / Ibhanki yekhontowa*.
- **Swale cross-section**: the fruit tree is planted "on the mound below it", but the draft said "in the pit (*iqula*) below it". It now says *kwinduli yomhlaba esezantsi kwawo*.
- **"Drawn" read as "counted"**: nine strings used *-bala* (count) where the English says drawn on the map. Other shards use *-zoba* (draw). A line such as "Nothing drawn on the map yet" read as "nothing counted". Now *zotywe*:
  - Growing area drawn (the draft said "specified")
  - How much of the drawn growing area is actually planted?
  - Nothing drawn on the map yet
  - Nothing of the kind drawn or recorded
  - Permaculture zones drawn
  - Rings drawn by the farmer
  - Sum of every shape drawn on the map
  - `{area} m² drawn across {parts}`
  - `{value} (drawn as proposed)`

Checked and kept: the `{items} excluded from this bill` line has no "excluded" in its isiXhosa because
the word is carried by the two `... marked as already on the farm is/are` keys (*ayifakwanga / azifakwanga*). The
two compose correctly in `lib/report-boq.ts`, and the `{count} line(s) carry` keys compose with the unpriced-subtotal
warning in the same way. *Amatyholo* (shrubs) is the app's established word.

## Minor, left as drafted
See the `minor` rows in `review.csv`. For a fluent reviewer to confirm: *umgqomo* (beehive), *iingqayi* for a
three-bin compost bay, *Umba* for the table header "Field", *umsele* standing for both swale and trench bed,
*Uphawu* for the Sign design element, *ikhabhoni eyendalo* for organic carbon, *umjikelezo* against *umjikelo* for perimeter,
*ngento engento* for "costed at zero", and *uyilo olungekahlolwa* (draft) against *idrafti*.

## Outside this shard
- **Money vs quantity:** the Cost & Bill of Quantities table (`lib/report-boq.ts`) uses the keys `Quantity`, `Rate` and `Amount`.
  The isiXhosa for `Amount` is in `g19-crop-production.ts` and is *Ubungakanani*, the same word as `Quantity`. The money column of the
  bill therefore reads as a second quantity column. It should be *Isixa*. It is not in the files this review may edit.
- `Value` is *Ixabiso* (price) in the dictionary; it heads the "Measure | Value | Where it comes from" table. Left as is.
