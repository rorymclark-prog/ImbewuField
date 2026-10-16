# Production guide — images, animations, posters and decks (isiZulu + English)

Everything the courses need to look finished: ~400 media items, 90 bilingual posters and
10 decks per language. The work list is **`courses/media-manifest.json`** (built by
`python3 scripts/courses/build.py`). Every `NEW` item already carries a complete, ready-to-paste
**`prompt`** with its course's own look baked in.

## 1. Each course has its own look

| Course | Look | Style file |
|---|---|---|
| Grow Food, Grow Strong | **Linocut Garden** — 3-ink relief print | `farmer-5day/style.md` |
| Walking With Farmers | **Field Notes** — warm 35 mm documentary photo | `mentor-3day/style.md` |
| Teach the Teachers | **Chalk & Kraft** — marker/chalk sketch-notes | `teach-the-teachers/style.md` |
| Farmer Money | **Clay Market** — stop-motion claymation | `farmer-money/style.md` |
| AI Literacy | **Comic Panels** — ink, halftone, empty bubbles | `ai-literacy/style.md` |

None of them is the botanical-watercolour-on-cream look of the in-app student course. Each style
file holds the palette, fonts, recurring characters, an **image anchor** (ChatGPT/Gemini) and an
**animation anchor** (Flow/Veo), plus the deck theme the build script uses.

## 2. Who makes what

| Media | Made by | How |
|---|---|---|
| **Images** (slide images, cards, poster art, photos) | **Rory, in ChatGPT** | Paste from `courses/build/<course>/prompts-images.md` |
| **Animations** | **Claude in Google Flow**, driven through the Chrome connector in a local session (or the Veo API script) | `prompts-animations.md` / `generate-media.py` |
| **Infographic posters** (finished, isiZulu + English lettering) | **Rory, in ChatGPT** | Paste from `courses/build/<course>/prompts-posters.md` |
| **Decks** | the build script | isiZulu + English, per-course theme |

### Images — ChatGPT (your separate billing)
`courses/build/<course>/prompts-images.md` has one block per image, with the course's look
baked in and the exact file name to save it under.
- One ChatGPT chat **per course**. First make a **character sheet** (the recurring characters in
  that course's `style.md`, side by side) and attach it to later prompts so faces stay the same.
- Save each image at the path printed above its prompt (e.g.
  `public/course-media/farmer-5day/F-P06-ART.jpg`), commit, and run
  `python3 scripts/courses/build.py` — the decks swap the placeholders for your images.

### Animations — Google Flow via Chrome (Claude runs it)
In a Claude Code session on Rory's computer with the Chrome connector and Flow signed in, Claude
pastes each block from `prompts-animations.md` into Flow (Text to Video, 16:9), extends multi-shot
items in Scenebuilder, downloads, strips audio, saves a still and commits. Two test clips first.

Alternative — Veo API, no browser:
```bash
python3 scripts/courses/generate-media.py --course farmer-5day --limit 2   # animations only by default
python3 scripts/courses/build.py
```
Needs `GEMINI_API_KEY` in the cloud environment (environment settings → Edit → environment
variables; the key the app uses in Vercel works). Veo makes ~8-second shots; longer items are
made as 8 s shots (extend later if needed). Clips are made silent, 1280×720, with a still `.jpg`.
Veo is billed per second of video — run one course at a time and check the look first.
`prompts-animations.md` has the same prompts if you ever want to run a clip by hand in Flow.

## 3. Rules for every image and clip

1. **Southern hemisphere** — sun in the north, shadows fall south.
2. **No text inside artwork or video.** Words are typeset afterwards, in isiZulu and English.
3. **Generic plant shapes** unless the crop must be recognised; never an invasive species.
4. **People look like the learners**; recurring characters stay the same across a course.
5. **Money:** never real SA banknotes or coins (Farmer Money uses generic clay money).
6. **AI-generated people** (Walking With Farmers photos) carry the caption
   "AI-generated illustration" and are never presented as real participants.
7. **AI is never a robot or a person** in AI Literacy — it is the cyan "guesser" shape.
8. Sizes: slide images 1600×900 ≤ 250 KB; cards 2:3 ≤ 250 KB; poster art 3:4 master PNG +
   JPG ≤ 800 KB; clips 1280×720, silent, ≤ 3 MB, plus a still `.jpg`.

## 4. Posters: bilingual, isiZulu first

**Quickest route:** `courses/build/<course>/prompts-posters.md` — one block per poster with the
course's own poster look (lettering, banner, label style differ per course), the picture, and the
exact isiZulu and English words. Check every word after generating; image models misspell,
especially isiZulu. For a crisp A1 print, rebuild the lettering in a layout tool using the same
words (below).

Layout per `poster-standards.md` (grid, ≤ 25 words per language) with the course's fonts and
palette from `style.md`. Text comes from the manifest: each `poster` item has English
(`headline`, `labels`) and isiZulu (`zu.headline`, `zu.labels`, `zu.question`) — sourced from
`<course>/i18n/zu.json`. isiZulu headline on top, English beneath at ~60%.

Exports per poster: print PDF (A1/A0 + 3 mm bleed) at `target`, phone JPG at `phone_target`,
editable source under `public/course-media/<course>/posters/src/`, and the A5 back card
(`<ID>-card.pdf`, English teach-it notes; isiZulu card later).

## 5. Languages

- **English and isiZulu first.** The build makes `<deck>.pptx` (English) and `<deck>.zu.pptx`
  (isiZulu slide text, English speaker notes) wherever `<course>/i18n/zu.json` exists.
- Every isiZulu file is a **draft** until a first-language speaker who farms has read it back.
  Fix wording in the JSON, re-run the build.
- Next languages as programmes need them: add `i18n/st.json` (Sesotho), `ss.json` (siSwati),
  `ts.json`, `nso.json`, `xh.json` in the same shape; the build will need one line to include
  them (`langs` in `build.py`).

## 6. QA before committing

- [ ] Sun north, shadows south  - [ ] No text hidden in art (zoom in)  - [ ] Characters consistent
- [ ] Right course look  - [ ] Sizes/weights  - [ ] Clip silent + still frame
- [ ] Poster words match the manifest, both languages  - [ ] `build.py --check` → 0 problems
