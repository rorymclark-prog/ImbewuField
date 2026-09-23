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

## 2. Three ways to make the media (pick per batch)

### Route A — automatic, straight into the repo (recommended)
`scripts/courses/generate-media.py` calls Google's Gemini API: the Gemini image model for
images and **Veo — the model behind Google Flow — for animations**. Files land at their
`target` paths with the right names.

1. Add `GEMINI_API_KEY` to the Claude Code cloud environment (environment settings → Edit →
   environment variables). The key the app already uses in Vercel works. Never paste it in chat.
2. Start small, check the look, then scale:
   ```bash
   python3 scripts/courses/generate-media.py --course farmer-5day --kind poster-art --limit 3
   python3 scripts/courses/build.py        # decks now show the new art
   ```
3. Costs money per call (Veo far more than images) — budget per course before running all.
   Model ids can be overridden with `IMAGE_MODEL` / `VEO_MODEL`.

### Route B — by hand in Google Flow + ChatGPT (separate billing)
The build writes two paste-ready packs per course:
- `courses/build/<course>/prompts-images.md` → ChatGPT (image mode) or Gemini.
- `courses/build/<course>/prompts-animations.md` → Google Flow (Text to Video).

Tips that keep a course consistent:
- One ChatGPT chat per course. First generate a **character sheet** (all recurring characters
  from `style.md`, side by side) and a **style swatch**; attach both to every later prompt.
- In Flow, save the character sheet as an **Ingredient**; use **Frames to Video** from the last
  frame to continue a clip; Flow shots are ~8 s — items marked with 2–3 shots are extended in
  **Scenebuilder**. Export MP4, mute audio, keep a still frame (`.jpg`, same name).
- Save each file at the path printed above its prompt, commit, run the build.

### Route C — Canva (works from Claude today)
Claude can generate images in your Canva account through the Canva connector (a linocut test
for F-P06 is already in your Canva). Files stay in Canva — download them and save at the
target paths. Canva is also the natural place to lay out the bilingual posters (§4).

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
