# Blind back-translation review, 2 Nov 2026 (batch b): interactive guidance and Design Studio lesson shards

Scope: the isiXhosa machine drafts added after the g50/g51 review.

| Unit | Strings |
|---|---|
| `lib/locales/xh-inline/g52-interactive.ts` (Design Studio task cards and map hints, field-block layout form, local market notes, annual food and product plan) | 166 |
| `lib/locales/xh-inline/g53-design-tabs.ts` (desktop step tabs, sample-farm item labels, "Why this step?" lessons) | 37 |

**The reviewer is a model, not a fluent isiXhosa speaker.** "ok" means no meaning error was found, not that the wording
is natural or in the Eastern Cape farming register. This review does not replace the fluent-speaker pass in `../README.md`.

## Method
Same as `../blind-review-2026-11-01/`. A script extracted only the isiXhosa values (row number and text, no English key)
and an English back-translation was written for every row before the keys were opened. The two were then joined, and each
row got a verdict. A script also checked that `{placeholders}` and figures match the English before and after, and that
exactly the rows marked repair changed in the shards.

Caveat on blindness: g52 was reviewed fully blind. For g53 the isiXhosa and English were shown together by the first
file listing before the back-translations were written, so g53 is a weaker blind check. The g53 rows were re-read from the
isiXhosa alone, but the reviewer had already seen the English.

## Result
| Verdict | g52 | g53 | Total |
|---|---|---|---|
| ok | 150 | 34 | 184 |
| minor (left as drafted) | 10 | 2 | 12 |
| repair (applied in the shard) | 6 | 1 | 7 |

`review.csv` has one row per string: file, row, english, xhosa_before, back_translation, verdict, xhosa_after, note.

## Repairs
- **Pollinator strips** (3 rows: "Pollinator Strip", the optional-support-planting hint, "Pollinators along orchard edges"):
  *izinambuzane ezixhaphazayo* reads as exploiting or harassing insects, which a farmer would take for pests. The locale
  words pollination as *ukuthwalwa komungu wentyatyambo* (g24), so these now say *izinambuzane ezithwala umungu wentyatyambo*
  (insects that carry pollen).
- **Swale line "level end to end"**: *uthe tye* ("straight") lost "level"; a swale is dug level on the contour. Now
  *ngokulinganayo*, from the same root as *olinganayo* (level ground) in the sibling rows.
- **Animal housing "downwind of the house"** (2 rows): *ngaphaya komoya* ("beyond the wind") can be read as upwind. Now
  *ngakwicala lapho umoya uya khona ukusuka endlini* (on the side the wind goes to, from the house).
- **"A bare berm is the first thing a big rain takes away"** (g53): a stray unreadable word, *itshathu*, followed
  *engenanto*. Now *engenazityalo* (without plants). The instruction to plant the bank was intact.

## Checked and kept (direction, figures and caveats)
- North, south, east and west all survive: sun in the NORTH (rows 41-43), veg beds with tall trees to the SOUTH or WEST
  (g52 row 89, g53 lesson), beehive facing EAST, `0°` runs east-west, a tree to the NORTH of a bed takes its light.
- Across and along: swales and beds ACROSS the water flow (*ngaphesheya*), "not down it" (*kungekhona ukuhla nalo*), berm
  on the downhill lip and "never above" the swale, terraces on steep ground.
- Figures: 3 m from the downpipe, 20 steps, 500 beds, 10 mm of rain on 100 m² gives about 1,000 litres, mango 10 m wide,
  2500 L tank. All match.
- Caveats: "planning windows, not recorded harvests, measured stock or proof the household has enough food", "an empty plan
  is not evidence of a food gap", "housing does not establish animal numbers", "a tap, tank or irrigation pipe does not tell us
  whether water lasts", "a note is not a confirmed sale ... check before spending money" keep their negation. The
  regional fire-wind and "confirm locally" caveats are intact. No `-bala` (count) misuse appears.

## Minor, left as drafted (12)
See the notes in `review.csv`. For a fluent reviewer: *Uzungulo lwamayeza* ("cycle", not "spiral") for Herb Spiral; *itafile
yeempandla* for nursery table (an unattested word, same draft as `g43-site-report-document.ts` "Nursery Table"); *Icala* for
the field angle; *umso* ("tomorrow") for "morning" in the walk-through lesson; *amayeza* (medicines) for culinary herbs;
"confirmed sale" worded as "confirmed way of selling".

## Tests
`node --import ./tests/register-alias.mjs --test tests/xh-inline.test.ts tests/farm-memory-task-controls.test.ts tests/design-chrome.test.ts tests/design-studio-i18n.test.ts tests/records-regional-drafts.test.ts`: results in the commit message report.
