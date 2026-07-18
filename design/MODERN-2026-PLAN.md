# ImbewuField × Modern-2026 — application plan

Source: portable spec `~/Claude/design/MODERN-2026-SPEC.md` + a 4-lane Fable research swarm
(wf_be7fa254-38c). Directive: **apply the spec, keep the earthy palette, err WARM not cold-tech**
(audience = SA smallholder farmers, many first-time smartphone users).

## The load-bearing fact
Token layers exist (`--color-*`, `--bg-*/--emerald`, Tailwind `forest/ochre`) but are **bypassed**:
~4,650 hardcoded hex literals in ~3,637 inline `style={{}}` blocks across ~92 files. A token-value
swap reaches <5% of call-sites. **So the foundation is a scoped hex→`var(--token)` codemod**, after
which every later spec pass is a one-file edit.

**Canvas landmine:** 9 files paint to `<canvas>`/mapbox (`ctx.fillStyle='#…'` does NOT resolve CSS
`var()`). The codemod is **DOM-only** (property-anchored `color/background/border/boxShadow: '#hex'`);
canvas/print draw colours move to a JS `lib/palette.ts` constant instead, never `var()`.

## Locked decisions (from the lanes)
- **forest #1F4D2B = the sole interactive accent** (buttons/focus/active). **ochre #C07A1E demoted**
  to status-warning + seasonal only. Text/entities never wear the brand as decoration.
- **Type: KEEP Newsreader** (the almanac serif is the anti-SaaS differentiator) + Public Sans
  (400/600/700). Add serif-tuned display scale (−0.015/−0.02em) + `tabular-nums` on all data. No mono.
- **Warm shadows** — card throw is forest-tinted `rgba(22,56,32,.14)`, never slate/blue-grey.
  1px inset top-highlight = "lit from above". Radius vocab **8 / 12 / 20 / pill** only.
- **Glass = Lima AI panel only** (+ `@supports` solid fallback for low-end Androids).
- **Warm guardrails (override the spec on any conflict):** 44px+ touch floor · 17px+ body ·
  12px micro-label floor · always-labelled filled icons (never bare line-icons / burger-only) ·
  **keep the full-width labelled tab bar** (NOT a floating pill — targets + clarity) ·
  status = word + dot + 15% tint · motion aids spatial comprehension, never carries meaning ·
  amplify the earthy palette, don't dilute it ("Duolingo shape language, grown up").

## Phases
- **P0 foundation (single-writer, me):** add Modern-2026 token set + `.card/.btn/.sheet` primitives +
  motion keyframes + reduced-motion + display scale + tabular-nums to globals.css (token values =
  EXACT current hexes → zero colour change); `lib/palette.ts` for canvas files. Then the DOM-only
  codemod. Gate: tsc+build + confirm `ctx.*` hexes untouched. **Colour-neutral checkpoint.**
- **P0b the modern lift (small diff, cascades):** upgrade the primitives — warm card shadow + inset,
  radius normalise, warmer `--bg`, button gradient. This is where it starts to *feel* 2026.
- **P1 signature surfaces (Sonnet swarm, ranked impact/effort):** 1 `/login` two-radial-glow moment ·
  2 shared sheet-rise motion pack + grabbers · 3 TabBar glass treatment (full-width kept) ·
  4 Lima AI pack (green-gradient FAB + glow, warm-glass panel, shimmer, word-reveal — token
  streaming already exists ChatPanel:136) · 5 DesignAdvisor dark-glass · 6 home hero settle.
- **Verify:** live 375px, light-first; dark theme is a separate deliberate sweep, not half-shipped.

## Risks
Codemod false-positives (fill/stroke ambiguity → excluded; canvas → excluded); the legacy
`--bg-0/--emerald` theme-switcher layer must be re-pointed, not deleted; `.text-xs !important`
overrides constrain CSS order; PWA cache (hard-refresh). i18n: all new copy via lib/i18n.
