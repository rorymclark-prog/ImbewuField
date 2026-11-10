# Evidence for the crop plan re-audit of 10 November 2026

This folder backs [`../crop-plan-reaudit-claude.md`](../crop-plan-reaudit-claude.md). Everything here comes from the public sample farm on a local dev server. No private farm, account or paid generation was used.

## What is here

| Item | What it is | Made by |
| --- | --- | --- |
| `measurements/<view>.json` | One complete, untruncated measurement per view: totals, every contrast failure with its declared and pixel-read figures, targets, small text, clipped text, headings, layout and the full text corpus | `measure-page.cjs` |
| `measurements/keyboard-<width>-light.json` | The three crop sheets and the first 45 tab stops | `measure-keyboard.cjs` |
| `measurements/language-*.json` | English and isiZulu captures of the same view compared, with unchanged text sorted by kind | `compare-language.mjs` |
| `measurements/weekly-target-flow.json`, `measurements/capture-log.json` | The text the weekly-target card and review showed; the state of every screenshot | `capture-screens.cjs` |
| `01-…png` to `17-…png` | The screenshots the record links | `capture-screens.cjs`, then reduced (below) |

## Which build was measured

Each JSON file records `servedBuild`, read from the server's `/api/build-info`, not typed in. The 18 page measurements were taken on `3303ed3` of this branch; the keyboard files, the screenshots, the weekly-target flow and the capture log on `504b319`. The language files are computed from the page measurements. Both commits add only `docs/` and `PROGRESS.md` to released `8a4d1fd`; the application is byte-identical, which this confirms:

```bash
for c in 3303ed3 504b319; do git diff --quiet 8a4d1fd $c -- app components lib public functions tests scripts package.json package-lock.json && echo "$c identical"; done
```

Production was not measured.

## Reproduce

Node 22.18 or newer, the repository's dependencies installed, Playwright with Chromium available, and ImageMagick for the last step. Run from the repository root.

```bash
node dev-server.mjs --port 4242 &          # the app under test
export BASE_URL=http://localhost:4242 PLAYWRIGHT_MODULE=playwright
E=docs/audits/2026-11-10/evidence-crop-plan-reaudit

# 1. Page measurements: <name> <width> <height> <light|dark> <simple|full> <en|zu> [expand|no] [gate|confirm] [textscale] [dpr]
export OUT=$E/measurements
node $E/measure-page.cjs phone-light-simple            390 844 light simple en
node $E/measure-page.cjs phone-light-simple-zu         390 844 light simple zu
node $E/measure-page.cjs phone-dark-simple             390 844 dark  simple en
node $E/measure-page.cjs phone-light-full              390 844 light full   en
node $E/measure-page.cjs phone-dark-full               390 844 dark  full   en
node $E/measure-page.cjs desktop-light-full            1280 800 light full  en
node $E/measure-page.cjs desktop-dark-full             1280 800 dark  full  en
node $E/measure-page.cjs phone-light-simple-expanded    390 844 light simple en expand
node $E/measure-page.cjs phone-light-simple-zu-expanded 390 844 light simple zu expand
node $E/measure-page.cjs phone-light-full-expanded      390 844 light full   en expand
node $E/measure-page.cjs phone-dark-full-expanded       390 844 dark  full   en expand
node $E/measure-page.cjs reflow-320-light              320 568 light simple en
node $E/measure-page.cjs textscale-140-phone           390 844 light simple en no confirm 1.4
node $E/measure-page.cjs textscale-140-phone-zu        390 844 light simple zu no confirm 1.4
node $E/measure-page.cjs zoom-equivalent-640x400       640 400 light full   en no confirm 1 2
node $E/measure-page.cjs gate-phone-light              390 844 light simple en no gate
node $E/measure-page.cjs gate-phone-dark               390 844 dark  simple en no gate
node $E/measure-page.cjs gate-phone-zu                 390 844 light simple zu no gate

# 2. Keyboard (also writes sheet-<width>-light-<sheet>.png beside each file; those six by-products are not committed)
node $E/measure-keyboard.cjs 390 844 light
node $E/measure-keyboard.cjs 1280 800 light

# 3. Language comparison (needs the repository's alias loader for the crop catalogue)
node --import ./tests/register-alias.mjs $E/compare-language.mjs $OUT/phone-light-simple.json $OUT/phone-light-simple-zu.json $OUT/language-simple-default.json
node --import ./tests/register-alias.mjs $E/compare-language.mjs $OUT/phone-light-simple-expanded.json $OUT/phone-light-simple-zu-expanded.json $OUT/language-simple-all-sections-open.json
node --import ./tests/register-alias.mjs $E/compare-language.mjs $OUT/gate-phone-light.json $OUT/gate-phone-zu.json $OUT/language-country-hold.json

# 4. Screenshots and the weekly-target flow, then the size reduction used for the committed PNGs
OUT=/tmp/crop-plan-screens node $E/capture-screens.cjs
for f in /tmp/crop-plan-screens/*.png; do convert "$f" -strip -dither None -colors 160 "PNG8:$E/$(basename "$f")"; done
cp /tmp/crop-plan-screens/weekly-target-flow.json /tmp/crop-plan-screens/capture-log.json $E/measurements/
```

