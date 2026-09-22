# Soil cover stills — 22 September 2026

Two verified image gaps are replaced using the built-in imagegen skill, with one
new candidate per image. This changes the picture; PLAN_VERSION is untouched.
Exact prompts are in prompts.json; output paths/hashes are in assets.json.
PNG originals are preserved in Downloads/ImbewuField-Animation-Quality-2026-09-22/soil-stills-review.
The checked-in JPEGs are the actual course assets, encoded at quality85, 1920×1080.

Slide16 replaces a text-only slide with an illustration of living cover amongst
old crop stubble. Vegetative grass is unnamed: it does not certify a cultivar,
locally suitable species, sowing season or nitrogen-fixing capability. The existing
conditional narration remains authoritative. The farmer stands on the edge path.

Slide18 replaces a sun/moisture cartoon with two separate seasonal-risk scenes:
dry exposed soil and windborne dust; exposed soil under rain with surface splashes.
This is an illustration, not a controlled experiment, measured soil loss or a
before/after claim. Surface residue is sparse; no complete protection is implied.
Both mechanisms are visible in the generated and encoded stills. No new labels,
figures, species, lesson text, quiz, transcript or audio are introduced.

The reuse search inspected existing soil-recovery, mulch-ground, worm-farm,
soil-rain and windbreak art. None illustrated the required teaching without
misrepresenting established vegetables as cover crops or rain as wind erosion.
No existing animation was regenerated, accepted or registered in this batch.

Primary-source check: [FAO soil organic cover](https://www.fao.org/conservation-agriculture/in-practice/soil-organic-cover/en/)
describes cover crops bridging the gap between main crops and protecting soil
against rain impact. [FAO soil organic matter](https://www.fao.org/4/a0100e/a0100e07.htm)
discusses exposure to wind/water erosion and surface-cover protection. These
support the qualitative visual mechanism, not the suitability of a specific crop
or the exact weather/soil appearance in generated art.

The batch also scopes deck arrow shortcuts to its focused surface. Seeking audio,
using buttons and interacting elsewhere no longer turns the lesson page. Behavioral
tests protect plain slide navigation, media/widget exclusion and modified shortcuts.
A targeted service-worker migration retires only the two outdated English stills,
retaining other downloads and requiring the normal explicit download for replacements.

Validation and publication status will be appended after the complete checks.

## App verification

Both actual images were viewed in the lesson player on desktop and at390CSSpx.
The narrow navigation strip now uses full-width Play, a Back/Next row and a
separate progress bar; labels no longer wrap. Independent agent review accepted
both images for illustration, without claiming practitioner approval.

The Soil module saved all51files. With the tab connection disabled, slides16/18
loaded at1920px and their original narration reached readyState4 and played.
Native-audio ArrowRight stayed on slide16; the same key focused on the deck
advanced only that deck to17. Network and viewport overrides are restored after QA.

Final implementation suite: 3,682tests, 3,681pass, zero failures, one existingTODO.
Typecheck and whitespace passed. The CSS-module import required a scoped style
stub in component tests; media and interaction assertions remain unchanged.
Production build, CI and publication are recorded in the continuation file.
