# Local core-animation asset reconciliation

> **Superseded snapshot.** This inventory predates Rory's 22 September visual
> quality decision and the withdrawal of 22 locally authored learner
> registrations. It remains evidence of what was found at that point; it is not
> the current player or filesystem state. See
> `held-authored-media-2026-09-22.md` and `COVERAGE.md` for current status.

This is a filesystem inventory only. It does not approve a visual, request a
replacement, alter a registry entry, generate media or authorise deletion.

## Result

- `lib/course-deck.ts` resolves **49** registered core slots and **57** manifest
  variants once the eight isiZulu overrides are included.
- All 57 variant MP4 paths exist locally, and every required poster path exists.
  There are no missing registered MP4s.
- Manifest byte counts match every local MP4. Two duration tolerances need a
  manifest review: `seed-selecting-parents` is 5.208008 seconds against 5, and
  `seed-dry-processing` is 4.791667 seconds against 5. This is metadata evidence,
  not a judgement about either clip.
- Seven SHA-256 groups are reused by language variants. Reuse is recorded in the
  JSON and is not automatically an error.
- Five unregistered core-module MP4s are listed as **archive candidates only**:
  the former chicken-tractor, seven-layers, forest-sequence, living-soil and
  windbreak files. They are not deletion instructions.

The machine-readable [LOCAL-ASSET-RECONCILIATION.json](LOCAL-ASSET-RECONCILIATION.json)
contains each slot's manifest fields, actual MP4 path, SHA-256, byte count,
duration, dimensions, poster existence, mismatch flags, duplicate hashes and
unregistered candidate paths.

## Scoped duplicate-prevention evidence

The local scan found existing soil, livestock and forest production material in
`docs/media/studies-animation-quality/` and
`docs/media/studies-illustrated-release/`, including soil-rain sources, soil
observation, forest establishment/layers, and existing livestock/forest
illustrations and verification records. These are already-produced alternatives
to reconcile before proposing work; they are not new source matches or visual
approvals.

The scoped Downloads folder contains three existing 1280×720, eight-second H.264
files: old Fast soil rain (`8cbd0d87…e44c`, 5,691,410 bytes), the soil Quality
pilot (`eba8d506…b13a`, 6,051,418 bytes), and the existing bee clip
(`a7cfe1af…c153`, 2,246,658 bytes). Their full hashes and paths are in JSON.
The bee candidate remains separate from the core registry until direct
reconciliation with the current hive-to-crops narration; neither soil file is a
reason to generate another candidate.

Known Flow titles and the Studies, Mzomoyethu and PlantGuilds project locations
are recorded as reported existing evidence. They have not been source-hash
matched to registry entries and carry no acceptance claim.
