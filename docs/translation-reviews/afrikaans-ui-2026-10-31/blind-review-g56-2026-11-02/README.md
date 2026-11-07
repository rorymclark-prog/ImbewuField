# Blind back-translation review, 2 Nov 2026: Design Studio leftovers (g56)

Follows the method of `../blind-review-g54-g55-2026-11-02/`. Scope: every value in `lib/locales/af-inline/g56-design-leftovers.ts`
(101 rows): Layers panel button templates, tools group names, sector notes with figures, and the one-line palette tips (water,
beds, greywater, earthworks, fruit trees, structures).

## Method
1. A script extracted the Afrikaans values alone (number and Afrikaans, no English key) to a scratch file.
2. An English back-translation was written for all 101 rows from that file and saved before any English key was shown.
3. The English keys were then printed and compared row by row. A join script checked that `{placeholders}` and digits match across
   English, Afrikaans and back-translation (0 mismatches), and that only repaired rows changed.

## How blind it was (honest record)
Partly blind. Before the extraction the reviewer had read the first ~1,500 characters of the shard and its last 30 lines
(about 11 rows at the top and 30 at the bottom), which show English keys beside the Afrikaans, and the task brief named the
safety and siting topics in English (greywater, tank weight, 5 m from foundations, siting survey, fruit tree in the dip,
sterile vetiver, guava, female trees, stock-proof hedge). The back-translations for those rows could therefore be coloured by
the English. The middle rows were written from the Afrikaans alone. The reviewer is a model, not a fluent speaker; "ok" means no
meaning error was found, and these remain unreviewed machine drafts.

## Result: 94 ok, 6 minor, 1 repair
`review.csv` lists all 101 rows: row, english, afrikaans_before, back_translation, verdict, afrikaans_after, note.

## Repair
| English | Old back-translation | New draft |
|---|---|---|
| Downhill of water sources, with shade and a wallow; strong odour control needed near house. | ... with shade and a drinking place ... (false friend: "suiplek" is where animals drink, so the pig wallow was lost) | Afdraand van waterbronne, met skaduwee en 'n modderbad om in te wentel; sterk reukbeheer is nodig naby die huis. |

## Checked and kept (directions, figures, caveats)
- Greywater: "Waar gryswater die huis VERLAAT", "Moet nooit die toilet aftap nie (dit is swartwater)" and "plantveilige seep" all intact.
- Siting: survey before drilling and avoid septic/kraal runoff; "5 m weg van fondamente"; "Moet nooit 'n vrugteboom plant wat in die
  laagte staan nie" (never); full tank "~2.5 t"; 3 m of a downpipe; 4, 5, 8 and 12 m clearances; 1.2 m bed, 30-40 cm fill.
- Vetiver: sterile, non-seeding cultivar, "nie 'n plaaslike familielid wat saad maak nie", twice. Guava: invasive in warm coastal areas.
  Female-only fruiting for the two trees that carry it.
- Directions: on the contour (op die kontoer), opening uphill (opdraand), berm on the downhill side (afdraandkant), shelf across
  steep ground (dwarsoor), ridge north-south, entrance east, rows/panels facing north, downwind phrased as "die kant waarheen die wind
  van die huis af waai" (the form accepted in the g54/g55 review).
- Known xh trap: "stock-proof hedge" is "vee-bestande eetbare heining" (livestock-resistant), not "protects livestock"; "as often as"
  is "Net so dikwels ... as", not "always".
- Placeholders {name} {n} {total} {deg} {m} {from} {date}, species names (Harpephyllum caffrum, Pappea capensis), umgwenya, JoJo, DWS,
  SA: all untouched.

## Minor, left as drafted
Rows 17 (Swales as "Kontoerslote"), 39 (awkward "wat in die laagte staan", prohibition intact), 42 ("when you need it to" shortened),
46 ("Keer die vlak"), 74 (vee-bestande wording, caveats intact), 87 (grazing hedge for browse hedge). See the notes in `review.csv`.

## Tests
`npx tsc --noEmit -p .` clean. `node --import ./tests/register-alias.mjs --test tests/af-inline.test.ts tests/xh-inline.test.ts tests/design-studio-i18n.test.ts`: 90 pass, 0 fail. No test pinned the repaired string.
