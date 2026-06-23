# ImbewuField — Build Instructions for Claude Code

Read this fully **before** touching any screen. The numbered PNGs in this folder are
the visual source of truth. Build to match them. Where this doc and old repo code
disagree, **this doc wins** — do not re-skin the old structure.

---

## 0. The #1 recurring mistake: FONT SIZES ON DESKTOP

The phone mockups are ~392px wide. Their 24–26px text is correct **for phones only.**
On tablet/desktop you have been copying those same px values, making everything ~2× too big
(see the oversized nav, hero, and body in the last farmer-map screenshot).

**Rule: font-size scales with the viewport. Never reuse a phone screen's px on a wide layout.**

### Desktop web (≥1024px)
| Role | Size / weight | Font |
|---|---|---|
| Hero display | 40px / 600 | Newsreader |
| Page H1 | 30px / 600 | Newsreader |
| Section H2 | 22px / 600 | Newsreader |
| Top-nav items (Farmer, Mentor, Student…) | **16px / 600** | Public Sans |
| Body / paragraph | **16px / 400** | Public Sans |
| Buttons | 15px / 700 | Public Sans |
| Small / captions / map labels | 13px | Public Sans |
| Tab-bar labels | 12px | Public Sans |

### Tablet / iPad (768–1023px)
Same as desktop, except Hero **34px**, H1 **26px**.

### Phone (<768px) — matches the phone mockups, keep as-is
| Role | Size |
|---|---|
| Screen title | 24–25px / 600 (Newsreader) |
| Card heading | 16–17px |
| Body | 15px |
| Button | 15–16px / 700 |
| Label / overline | 11px (700, uppercase, letter-spacing .16em) |
| Tab bar | 10px |

Implement with breakpoints or `clamp()`. Example body:
`font-size: clamp(15px, 1.1vw, 16px);`  Hero: `clamp(28px, 3.4vw, 40px);`

---

## 1. Fonts
- **Newsreader** — all headings, screen titles, big numbers. weights 400/600.
- **Public Sans** — all UI, body, buttons, labels. weights 400/500/600/700/800.
- No JetBrains Mono / monospace anywhere in user-facing UI.
- No emoji as UI icons — use line icons (stroke 1.7–2, round caps).

## 2. Colour palette (exact)
| Token | Hex | Use |
|---|---|---|
| Forest green | `#1F4D2B` | primary, Lima, active nav, primary buttons |
| Mid green | `#2E6B3A` | income/positive, secondary green |
| Leaf accent | `#A8D88A` | on-dark highlights |
| Ochre | `#C07A1E` | primary CTA, overlines, the "do this" action |
| Cream / paper | `#F7F2E9` | app background |
| Warm sand | `#ECE4D2` / `#FBF6EC` | cards, inset panels |
| Ink | `#20190F` | primary text |
| Stone | `#5C4F3C` | secondary text |
| Muted | `#94876F` | captions / placeholders |
| Border | `#E2D8C4` / `#D8CBB2` | hairlines, card borders |
| Water blue | `#235E86` | water/rain elements only |

## 3. Information architecture — DO NOT revert to the old patterns
- **Home is TASK-FIRST, not role-first.** Lead with "Survey a new site", then My sites /
  Designs / Continue. Roles are a quiet "Switch role" link — NOT a six-button launcher.
- **Roles are: Farmer, Mentor, NGO, Funder, Student.** There is **no Supervisor and no
  Trainer** — they are merged into **Mentor**.
- **No data-vendor badges** in user-facing chrome (delete "NASA POWER · ISRIC soil ·
  SANBI veg · Claude AI" etc).

## 4. Lima (the AI guide)
- Present on every screen as a forest-green card / ask-bar with the sprout glyph.
- Always labelled "Lima:" in Newsreader, then plain-language advice in Public Sans.
- Lima sees the map, the design canvas, the photos, the journal, the finances — and
  comments contextually. Keep that voice: warm, short, isiZulu greetings ("Sawubona").

## 5. Responsiveness priority
Phone first → iPad second → laptop third. Every screen must work at all three.
Bottom tab bar on phone; left sidebar nav on laptop; the map tools become a bottom
sheet on phone and a docked glass panel on desktop.

---

## Image index (this folder)
See the numbered PNGs 01–32. Each is a labelled exploration; the caption strip at the
top of each is a *description*, not part of the UI. Build the device frames shown below it.
Key screens: 03 = correct task-first home, 19 = merged Mentor role, 15/16/28 = finance,
29/30/31/32 = crop plan + quantities + survey, 04/06/09 = site analysis & permaculture design.
