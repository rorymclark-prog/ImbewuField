# Course 1 look — "Linocut Garden"

**Why this look:** a relief print (linocut / woodblock) is bold, handmade and reads from 6 m. It
is already "3 inks", so it photocopies in black & white without losing meaning, and it feels like
something a community made, not a corporate brochure. It is deliberately **not** the watercolour
botanical style of the in-app student course.

## Palette (3 inks + paper)

| Role | Name | Hex |
|---|---|---|
| Key ink (all outlines, carved lines) | Carbon | `#1B1A17` |
| Ink 2 — plants, living things | Deep leaf | `#2F5D34` |
| Ink 3 — soil, warmth, callouts | Terracotta | `#B24E2A` |
| Ink 4 — sun, seed, highlights (sparingly) | Maize | `#E0A526` |
| Water only | Indigo | `#2B4F7E` |
| Paper | Rag paper | `#EFE6D2` |

## Type for layouts (posters, slides)
- Headlines: **Zilla Slab Bold** (Google Fonts) — slab serif, like carved letters.
- Labels & body: **Atkinson Hyperlegible** (Google Fonts) — designed for low vision.
- isiZulu headline on top, large; English below, 60% size (see `../shared/poster-standards.md`).

## Recurring characters (keep them the same in every image and clip)
- **Gogo Thandi** — about 68, round face, reading glasses on a cord, green headscarf, brown
  cardigan, long skirt, black gumboots. Calm, knowing.
- **Sipho** — about 24, slim, red cap worn backwards, navy overalls with rolled sleeves, sneakers.
  Energetic, first garden.
- **Nomsa** (facilitator) — about 35, braids tied up, plain mustard T-shirt (no logo), jeans,
  holds a rolled poster. Warm, points and asks.

## Image anchor (ChatGPT)
```
Style: hand-carved linocut relief print, 3-colour print on warm off-white rag paper (#EFE6D2).
Bold black carved outlines (#1B1A17) with visible gouge marks and slight ink texture; flat fills
in deep leaf green (#2F5D34), terracotta (#B24E2A) and small touches of maize yellow (#E0A526);
water only in indigo (#2B4F7E). Slight mis-registration between colours like a real hand print.
Simple, bold shapes readable from 6 metres; no gradients, no photorealism, no watercolour, no 3D.
Setting: rural KwaZulu-Natal, South Africa. SOUTHERN HEMISPHERE: the sun is in the NORTH and
shadows fall SOUTH. People are Black South African smallholders of mixed ages and genders in
work clothes. Generic plant shapes only (no recognisable invasive species).
ABSOLUTELY NO TEXT: no letters, numbers, labels, signs or watermarks anywhere in the image.
```

## Animation anchor (Google Flow)
```
Animated linocut print: every frame looks like a hand-carved 3-colour relief print on warm
off-white paper, with black carved outlines, visible gouge texture, flat green, terracotta and
maize-yellow fills, water in indigo. Motion is simple and readable, like printed paper cut-outs
moving: slow, clear, one action at a time. Fixed camera unless stated. Rural KwaZulu-Natal,
South Africa; sun in the north, shadows to the south. No text, no letters, no numbers on screen.
No dialogue, no voice-over, no music (silent clip).
```

## Do / don't
- Do: chunky shapes, lots of paper showing, one idea per frame, textures of carved wood/lino.
- Don't: watercolour washes, soft gradients, glossy 3D, photoreal faces, cream-and-serif slide
  look of the student course, any lettering.

## Deck theme (read by the build script)
```json
{"bg": "EFE6D2", "ink": "1B1A17", "accent": "B24E2A", "accent2": "2F5D34",
 "section_bg": "2F5D34", "section_ink": "EFE6D2", "head_font": "Zilla Slab", "body_font": "Atkinson Hyperlegible",
 "fallback_head": "Rockwell", "fallback_body": "Verdana"}
```
