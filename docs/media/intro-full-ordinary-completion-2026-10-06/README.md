# Introduction full ordinary paired media — 6 October 2026

Base: `8914c4ed10d7fdddd9b7b58b43a839fe7bdda7b7`. Exactly 36 accepted VE/TS frames; ST Intro is untouched.

`frames.json` binds actual prior/current SHA256, bytes, full paired source/target/status objects, width and natural height. Its frozen SHA is `ab1079681559b79534e22c9d6e64e08ba11f385f1471758bbe9fabc40c9e7967`. Prior actual base encoded headers were retained after verifying whole base SHA/bytes, so dated dimension assertions use genuine provenance rather than invented historical bytes. That provenance addition does not alter accepted targets or compressed assets.

## Render and conversion

The recorded `renderCommands` run `node scripts/make-lesson-slides.mjs intro-permaculture <ve|ts> <fresh-temp> --paired-draft docs/narration/intro-permaculture.<lang>.paired-draft.json --slides<exact-list>`, sequentially VE then TS. Only those PNGs were converted RGB WebP with Pillow quality 88, method 6 and copied into the matching public paths. No resize or crop. VE14 naturally needs 5402px; all other frames use 5400px at 1440px width.

Actual outputs and 18 complete contacts are indexed in `contacts-index.json` under `/tmp/imbewu-intro-full-render-20261006-8914c4ed/`. Root inspected all 18 contacts plus individual VE14; no clipping/collision observed. This is local visual evidence, not native phone or language-fluency approval.

## Preservation and offline cache

The frozen full manifest and actual 1905-asset inventory precede conversion. Exactly 36 size entries and the aggregate comment change; all 1869 other asset hashes/bytes match. The comment comes from the actual manifest sum, not an estimated budget. Narration, films, ST Intro and all other modules are preserved.

`tests/intro-full-ordinary-media-history-checks.ts` verifies complete current sources/targets/native/unlisted state and actual compressed signatures/dimensions before exposing only exact older descriptors. Full media verification is bounded once per immutable test process; manifest mutation and corrupted-buffer/dimension controls remain separate meaningful checks. Older proof assertions retain their full historical rules through dated composition.

The worker migration removes exactly these 36 saved still paths/query variants once, performs no fetch, and preserves later replacement downloads. Native preview, phone/offline verification and publication remain pending.
