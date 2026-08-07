# ImbewuField visual asset library

This directory is the source library for approved Recraft artwork. It is deliberately
separate from `public/`: artwork is reviewed here before a display integration points
at it. Do not add generated placeholders or state-specific copies.

## Landing an asset

1. Find its metadata file in `assets/metadata/`. Its `assetPath` is the SVG landing
   path and its `delivery` block names every required PNG export.
2. Keep the filename and `_v01` version unchanged. A changed illustration receives a
   new version only after review; never overwrite an approved source silently.
3. Preserve a transparent background. SVGs must contain editable vector paths and
   simple opacity only: no embedded raster image and no SVG filter.
4. Set the metadata `assetStatus` to `awaiting-review` when files land. Only a person
   who has checked the rendered asset may set it to `approved`.

The required file pattern is `{id}.svg` plus `{id}_{pixels}.png`. Map and pattern
assets require 1024, 512, 256, and 128 px PNG exports. Hybrid assets require 1536 and
1024 px PNG exports. UI masters, when added, require 48, 32, and 24 px PNG exports.

## Batch 1 visual lock

The twelve metadata records in `assets/metadata/` are the only Batch 1 files. Their
`generationPrompt` fields are the approved hand-off prompts. In particular,
`bf_pattern_vetiver_row_top_v01` is E10: one upright row, not E11's dense double-row
vetiver bank.

## State styling

Each record deliberately contains exactly one neutral asset. Existing, proposed,
to-verify, selected, hover, unavailable, damaged, and completed are paint-time app
states. No state name belongs in an artwork filename, and no state variant should be
requested from Recraft.

## Review before use

Check every delivered file against the visual-lock checklist in the production brief:
64 px recognition, correct view, transparent background, 12% clear padding, approved
palette, practical South African character, no text/logos/people/scenery, obvious
anchor, vector-only SVG, and genuinely seamless pattern edges. Map assets must not
have baked long shadows.
