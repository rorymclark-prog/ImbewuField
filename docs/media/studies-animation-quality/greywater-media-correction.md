# Greywater diagram label correction — 22 September 2026

> **Historical candidate, no longer in the learner player.** The corrected
> MP4 and poster below were subsequently withdrawn with the locally authored
> animations pending Rory's visual clearance. The current slide 21 is the
> older still. See [the current Water L4 check](water-l4-current-lesson-check.md)
> before relying on any status in this record.

Water Harvesting lesson 4 slide 21 keeps its existing 17-second conceptual
below-mulch route. The old pipe badge said only “no toilet,” leaving kitchen
washwater ambiguous. The generic tree did not itself identify the lesson's
non-food planting limit; the small footer was difficult to read at phone width.

The source renderer `scripts/render-water-concepts.py` now labels the pipe
“Suitable washwater” and “No kitchen or toilet water”, and points a
“Non-food planting” badge at the existing tree. These larger badges remain
readable at 390px. Geometry, water animation, duration, lesson body,
transcript, quiz, and audio remain unchanged. The badge does not identify or
recommend a plant species. The same-URL movie and poster have a one-time,
two-file offline cache migration, so an older downloaded diagram is not kept
beside the clearer teaching or silently fetched using the learner's data.

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `public/course-animations/water-harvesting/watch-21-greywater-mulch.mp4` | 163,923 | `50bf110b05dcfaddeb896f7d47be01231a636b84aab75c64d8c7361df1a14970` |
| `public/course-animations/water-harvesting/posters/watch-21-greywater-mulch.jpg` | 87,895 | `327573ecf90fc8e3f6817330cc7ea818af9aeb61e1ebde46c805c85161512769` |

The [South African Department of Human Settlements' water supply guide](https://www.dhs.gov.za/sites/default/files/documents/Redbook/REDBOOK_Section_J_Water_v1-1.pdf),
section J.4.2.4, excludes toilet and kitchen wastewater, along with water used
for baby/nappy washing, from its potentially reusable greywater resource. The
existing lesson has broader suitability, local-rule, no-pooling, no-contact and
no-drinking-connection cautions. The label is a source limit, not a safety
guarantee; mulch does not disinfect water.

The complete candidate movie, poster and 390px contact views were inspected.
At 390px the two new badges are legible on a still or paused video, the pipe
still discharges below mulch, and the root-zone tint does not surface. The
remaining baked English labels have no accepted isiZulu treatment. This is a
draft teaching correction awaiting Rory's phone review and language review,
not a site design, municipal approval or practitioner sign-off. No Flow
credits were used.