The static counts the record quotes (hardcoded colours, `font-mono`, inline sizes under 12px, dialog roles, Escape handlers) come from these, on `app/facilitator/crops/page.tsx`:

```bash
f=app/facilitator/crops/page.tsx
grep -o "#[0-9A-Fa-f]\{6\}\b" $f | wc -l          # hardcoded colours
grep -c 'font-mono' $f
grep -o "fontSize: *[0-9.]*" $f | awk -F: '$2+0 < 12 {c++} END {print c}'
grep -c 'role="dialog"' $f; grep -c 'Escape' $f; grep -c 'cropUi(' $f
```

## Limits a reader should keep in mind

- **Site climate.** The sample asks `/api/location-data` for its climate once the country is confirmed. When that answers 200 the fruit row draws two reference bars; when it does not, the view has 4 fewer controls and 13 fewer small text runs. A signed-out visitor is allowed 20 such calls an hour per server process, so restart the dev server between steps 1, 2 and 4. Every file records the status it got and whether the bars drew.
- **Contrast.** `declared` ratios are computed from styles, blended through ancestors. They cannot see a sibling painted under the text, such as the gold harvest cap on a crop bar. `pixel` ratios are read from a screenshot of the label's own box and are the ones to trust where the two differ. A pixel reading uses flat colours that fill at least 8% of the box, so anti-aliased glyph edges are ignored. It is a spot check, not a second complete count: a label the script could not bring into the window or find again after a redraw carries a `note` instead of a ratio, appears in `contrastFailuresNotPixelSampled`, and is not counted as confirmed. Totals in each file are declared-style counts for that one view and state.
- **Target size.** `targetsUnder24` applies WCAG 2.2 SC 2.5.8 with its inline, user-agent and spacing exceptions. The spacing test is a geometric approximation of the 24px-circle rule. `targets24to44` is this repository's 44px rule and is not a WCAG failure.
- **Text under 12px** is a readability flag against the repository's own floor. WCAG sets no minimum font size.
- **Language.** `compare-language.mjs` sorts unchanged text by published rules. It cannot tell sourced farming copy from an interface explanation, so it reports sentences as one group and lists every short label for checking. It counts; it does not judge the isiZulu.
- **Keyboard.** Each check starts from a new page. Counts of Tab presses depend on how many controls the page has at that moment, including the two reference bars. No screen reader was used.
- **App text size.** At text size 1.4 the app zooms the root element and the page shell becomes taller than the window. `scrollAreaShare` in the two `textscale-140` files is therefore not comparable with the other views; read `scrollAreaTopPx` and `scrollAreaHeightPx` against `windowHeightPx`. Sizes in those two files are in zoomed pixels.
- **Zoom.** `zoom-equivalent-640x400` is a 640×400 CSS-pixel window at device pixel ratio 2: the layout a 1280×800 window gets at 200% zoom. It is emulation. Real browser zoom was not exercised.
- **Not scripted.** The first pass on `84219245` (including accepting weekly-target proposals onto the calendar) is not reproduced here and is quoted in the record only where it says so. Which panel the "Unknown" cells sit in (CP-072) was attributed with a one-off walk of the page; the counts themselves are in the committed text corpus of the two `-expanded` files.
- **One run each.** Every file here is from a single run. Counts depend on the sample farm's data and the current month, so a rerun in another month will differ in the calendar's contents.
- **Devices.** Emulated viewports in headless Chromium. No physical phone, no other browser engine.
