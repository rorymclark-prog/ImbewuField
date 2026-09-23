# Course 2 look — "Field Notes"

**Why this look:** mentoring is about real people and real places. Warm documentary photography
— the feel of a 35 mm film camera carried on a farm visit — makes the relationship the subject.
For posters, photos are paired with hand-drawn notebook marks (circles, arrows, ticks) so the
facilitator can point at them. Not watercolour, not flat illustration.

**Honesty rule:** these are AI-generated photographs of people who do not exist. Every slide and
poster that uses one carries the small caption "AI-generated illustration" (the app already does
this). Never present them as real programme participants.

## Palette (for layouts and overlays)

| Role | Name | Hex |
|---|---|---|
| Ink | Charcoal | `#232323` |
| Accent (notebook marks, callouts) | Field orange | `#D9622B` |
| Secondary | Sky | `#6E9CC4` |
| Soil | Umber | `#6B4A2F` |
| Background | Notebook paper | `#FAF7F0` |
| Section slides | Dusk | `#2E3440` |

## Type for layouts
- Headlines: **Lora Bold** (Google Fonts).
- Labels & body: **Source Sans 3 Semibold**.
- Notebook annotations are drawn marks only (circle, arrow, tick) — words are typeset.

## Recurring characters
- **Zanele** (mentor / extension officer) — early 40s, short natural hair, wide-brim khaki sun
  hat, olive utility shirt, small notebook and pen, a phone in a chest pocket. Listens more than
  she talks.
- **Baba Mthembu** — mid 60s, grey beard, flat cap, checked shirt, walking stick; proud of his
  garden, sceptical at first.
- **Lindiwe** — 22, hair in a puff, yellow T-shirt, jeans; new farmer, uses a phone.
- A **cluster group** of 8–10 neighbours of mixed ages.

## Image anchor (ChatGPT)
```
Style: warm documentary photograph, shot on 35 mm film (Kodak Portra look), natural morning or
late-afternoon light, gentle grain, shallow depth of field, honest and unposed — people mid-task
and mid-conversation, not smiling at the camera. Real rural KwaZulu-Natal homestead gardens:
corrugated-iron roofs, JoJo-style water tank, droppers and wire fencing, mulched beds, red soil,
rolling green hills. SOUTHERN HEMISPHERE: sun in the NORTH, shadows fall SOUTH.
People: Black South African smallholders and a mentor, mixed ages and genders, everyday work
clothes, dignified. Leave calm, uncluttered space on one side of the frame for text.
ABSOLUTELY NO TEXT: no signs, logos, labels, writing on clothes, packets or tanks.
```

## Poster anchor (full poster with isiZulu + English text, for ChatGPT)
```
Finished A1 teaching poster in the FIELD NOTES style: a warm 35 mm documentary photograph
(Kodak Portra look, natural light) fills most of the poster, as if taped onto a page of a field
notebook (#FAF7F0, faint ruled lines). Orange (#D9622B) hand-drawn marker circles and arrows point
to things in the photo. LETTERING: headline in an elegant bold serif (like Lora) in charcoal
(#232323); labels printed on small torn notebook-paper strips taped next to numbered orange circles.
A tiny caption bottom-right: 'AI-generated illustration'. Rural KwaZulu-Natal homestead; sun in the
NORTH, shadows SOUTH.
```

## Animation anchor (Google Flow)
```
Documentary film look, 35 mm, natural light, gentle handheld camera with slow movement, shallow
depth of field. Rural KwaZulu-Natal homestead garden, sun in the north, shadows to the south.
Real, unposed moments between a mentor and farmers. No text on screen, no logos.
No dialogue, no voice-over, no music (silent clip; ambient sound will be removed).
```

## Do / don't
- Do: eye-level framing, hands doing things, faces listening, the garden in the background.
- Don't: stock-photo smiles, handshakes to camera, clipboards held like inspectors, text.

## Deck theme (read by the build script)
```json
{"bg": "FAF7F0", "ink": "232323", "accent": "D9622B", "accent2": "6E9CC4",
 "section_bg": "2E3440", "section_ink": "FAF7F0", "head_font": "Lora", "body_font": "Source Sans 3",
 "fallback_head": "Georgia", "fallback_body": "Calibri"}
```
