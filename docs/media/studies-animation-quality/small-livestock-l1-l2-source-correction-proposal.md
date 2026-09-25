# Small Livestock L1–L2 source correction proposal

Review-only packet — 23 September 2026. This file proposes narrow wording
changes for human review. It does not change learner content, narration, audio,
media, manifests or tests.

## Evidence checked

The current player registration is in `lib/course-deck.ts`:

- slide 4 uses `hens-pecking-pexels-5563939`;
- slide 9 uses `flow-bee-between-blossoms`.

The slide 4 poster shows two hens pecking at cut vegetation on bare ground.
The material is visibly green and recently cut; the frame does not establish
that the bed is empty after harvest or that the material is dry. The current
slide title and narration say “Hens Foraging After Harvest” and “Watch the hens
peck at the ground among dry plant remains.” This is a scene/caption mismatch,
not evidence that the clip shows a different animal action.

The slide 9 Flow clip is a single locked eight-second macro. One bee moves from
the first blossom to the adjacent second blossom, and both blossoms remain in
frame. The clip has no hive and does not show a bee leaving a hive. It shows
contact with flower centres; it does not visibly show pollen transfer. The
current title/narration say “Bees Moving Between Hive and Crops” and “Watch the
bees leave the hive and move among flowering crops.” That opening describes
context absent from the registered shot.

## Narrow wording proposals

These are the smallest source-faithful replacements for human review:

| Location | Current wording | Proposed wording |
| --- | --- | --- |
| L1 slide 4 title | `Watch: Hens Foraging After Harvest` | `Watch: Hens Pecking at Cut Plant Remains` |
| L1 slide 4 narration | `Watch the hens peck at the ground among dry plant remains.` | `Watch the hens peck at cut plant remains on the ground.` |
| L2 slide 9 title | `Watch: Bees Moving Between Hive and Crops` | `Watch: A Bee Moves Between Two Blossoms` |
| L2 slide 9 narration line 1 | `Watch the bees leave the hive and move among flowering crops.` | `Watch one bee move from one blossom to an adjacent blossom.` |
| L2 slide 9 narration line 2 | `Their movement carries pollen between flowers across the site.` | `Contact with flower centres is one part of how pollination can happen; this clip does not show pollen transfer.` |

The last proposed line is deliberately narrower than the current general
lesson statement. The clip is visual evidence of contact only; it must not be
used to claim that this bee transferred pollen, caused fertilisation, produced
fruit or increased yield. The later lesson text already says that a hive does
not guarantee higher yields and that weather, water, plant health and other
pollinators matter.

## Protected South African facts

The protected lesson says that South Africa has two native honeybee
subspecies, then places the Cape bee in the southern and south-western Cape and
the African honeybee across the north and east. The current official sources
support the two-subspecies point but make the geography more precise:

- SANBI describes *Apis mellifera capensis* (Cape honeybee) as found in the
  Western Cape and parts of the Eastern Cape, effectively the Fynbos biome.
- SANBI describes *Apis mellifera scutellata* (African honeybee) as native to
  central and most of southern Africa; its South African account excludes the
  Western Cape and parts of the Eastern Cape from the natural veld range.
- The Department’s consolidated honey-bee control measures define the two
  southern African subspecies and establish a demarcation line controlling
  movement between their areas.

Proposed narrow correction for the distribution teaching, if the content owner
accepts a source update:

> South Africa has two native honeybee subspecies. The Cape honeybee is found
> mainly in the Western Cape and parts of the Eastern Cape. The African
> honeybee is native to central and most of southern Africa, with a regulated
> demarcation between the two areas.

This avoids turning a broad biological range into a simple “north and east”
rule, while preserving the existing two-subspecies lesson. It should be
checked against the current demarcation wording before any advice about moving
colonies is recorded.

## Registration scope

The current lesson says: “All beekeepers must register with the national
Department of Agriculture.” The official consolidated control measures say:
“Every person who carries out any beekeeping activities shall register with the
Department.” The older government registration form also explicitly includes
commercial, hobbyist and bee-removal service providers, but its annual date
language should not be carried forward without a current administrative check.

Proposed narrow wording:

> Anyone carrying out beekeeping activities must register with the Department
> under the current honey-bee control measures. Check the current requirements
> before starting or moving colonies.

This keeps the legal scope broad and avoids implying that only commercial
beekeepers register or that an outdated annual deadline is current.

## Primary sources

- SANBI, [Cape honeybee](https://www.sanbi.org/animal-of-the-week/cape-honeybee/)
  — distribution and the two-subspecies context.
- SANBI, [African honeybee](https://www.sanbi.org/animal-of-the-week/african-honeybee/)
  — distribution and natural range.
- South African Department of Agriculture, [Consolidated Control Measures
  relating to honey-bees](https://www.nda.gov.za/images/Branches/AgricProducHealthFoodSafety/PlantProductionHealth/PlantHealth/Legislation-and-Regulations/Regulations/Control-Measures-Honey-Bees/Consolidated%20Control%20Measures%20relating%20to%20honey-bees.pdf)
  — definitions, registration scope and movement demarcation.
- South African Government, [Agricultural Pests Act: Control measures relating
  to Honey-Bees](https://www.gov.za/documents/notices/agricultural-pests-act-control-measures-relating-honey-bees-22-nov-2019)
  — published legal notice and current government source index.
- Department [Beekeeper Registration Form](https://www.nda.gov.za/images/Branches/AgricProducHealthFoodSafety/PlantProductionHealth/PlantHealth/Inspection-Services/Beekeepers/170306%20Beekeeper%20Registration%20Form.pdf)
  — confirms the historical broad registration scope; do not infer a current
  deadline from this older form.

No new Flow or code-drawn animation is proposed. The media review is limited
to the registered clips and their scene/caption fit.
