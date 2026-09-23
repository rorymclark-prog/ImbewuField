# Course 5 look — "Comic Panels"

**Why this look:** this course is full of stories — a scam voice note, a wrong answer, a
question asked well. Comic panels tell a story in 3–4 pictures, work for low literacy, and
speech bubbles can be left empty for us to fill in isiZulu or English. **AI is never drawn as a
robot or a person** (the course teaches that it is neither): it is a small glowing rounded speech
shape with three dots — "the guesser".

## Palette (bright print-comic)

| Role | Name | Hex |
|---|---|---|
| Ink outlines | Comic black | `#111111` |
| Background / paper | White | `#FFFFFF` |
| Accent 1 — the AI guesser, phones | Cyan | `#1FA3C8` |
| Accent 2 — danger, scams, stop | Magenta | `#D6336C` |
| Accent 3 — check, safe, good | Yellow | `#F7C948` |
| Halftone shadow | Light grey dots | `#BDBDBD` |
| Section slides | Night | `#1B1F3B` |

## Type for layouts
- Headlines: **Bangers** (Google Fonts) — comic lettering; headlines only.
- Labels, bubbles & body: **Atkinson Hyperlegible Bold**.
- Traffic-light meaning is constant: yellow = OK to ask AI, magenta = stop, ask a person.

## Recurring characters
- **Thabo** — 19, student, hoodie, earphones round his neck, cracked-screen Android phone.
- **Mam' Grace** — mid 50s, spaza shop owner, floral apron, reading glasses on her head, careful.
- **Gogo Nomvula** — 70s, church hat, sharp mind, never had a smartphone before this course.
- **The guesser** — a small cyan rounded speech shape with three dots and a soft glow. No face,
  no body, no eyes.
- **The scammer** — only ever a shadowy phone screen or a silhouette; never a real-looking person.

## Image anchor (ChatGPT)
```
Style: bold comic-book panel illustration, thick black ink outlines, flat bright colours with
halftone-dot shading, white background, slight paper texture. Palette: black (#111111), cyan
(#1FA3C8), magenta (#D6336C), yellow (#F7C948), halftone grey. Expressive faces and clear body
language. People are Black South Africans of mixed ages in everyday township and rural settings
(spaza shop, taxi rank, kitchen, garden). Phones shown with plain glowing screens.
"The AI" is only ever a small cyan rounded speech shape with three dots — never a robot, face or
person. Speech bubbles and phone screens are EMPTY. If outdoors: SOUTHERN HEMISPHERE, sun in the
NORTH. ABSOLUTELY NO TEXT, letters or numbers anywhere, including bubbles, screens and signs.
```

## Animation anchor (Google Flow)
```
Motion-comic animation: bold comic panels with thick black ink lines, flat cyan, magenta and
yellow colours and halftone shading; subtle parallax, panels sliding in, speech bubbles popping
in EMPTY, phone screens glowing. Characters are Black South Africans. The AI appears only as a
small glowing cyan speech shape with three dots, never a robot or person.
No readable text or letters on screen. No dialogue, no voice-over, no music (silent clip).
```

## Do / don't
- Do: 3–4 panel stories, empty bubbles, clear emotions, the guesser shape.
- Don't: robots, glowing brains, sci-fi circuits, real app logos (WhatsApp, Google etc.), text.

## Deck theme (read by the build script)
```json
{"bg": "FFFFFF", "ink": "111111", "accent": "1FA3C8", "accent2": "D6336C",
 "section_bg": "1B1F3B", "section_ink": "F7C948", "head_font": "Bangers", "body_font": "Atkinson Hyperlegible",
 "fallback_head": "Impact", "fallback_body": "Verdana"}
```
