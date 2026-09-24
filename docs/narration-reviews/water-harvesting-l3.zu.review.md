# Water Harvesting L3 isiZulu alignment review — 23 September 2026

**Status:** Review-only alignment packet. The existing isiZulu script and audio are stale against the current English source. Do not publish or record this draft as aligned. This packet is not a fluent isiZulu review, plumbing approval, or farmer/learner approval. No learner-facing isiZulu text or audio was changed.

**Scope:** Slides 14–18 of `docs/narration/water-harvesting.zu.md`, compared with the current English source in `docs/narration/water-harvesting.en.md` and the Water Harvesting L3 lesson and quiz in `lib/course-modules.ts` (`water-harvesting-l3`). Line references below refer to the current draft and should be refreshed if it changes.

| Slide | Short isiZulu excerpt and location | Current English source | Review issue |
|---|---|---|---|
| 14 — Roof catchment | L140: “0.9 amalitha ngemilimitha”; L142: “100” m², “800mm” and “72,000” L | English L121–127 now says roof yield depends on roof area, rainfall and losses, and adds: “Check whether the roof material is suitable for rainwater collection before connecting a tank.” It asks learners to use local rainfall records and account for losses. | The draft gives a fixed yield factor and a Pietermaritzburg example that are absent from the current source. It names a corrugated roof without the new suitability check. Review the concepts of roof material suitability, local rainfall, roof area and losses; do not carry over the example figures unless an authorised source owner restores them with support. |
| 15 — First flush | L150: “Amalitha okuqala angu-20 kuya ku-30”; L152: “faka isihlungi”; L154: “amanzi ethangi angalashwanga alungile” | English L133–139 says a diverter keeps **some** early runoff out; the amount depends on roof and system, with supplier sizing and maintenance instructions and “no single volume for every roof.” It says diversion does not make remaining water safe to drink. | The fixed 20–30 L instruction and “clean water” implication are unsupported. Filtering alone is presented as enough for drinking; untreated water is declared fine for irrigation. Reconcile to roof/system-specific diversion and use-specific safety checks, without adding a replacement volume or treatment recipe. |
| 16 — First-flush concept | L160: “njalo uma lina”; L164: “Amalitha okuqala angu-20 kuya ku-30” | English L143–145 calls the image a concept, says early runoff is diverted, and requires roof-specific sizing/maintenance plus a safety check for later runoff. | “Every time it rains” and a fixed volume overstate what the English source establishes. Confirm the translated concept does not imply that later runoff is clean or safe. |
| 17 — Tank size | L172: “EKZN, amalitha angu-5,000”; L174: “20,000 kuya ku-30,000” | English L151–157 says tank size depends on demand, rain, roof area and dry-period length; estimate intended-use demand against seasonal supply; a province alone cannot set the tank size. | The regional tank capacities and duration implication have no support in the current English lesson. Reconcile to locally observed supply and intended demand without preserving these fixed examples. |
| 18 — Stored-water safety | L182: “Hlunga amanzi ngaphambi kokuwaphuza”; L186 repeats “faka isihlungi”; L188: “amanzi ethangi angalashwanga alungile” | English L163–169 says keep tank covered, screen openings and maintain roof/gutters/diverter; keep rainwater separate from drinking-water pipes; clear appearance does not rule out germs or chemicals; ask the local health authority about testing/treatment for the intended use; a basic filter alone is no drinking-water guarantee; assess water used on food crops. | Filtration is framed as sufficient for drinking and untreated water as safe for irrigation. The draft omits cross-connection protection, water-quality uncertainty, local testing/treatment advice, system maintenance and the food-crop safety assessment. Align these safety limits and avoid giving plumbing installation instructions in learner narration. |

## Review questions

**For a fluent isiZulu reviewer**

- Does the wording clearly distinguish “some early runoff” from a fixed quantity, and make clear that the needed diversion depends on the roof and system?
- Does it avoid implying that water after the first flush is automatically clean, potable, or suitable for edible crops?
- Are “roof material suitability,” “drinking-water pipes,” “testing/treatment,” and “water used on food crops” expressed in familiar, low-literacy isiZulu without changing the English safety meaning?
- Does the slide 16 title and wording preserve that the drawing is a concept rather than a plumbing plan?
- Are all unsupported slide 14 yield figures and slide 17 regional tank figures removed from the aligned draft, unless the source owner separately approves a sourced change?

**For a South African water/plumbing practitioner**

- Is the roof-material suitability check accurate and understandable for smallholder learners without prescribing a universal list of materials?
- Does the wording on separating harvested rainwater from drinking-water pipes correctly convey the cross-connection/backflow risk, while leaving installation to qualified local advice and applicable standards/by-laws?
- Are the statements on first-flush limits, potable treatment/testing and food-crop use appropriately qualified for intended use and local public-health advice?
- Does the packet avoid turning one province's policy details into a nationwide rule?

Record reviewer name and role, sentence-level findings, unresolved questions and any requested source correction. Source-owner approval should precede source edits; then update the aligned script and affected audio together and recheck. This packet itself makes no approval claim.

## Official source links

- [KwaZulu-Natal Department of Human Settlements, Rainwater Harvesting Policy (PDF)](https://www.kzndhs.gov.za/documents/Provincial%20Policies/Rainwater_22.pdf), especially pp. 8–11 and 13–15. It discusses suitable roof materials, contamination barriers, health risks of untreated/unfiltered rainwater, maintenance, non-potable limitations and backflow protection for indoor plumbing. Its recommendations have stated rural/urban scope; use them as review evidence, not as automatic nationwide rules.
- [World Health Organization, Guidelines for Drinking-water Quality: rainwater harvesting section (PDF)](https://iris.who.int/bitstream/10665/44584/1/9789241548151.eng.pdf). It describes higher microbial contamination in first flush and the reduction in contamination as rain continues; this supports a contamination-reduction barrier, not a guarantee that stored or later water is potable.

The current English source and Water L3 lesson check are the alignment authorities for this packet. English current wording is in `docs/narration/water-harvesting.en.md` L119–169; lesson body, key points and quiz are in `lib/course-modules.ts` around the `water-harvesting-l3` entry.
