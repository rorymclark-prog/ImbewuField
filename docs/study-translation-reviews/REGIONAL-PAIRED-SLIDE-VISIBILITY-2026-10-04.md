# Regional paired-slide visibility review — 2026-10-04

## Scope and evidence

This change suppresses an animation only where its poster would cover a registered, source-paired regional still and the learner has no narration for that slide. The audit ran the actual deck, image, animation, and narration resolvers at `747dba1`, then checked the paired-draft entry for each match. Its 35 overlap rows are recorded in `/tmp/imbewu-regional-paired-poster-visibility-audit-20261004.json`.

An isolated execution of `offlinePack` checked both full and slides-only packs for all 35 rows (70 checks, zero failures) in `/tmp/imbewu-regional-poster-offline-selection-recommendation-20261004.json`. It selected each existing regional still and omitted the hidden film and poster. No cache migration is included: the still URLs and bytes are unchanged, while the same film URLs remain valid for English and most isiZulu decks. Deleting those shared cache entries would damage retained-language offline packs.

## Resolver changes

The 35 newly covered overlaps are:

- Food Forest 16: VE, TS.
- Vegetables and Staples 6: VE, TS.
- Soil Health 10–11: VE, TS; the existing ST and ZU holds remain.
- Reading the Landscape 6: ST, VE, TS.
- Plant Guilds 15, 23, 27, 29, 33, 37, 41, 45: ST, VE, TS.

The change uses the existing per-animation language availability rule. English films remain available for every row. Existing isiZulu availability and labelled Plant Guilds variants remain intact. Market Community 15 stays covered by its earlier regional holds. The Introduction still has all 22 Sesotho narration tracks. No lesson source, paired text, image, animation, or audio file was changed.

## Regression coverage

The table-driven test checks each affected resolver binding against its language-specific paired JSON, exact still URL and on-disk file, source slide/title and paragraph alignment, unreviewed draft/hold status, absence of regional narration, and retained English/isiZulu film behavior. Separate assertions preserve the existing Market split and all Sesotho Introduction narration.

## Visual review still required

No phone or rendered-pixel review is claimed here. Before release, inspect representative 390 px learner views with the paired still and its exact English source visible: Reading the Landscape 6 in ST/VE/TS; Plant Guilds 23 in ST/VE/TS; Vegetables and Staples 6 in VE/TS; Soil Health 10–11 in VE/TS; Food Forest 16 in VE/TS. Confirm the regional still is visible instead of the poster, while the English and isiZulu film choices remain available. The source audit establishes the resolver bindings, not visual approval of the frames.
