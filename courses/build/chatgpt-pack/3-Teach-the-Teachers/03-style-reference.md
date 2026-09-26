# Course 3 look — "Chalk & Kraft"

**Why this look:** trainees on this course learn to make their own posters by hand. The course
itself looks hand-made: marker and chalk sketch-notes on brown kraft paper and blackboards,
sticky notes, arrows, doodle icons. It shows them what "good enough to teach from" looks like.

## Palette

| Role | Name | Hex |
|---|---|---|
| Kraft paper background | Kraft | `#C9A77C` |
| Blackboard (section slides, some posters) | Board | `#2F3A33` |
| Chalk / white marker | Chalk | `#F2EFE6` |
| Marker 1 — key lines | Marker black | `#1C1C1C` |
| Marker 2 — emphasis | Marker red | `#D2452C` |
| Marker 3 — water, calm | Marker blue | `#2C6FB7` |
| Marker 4 — highlight | Marker yellow | `#F2C230` |
| Sticky notes | Note yellow | `#FFE680` |

## Type for layouts
- Headlines: **Kalam Bold** (Google Fonts) — handwritten but legible.
- Labels & body: **Nunito Bold**.
- Keep real handwriting to the headline only; labels stay clean for translation.

## Recurring characters
- **Mandla** (trainer) — early 30s, shaved head, round glasses, rolled-up denim shirt, marker in
  hand, often squatting beside a group rather than standing in front.
- **Trainees** — a mixed group of 8: young graduates, an older lead farmer in a hat, a woman
  with a baby on her back, a man with a walking stick.

## Image anchor (ChatGPT)
```
Style: hand-drawn sketch-note illustration made with thick markers and chalk on brown kraft paper
(#C9A77C) — or chalk on a dark green-black blackboard (#2F3A33) when stated. Confident marker
outlines in black, highlights in red (#D2452C), blue (#2C6FB7) for water only, and yellow
(#F2C230); simple doodle icons, arrows, stars, yellow sticky notes and masking-tape corners.
Loose, friendly, clearly hand-made, like a great trainer's flipchart. Figures are simple but
expressive; people are Black South Africans of mixed ages and genders. If the outdoors appears:
SOUTHERN HEMISPHERE, sun in the NORTH, shadows fall SOUTH.
ABSOLUTELY NO WORDS OR LETTERS anywhere — sticky notes and flipcharts are blank or show only
icons and scribble-lines.
```

## Poster anchor (full poster with isiZulu + English text, for ChatGPT)
```
Finished A1 teaching poster in the CHALK & KRAFT style: brown kraft paper (#C9A77C) with
masking-tape corners, drawn with thick black marker (#1C1C1C), red (#D2452C), blue (#2C6FB7, water
only) and yellow highlighter (#F2C230); doodle icons, arrows, stars. LETTERING: big friendly
hand-lettered marker headline (like Kalam Bold), neat and very legible; labels written on yellow
sticky notes (#FFE680) stuck beside numbered marker circles. It should look like the best flipchart
a trainer ever made — and one a trainee could copy by hand.
```

## Animation anchor (Google Flow)
```
Hand-drawn whiteboard / chalk-talk animation on brown kraft paper: marker lines draw themselves
on, icons pop in, arrows sweep, sticky notes slap onto the page. A hand holding a marker may
appear. Flat, top-down, fixed camera. Colours: black marker, red, blue (water only), yellow.
No readable text or letters on screen. No dialogue, no voice-over, no music (silent clip).
```

## Do / don't
- Do: visible paper texture, tape, imperfect lines, one idea per sheet.
- Don't: polished vector icons, watercolour, photographs, printed-looking fonts inside the art.

## Deck theme (read by the build script)
```json
{"bg": "C9A77C", "ink": "1C1C1C", "accent": "D2452C", "accent2": "2C6FB7",
 "section_bg": "2F3A33", "section_ink": "F2EFE6", "head_font": "Kalam", "body_font": "Nunito",
 "fallback_head": "Segoe Print", "fallback_body": "Trebuchet MS"}
```
