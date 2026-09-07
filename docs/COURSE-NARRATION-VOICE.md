# Course narration voice

## Production decision — 7 September 2026

Rory asked for narration consistent with the completed Seeds module and authorised
lesson improvements. Use Seeds as the reference for all new or replacement audio:

| Language | Target voice | Historical Seeds speed |
| --- | --- | --- |
| South African English | Microsoft `en-ZA-LeahNeural` | 0.88 of normal |
| isiZulu | Microsoft `zu-ZA-ThandoNeural` | 0.88 of normal |

Evidence: `lib/course-audio.ts` records the Seeds production on 28 July 2026,
including exact voice IDs, speed and clip-to-script duration checks. The nine
later English modules were recorded on 3 August using `en-ZA-LukeNeural` through
`edge-tts` in Antigravity. Antigravity is the working environment; the documented
speech voices are Microsoft voices, not Gemini's own voice selection. The old
recording export described the environment loosely as “Gemini” and requested
only a South African voice. It now names the target voice explicitly.

This decision is a target for production. It does not change or relabel the audio
already on disk: Seeds still uses Leah; the other nine English modules still use
Luke until replacement recordings are generated and verified. No replacement
recording was made in this change. No earlier user preference between the two
English voices was recovered from the personal-context search.

## Recording and review

1. Finalise the source script and retain its slide numbers. If teaching changes,
   review the corresponding narration and visual together.
2. Export numbered recording text with `scripts/course-narration-export.mjs`.
   The generated `RECORD.md` names the target voice on every module's sheet.
3. Establish the recording tool's equivalent of the documented 0.88 speed with
   a short reference take. Compare it audibly with Seeds. Pitch, volume and exact
   engine settings beyond speed are not documented; do not claim they were recovered.
4. Record a complete module with the same voice and settings. Do not mix replacement
   Leah clips with unreplaced Luke clips inside a module. Record the actual tool,
   voice ID, settings and date with the production handover.
5. Verify clip counts, durations and script matching through the existing importer.
   Listen to the reference sample and spot-check beginnings and endings. Duration
   checks cannot identify a voice or establish pronunciation quality by themselves.
6. Keep the existing audio until replacements pass review. Update the narration
   provenance comment and asset-size inventory with the accepted files.

English replacement backlog: all nine modules outside Seeds, 185 existing slide
clips. IsiZulu backlog: review and record the nine remaining modules; eight source
scripts explicitly label themselves drafts. Water has no draft flag, but still
needs review provenance checked. New field activities require their own finalised
scripts before any recording. Generating a recording sheet is not review approval.
