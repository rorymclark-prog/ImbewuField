# Introduction to Permaculture — Tshivenda draft

- **Status:** machine draft; no fluent-language or local-farming review has happened.
- **Data:** [`lib/course-translation-drafts-ve.ts`](../../lib/course-translation-drafts-ve.ts), paired field-by-field to `lib/course-modules.ts` for the module title and description, all three lessons, infographic alt text, key points and quiz content.
- **Held fields:** `lessons[2].body` (uncertain word for flood), `lessons[2].quiz[1].question` and `lessons[2].quiz[1].options[1]` (independent review found the proposed Tshivenda compass term reverses north-west to north-east). Each remains exact English in the data.
- **Claims to preserve in review:** all-three-ethics examples; water sharing depends on permission and source capacity; the twelve named principles and the source's full-season observation qualifier; hail damage depends on storm and crop growth stage; fresh manure can carry germs; the numbered Zone 0–5 example, visit frequency, and north-west Highveld windbreak condition. Source quiz answer indexes are copied unchanged.
- **Reviewer dependency:** fluent Tshivenda review with a Limpopo/Mpumalanga smallholder context is needed for orthography and local farming terminology. Model review is not fluency certification.
- **Scope:** review data and structural tests only; no Study wiring, audio, or decks.

## Independent machine review

Agy Pro Low flagged the flood term in lesson 3 and the compass direction in the Highveld windbreak quiz. Those three source pairs were changed to exact-English holds. No figure, species, or answer-index drift was reported. This check cannot certify Tshivenda fluency.

## Lesson 3 fluent-review handoff

The following source text is the authority for review. Translate each held pair into Tshivenda, but keep the two quiz fields together: the question and its answer must still point to the same boundary. Do not edit the English source or `sourceCorrectIndex`.

| Held field | Exact English source | Review evidence required |
|---|---|---|
| `lessons[2].body` | “Zones and sectors help you cut wasted labour. Zones run 0 to 5 by how often you visit. Zone 0 is the house. In this example, Zone 1 is near the house and holds what you pick often — herbs, salad greens. Zone 2 is the main garden and chicken run, visited once or twice a day. Zone 3 is the main field, visited weekly. Zone 4 is semi-wild — fruit trees and fodder needing occasional attention. Zone 5 is left wild.\n\nSectors are the energies arriving from outside — sun, wind, rain, flood, fire. Watch where strong wind comes from on your farm. Nearby weather-station records can help you check wind direction. Watch where rainwater enters and flows across your land. Draw arrows for what you observe.\n\nSketch zones and sectors on paper and you have the skeleton of your design.” | Confirm three paragraphs; every zone label from 0 through 5; Zone 0 as the house; the Zone 1–5 descriptions as this example rather than universal rules; “once or twice a day” and “weekly”; and flood as an incoming flood hazard/force in the sector list, distinct from rain and stored water. Confirm the instruction is to observe and draw what is seen, with no unstated digging or water-use advice. |
| `lessons[2].quiz[1].question` | “You observe damaging wind coming from the north-west on a Highveld farm. Where should a windbreak go?” | A fluent reviewer must independently identify the stated source direction as north-west, preserve that it is damaging wind, and retain the Highveld context. |
| `lessons[2].quiz[1].options[1]` | “North-west boundary, between the wind and the crops” | Confirm the boundary is on the north-west side, between the wind source and crops. Read the translated question and all four answer options together and confirm this remains the sole correct answer. Keep answer index `1`. |

### Acceptance record

Before changing any `hold` to `machine-draft`, attach a reviewer record here with the reviewer’s name or role, Tshivenda fluency/context, date, the approved Tshivenda wording for all three fields, and a field-by-field confirmation of the checks above. Record any unresolved wording and leave that pair held. A model-only review is not acceptance evidence. After accepted wording is entered, confirm in the source-pair test that digits and paragraph boundaries match, and in the Study wiring test that learners receive the translated fields and correct option index while source drift still falls back to English. Until then, keep the exact-English holds in place.

### Agy run for this handoff

The requested command was `agy --effort high --print='…'` with the three source fields and the checks above. Agy returned: `jetski: no output produced — a tool required the "command" permission that headless mode cannot prompt for, so it was auto-denied.` No translation was produced or used, and no permission-bypass retry was made.
