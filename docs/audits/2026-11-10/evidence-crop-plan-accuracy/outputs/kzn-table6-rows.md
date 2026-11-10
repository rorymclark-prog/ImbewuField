# Where each KZN Table 6 row in `compare-kzn-table6.py` comes from

Document: KZN Department of Agriculture and Rural Development, "Plant Establishment" (Vegetable Production Guidelines), Table 6 "Sowing times for certain selected vegetable crops". Column order as transcribed: cold areas (moderate frost; the cole-crops chapter says heavy frost) | warm areas, light frosts | hot areas, frost-free. URL recorded in the repo: <https://www.kzndard.gov.za/images/Documents/Horticulture/Veg_prod/plant_establishment.pdf>. The document was **not reachable** on 10 November 2026, so every quote below is the earlier transcription held in this repository, not a fresh reading.

| Catalogue crop | Row text as transcribed (cold \| warm \| hot) | Held in | Page recorded |
| --- | --- | --- | --- |
| sweetcorn | Sweet corn Sept/Oct - Dec Aug/Sept - Jan/Feb Jan - Mar, Jul - Sept | `research/crop-sources/_frost-free-months.json` → maize (the table has a "Sweet corn" row; no maize row) | 8 |
| green-beans | Bean, bush Sept - Jan Aug - Feb/Mar Feb - Sept | `research/crop-sources/_frost-free-months.json` → green-beans ("Bean, bush" row) | 7 |
| dry-beans | Bean, bush Sept - Jan Aug - Feb/Mar Feb - Sept | `research/crop-sources/_frost-free-months.json` → dry-beans (same "Bean, bush" row) | 7 |
| butternut | Cucurbits Sept - Dec/Jan Aug - Jan/Feb Mar - May, Jul - Oct | `research/crop-sources/_frost-free-months.json` → butternut ("Cucurbits" row) | 7 |
| pumpkin | Cucurbits Sept - Dec/Jan Aug - Jan/Feb Mar - May, Jul - Oct | `research/crop-sources/_frost-free-months.json` → pumpkin ("Cucurbits" row) | 7 |
| cucumber | Cucurbits Sept - Dec/Jan Aug - Jan/Feb Mar - May, Jul - Oct | `research/crop-sources/_frost-free-months.json` → cucumber ("Cucurbits" row) | 7 |
| watermelon | Cucurbits Sept - Dec/Jan Aug - Jan/Feb Mar - May, Jul - Oct | `research/crop-sources/_frost-free-months.json` → watermelon ("Cucurbits" row) | 7 |
| gem-squash | Cucurbits Sept - Dec/Jan Aug - Jan/Feb Mar - May, Jul - Oct | `research/crop-sources/_frost-free-months.json` → butternut (the "Cucurbits" row, applied here to gem squash) | 7 |
| baby-marrow | Cucurbits Sept - Dec/Jan Aug - Jan/Feb Mar - May, Jul - Oct | `research/crop-sources/_frost-free-months.json` → butternut (the "Cucurbits" row) | 7 |
| spanspek | Cucurbits Sept - Dec/Jan Aug - Jan/Feb Mar - May, Jul - Oct | `research/crop-sources/_frost-free-months.json` → butternut (the "Cucurbits" row) | 7 |
| cabbage | Cabbage Sept - Feb All year Feb - Jun/Jul | `research/crop-sources/_frost-free-months.json` → cabbage | 7 |
| beetroot | Beetroot Aug - Mar All year Feb - Sept | `research/crop-sources/_frost-free-months.json` → beetroot | 7 |
| sweet-potato | Sweet potato(cuttings) Nov Sept/Oct - Dec Aug - Mar | `research/crop-sources/_frost-free-months.json` → sweet-potato | 8 |
| potato | Potato (tubers) Sept/Oct June-August April/May | `research/crop-sources/_frost-free-months.json` → potato | 8 |
| lettuce | Lettuce Jan - Apr, Jul - Dec All year Feb - Aug/Sept | `research/crop-sources/_frost-free-months.json` → lettuce | 7 |
| amadumbe | Madumbe (corms) - Aug - Nov Jul - Dec, Mar | `research/crop-sources/_frost-free-months.json` → amadumbe | 8 |
| garlic | Garlic (cloves) Apr - May Apr - May Apr - May | `research/crop-sources/_frost-free-months.json` → garlic | 7 |
| peas | Pea Jun/Jul - Sept Mar - Jul/Aug Mar - May/Jun | `research/crop-sources/_frost-free-months.json` → peas | 8 |
| broad-beans | Bean, broad Apr - May Apr - May Apr - May | `research/crop-sources/_frost-free-months.json` → broad-beans | 7 |
| broccoli | Broccoli Sept - Jan Jan - Sept Feb - Jun/Jul | `research/crop-sources/_frost-free-months.json` → broccoli | 7 |
| cauliflower | Cauliflower ... Cold areas Heavy frost: December - Feb/March [and] August - September // Cauliflower Aug - Sept, Dec - Feb/Mar // Cauliflower ... Hot areas Frost free: Feb - Mar/Apr // Cauliflower ... Feb - Mar/Apr // Cauliflower ... Warm areas Light Frost: August - September, January - April // Cau | `research/crop-sources/cauliflower.json` → sowMonths evidence | 3 |
| parsley | Parsley Aug - Mar Jul - Apr Feb - Sept | `research/crop-sources/parsley.json` → sowMonths evidence | 8 |
| radish | Radish Jul -Apr All year Mar-Oct | `research/crop-sources/radish.json` → sowMonths evidence | 8 |
| true-spinach | Aug - Mar \| Feb - May, Jul - Sept \| Mar - Aug | comments in `lib/crop-catalog.ts` (true-spinach entry: 'Cold areas Moderate frosts' Aug-Mar; 'Warm areas Light frosts' Feb-May, Jul-Sept; 'Hot areas Frost-free' Mar-Aug) | not recorded |

Rows the catalogue cites from the same table but which are **not** in the comparison because the full three-column text is not held in the repo: Swiss chard, carrots, onions, tomatoes, capsicum, turnip (single cells are quoted in `lib/crop-catalog.ts` comments).

Reading rule: a slash in a cell ("Feb - Jun/Jul") is read both ways. The script reports catalogue months outside the widest reading, and source months of the narrowest reading that the catalogue lacks.
