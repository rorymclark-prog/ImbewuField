# Soil observation tour

Replaces Soil Health slide 5's flat soil diagram with detailed warm homestead cutaways, close-up camera movement, restrained focus outlines and synchronized English narration. This is a guided observation exercise, not a rainfall simulation or a diagnosis of either sample. The separate slide 14 rain candidate remains unaccepted.

## Reproduce

The built-in image_gen source and its prompt are preserved in `../soil-rain/`. The two profiles have comparable colour and roots, with different surface cover. `storyboard.json` identifies the source, five spoken phases and three highlight regions.

```sh
uv run --with edge-tts python scripts/record-forest-layer-tour.py --art-dir docs/media/studies-animation-quality/soil-observation
python3 scripts/render-forest-layer-tour.py --art-dir docs/media/studies-animation-quality/soil-observation --out "$PWD/public/course-animations/soil-health/tour-soil-observation.mp4"
```

The existing forest recorder/renderer now accepts another storyboard. Its defaults preserve the forest tour; this change does not regenerate those production assets. Narration source and audio hashes are checked before rendering.

## Review evidence

Source artwork inspected at full resolution. All five phase views inspected at 400 pixels wide (`review-contact.jpg`): clumps, branching roots and loose surface cover remain distinct; the labels fit and no specimen is labelled healthy/dead. The structure close-up includes clods and stones; it invites field examination, rather than claiming every visible lump is a stable aggregate.

The 1600 × 1100, 24 fps movie is 29.833333 seconds, 716 frames, 4,874,969 bytes. Full FFmpeg decode passed. The narrated review movie played through in the browser twice (`ended=true`, `readyState=4`, no media error). Camera motion was observed in the player; five settled views were reviewed from the renderer. This is not a physical-phone or fluent-human listening review.

English audio uses the existing South African Luke voice at -12%: 62 words, 28.56 seconds. Word-boundary text exactly matches the script and all five starts; full decode passed. It is the existing Edge fallback, not AGY audio. `timing.json` records that human listening review remains open.

The new video URL prevents stale movie reuse. Audio, poster, slide still, manifest, transcript, combined 20-slide narration and exact download sizes ship together. The service worker removes only the three outdated soil slide-5 resources once, preserving other downloads and never automatically redownloading media. The regression test exercises those behaviours.

Accuracy and primary-source links: `FACT-CHECK.md`. Local before/after review: `Downloads/ImbewuField-Animation-Quality-2026-09-20/soil-observation/REVIEW.html`.

Local release checks: `npx tsc --noEmit` passed; `npm test` reported 3,638 passes, zero failures and one existing shape-sync TODO (3,639 tests total); `git diff --check` passed. CI and production verification follow publication.
