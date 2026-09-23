# Course 4 look — "Clay Market"

**Why this look:** money is abstract; clay makes it touchable. Plasticine miniatures — coins,
tins, a spaza shop, a market table, the case families as clay figures — match the course's
hands-on counters and play money, and stop-motion animates very well in Flow.

**Money rule:** never reproduce real South African banknotes or coins (Reserve Bank rules on
reproducing currency). Show **generic clay notes and coins in plain colours** — the value
(R10, R20 …) is typeset on the layout, never drawn.

## Palette

| Role | Name | Hex |
|---|---|---|
| Background | Cream clay | `#FFF4E0` |
| Ink / outlines on layouts | Charcoal | `#2B2B2B` |
| Accent 1 — money in, positive | Teal | `#2A8C82` |
| Accent 2 — money out, caution | Coral | `#E0664A` |
| Accent 3 — savings, highlights | Mustard | `#E3A72F` |
| Plants | Clay green | `#6FA34A` |
| Section slides | Plum | `#4B2E4F` |

## Type for layouts
- Headlines: **Baloo 2 ExtraBold** (Google Fonts) — round and friendly, great for numbers.
- Labels & body: **Nunito Sans Bold**.
- Money in = teal, money out = coral, everywhere, so colour means the same thing all course
  (plus an arrow shape, so it still works in black & white).

## Recurring characters (clay figures)
- **The Dlamini household** — Mam' Dlamini (mid 40s, orange headwrap, apron), her mother Gogo
  (70s, walking stick, blanket over shoulders), two children (8 and 14, school uniform in plain
  grey), Mr Dlamini (50, works away — appears only in some scenes).
- **Mr Mokoena** — late 50s, farmer who sells at the taxi rank, brown hat, bakkie.
- **Sizanani Youth Garden** — four young members (19–26) in matching plain green T-shirts.

## Image anchor (ChatGPT)
```
Style: stop-motion claymation miniature photographed in a small studio set. Everything is made of
matte plasticine with visible fingerprints and soft edges: clay people, clay vegetables, clay tins,
generic clay coins and plain coloured clay banknotes (NOT real South African currency). Soft
warm studio lighting, shallow depth of field, cheerful colours: cream background (#FFF4E0), teal
(#2A8C82), coral (#E0664A), mustard (#E3A72F), leaf green (#6FA34A). Setting details from rural
South Africa: a spaza shop counter, a market table, a corrugated-iron house, a JoJo-style tank.
Clay people are Black South Africans of mixed ages. If outdoors: SOUTHERN HEMISPHERE, sun in the
NORTH. ABSOLUTELY NO TEXT, numbers or symbols on notes, coins, signs, labels or books.
```

## Animation anchor (Google Flow)
```
Stop-motion claymation, slightly stepped motion like 12 frames per second, matte plasticine with
fingerprints, soft warm studio light, miniature set, cheerful colours (cream, teal, coral,
mustard, green). Generic clay coins and plain clay notes, never real currency. Clay people are
Black South Africans. Fixed camera or a slow push-in. No text, numbers or symbols on screen.
No dialogue, no voice-over, no music (silent clip).
```

## Do / don't
- Do: tins labelled only by an icon (house, seedling, savings pot), counters, stacks, arrows.
- Don't: real banknotes, bank logos, dollar signs, graphs with numbers inside the art.

## Deck theme (read by the build script)
```json
{"bg": "FFF4E0", "ink": "2B2B2B", "accent": "2A8C82", "accent2": "E0664A",
 "section_bg": "4B2E4F", "section_ink": "FFF4E0", "head_font": "Baloo 2", "body_font": "Nunito Sans",
 "fallback_head": "Arial Rounded MT Bold", "fallback_body": "Calibri"}
```
