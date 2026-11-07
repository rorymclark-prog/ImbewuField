# Blind back-translation review, 2 Nov 2026: Design Studio guide, field blocks and lesson drafts (g54, g55)

Follows the method of `../blind-review-2026-11-02/`. Scope: every value in the two newest Afrikaans interactive shards.

| Source | Rows |
|---|---|
| `lib/locales/af-inline/g54-interactive.ts` (palette names, canvas and base-map controls, sector notes, step guide, field blocks panel, survey water and market blocks, annual production overview) | 166 |
| `lib/locales/af-inline/g55-design-tabs.ts` (desktop step tab names, Tray control, gate length, sample-farm item names, the "Why this step?" lesson bodies) | 37 |

## Method
1. A script extracted the Afrikaans values alone (position and Afrikaans, no English key).
2. An English back-translation was written for every row from the Afrikaans.
3. The two were joined and each row got a verdict: ok, minor (understandable, left as is) or repair. The join script also
   checked that `{placeholders}` and digits (thousands grouping normalised) match the English, that repaired rows changed
   and that no other row changed.

Limits: the reviewer is a model, not a fluent speaker, and the English keys sat on the same source lines as the
Afrikaans, so the back-translations were written from the Afrikaans but the blindness is weaker than in the
extracted-script reviews. These drafts remain unreviewed machine drafts; "ok" means no meaning error was found.

## Result: 193 ok, 6 minor, 4 repair
`review.csv` lists all 203 rows with columns file, english, afrikaans_before, back_translation, verdict, afrikaans_after, note.

## Repairs
| English | Old back-translation | New draft |
|---|---|---|
| Downwind and a little downhill; manure feeds the compost. | With the wind down and a little downhill (could be read as "when the wind is low") | Aan die kant waarheen die wind van die huis af waai, en effens afdraand; mis voed die kompos. |
| ... close enough for daily care, downwind of the house. (paired) | ... with the wind away from the house | ... aan die kant waarheen die wind van die huis af waai. |
| Extras — beehive, bench, gate | beehive, bank/bench, gate (false friend: bank) | Ekstras — byekorf, sitbank, hek |
| Beehive facing east ...; benches in the shade. | benches/banks in the shade | ... sitbanke in die skadu. |

## Checked and kept (directions, figures and caveats)
- ACROSS the slope (DWARS) and "not along/down it" for swales, in the step guide (g54) and the lesson (g55): intact.
- Berm "on the downhill side", "directly below each swale, never above it", half-moon "uphill of a tree": intact.
- Sun in the north, trees south or west of beds, beehive facing east, 0° runs east-west: all directions intact.
- Figures: 3 m of a downpipe, 20 steps, 500 beds, 10 mm on 100 m² gives about 1 000 litres (space-grouped), 10 m mango, 2500 L tank.
- Caveats: "planning windows, not recorded harvests ... proof of enough food", "A note is not a confirmed sale. Check ... before
  spending money", "Confirm the regional wind and fire assumptions ... before you build", "confirm the fire approach locally
  before siting a firebreak", "empty plan is not evidence of a food gap": all keep their negations.

## Minor, left as drafted
- "skadubboom" typo (extra b); "bergkant" for hillside; "daarteen af" (twice) is unidiomatic but clear.
- "veld" for a field block follows the app-wide "veld" drafts and can also mean open veld; a fluent reviewer may prefer "land".
- "Tray" shown as "Onderaan" (at the bottom).

## Tests
`npx tsc --noEmit -p .` clean. `node --import ./tests/register-alias.mjs --test tests/af-inline.test.ts tests/xh-inline.test.ts tests/records-regional-drafts.test.ts tests/design-studio-i18n.test.ts`: 113 pass, 0 fail. No test expectation changed.
