# IsiZulu audio recording readiness — 23 September 2026

## Current counts

The live course status command reads the scripts, manifest and files on disk. At this check it
reported 10 core modules and 33 lessons. English slide audio is present for all ten modules. The
eight English-only modules have 165 English slide clips in total:

| Module | English clips | IsiZulu script blocks | Recording gate |
| --- | ---: | ---: | --- |
| Introduction to Permaculture | 22 | 22 | Full review draft; fluent isiZulu and local farming review needed |
| Reading the Landscape | 21 | 21 | Full review draft; fluent isiZulu and local farming review needed |
| Water Harvesting | 24 | 24 | L1–L3 full drafts; L4 greywater held for local sanitation and municipal reconciliation |
| Soil Health & Composting | 20 | 20 | L1–L2 full drafts; L3 awaits authorization of the English mulch/leachate correction |
| Vegetables and Staple Crops | 18 | 18 | Full review draft; fluent isiZulu and local farming review needed |
| Food Forest Design | 20 | 20 | Full review draft; fluent isiZulu and local farming review needed |
| Small Livestock Integration | 20 | 20 | Full review draft; fluent isiZulu and local farming review needed |
| Market Gardening & Community | 20 | 20 | Full review draft; fluent isiZulu and local farming review needed |
| **Total** | **165** | **165** | **No module is recording-ready yet** |

These counts describe files and draft blocks, not approved translations. The existing Seeds audio is
24 isiZulu slide clips and Plant Guilds is 51; Plant Guilds remains pending fluent review. The
course status command currently flags nine isiZulu review holds across the ten modules, including
Plant Guilds and the two modules with existing Seeds/Plant Guilds audio.

The review queue says comparison packets cover all 27 lessons outside Seeds and Plant Guilds, with
complete review-only drafts for 25 of those lessons. Water L4 and Soil L3 are the two without full
drafts because of their separate source holds. Those 25 drafts still need first-language isiZulu
and local farming review. Farm Finance is outside this count.

## Safe recording and import sequence

1. Start from a frozen, source-checked English lesson and its current slide narration. Recheck that
   the associated isiZulu comparison draft still matches those exact English sources. A later
   English correction makes the corresponding draft and any recording stale until reconciled.
2. Obtain and record a fluent isiZulu reviewer’s decision for each lesson: reviewer name and
   relevant language/farming experience, date, corrections, reviewed scope, and accepted/revise/hold
   outcome. Resolve source or specialist holds separately. Do not treat an AI check or packet as
   this approval.
3. Only after acceptance, place the approved learner narration in the canonical
   `docs/narration/<module>.zu.md` script. Preserve the existing slide numbering and source claims.
   The current `course-narration-export.mjs` exports whatever is in that path; it does not itself
   establish that the text has been approved.
4. Export numbered recording sheets, record one clip per slide and a full track, then import the
   module with `scripts/import-course-audio.mjs`. Its checks compare block counts and duration-based
   pacing; they do not judge isiZulu fluency, pronunciation, meaning, audio quality, or reviewer
   acceptance. Listen to every imported clip against its approved text before release.
5. Add/update the module’s `lib/course-audio.ts` manifest in the same change as audio files. Check
   that slide numbers map to the right lesson and that the manifest’s language and track counts
   match files on disk. The existing course-audio test checks manifest/file agreement; it cannot
   certify the recording’s language or meaning.
6. Update learner lesson text, deck language registration, transcripts and offline assets only
   after the same lesson review gate. Verify a phone-width lesson, the spoken clip against the
   approved script, and the saved offline pack before calling that lesson available.

## Existing commands and their limits

```sh
npm run course:status
npm run course:status -- --todo
node scripts/course-narration-export.mjs <module-id> zu <output-directory>
node scripts/import-course-audio.mjs <module-id> <recording-export-directory>
```

`course:status` is the current evidence source for script blocks, draft flags, manifest claims and
audio files. Run it immediately before recording and release. The exporter and importer are
reproducible file-layout tools, not approval systems: export can currently read a draft, and import
performs its checks after copying files into the working tree. Therefore an operator must verify
the per-lesson accepted review record before export, and treat imported files as candidates until
human listening and the matching manifest/player/offline checks are complete.

No audio was generated, imported, changed or published for this handoff. No fluent approval is
claimed. The source inventory is in `docs/narration-reviews/CORE-ISIZULU-REVIEW-QUEUE.md`; the
module-specific draft links and review requirements are there and in the linked handoff documents.
