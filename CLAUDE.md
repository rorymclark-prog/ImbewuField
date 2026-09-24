# CLAUDE.md — ImbewuField

Permaculture platform for South African smallholder farmers. Next.js 14 (App Router) ·
TypeScript · Tailwind · Firebase/Firestore · Mapbox GL · Anthropic (`claude-sonnet-4-6`).

## Read these first (in order)
1. **`PROGRESS.md`** — what's built, what's left, the build log. **Keep it updated after each iteration.**
2. **`design/DESIGN.md`** — design system + per-frame status (the source of truth for look & behaviour).
3. `design/BUILD-INSTRUCTIONS.md` + `design/MAP-TOOLS-CORRECTIONS.md` — the build brief & map fixes.
   Visual targets: `design/handoff/*.png` (33 frames), `design/mockups/`.

## Conventions (do not drift)
- **Roles:** farmer · mentor · student · ngo · funder (+admin). No "supervisor"/"trainer" — merged into **mentor**.
- **Fonts:** Newsreader (`font-display`) for headings/numbers; Public Sans (`font-sans`) for everything else. **No JetBrains Mono** in UI (`--font-mono` is aliased to Public Sans). **No emoji as UI icons** — Lucide only. (Emoji ARE fine inside Claude prompt strings in `app/api/*`.)
- **Palette:** Forest `#1F4D2B` · Mid-green `#2E6B3A` · Leaf `#A8D88A` · Ochre `#C07A1E` (primary CTA) ·
  Water `#235E86` · **Paper `#E4DCC6`** · **Card `#FFFEFA`** · Ink `#20190F` · Hairline `#E2D8C4`.
  Paper and Card were listed here as `#F7F2E9`/`#FBF6EC` while `tailwind.config.ts` and
  `globals.css` shipped `#E4DCC6`/`#FFFEFA`, and BOTH pairs were live in components — the
  darker page and near-white card are the ones DESIGN.md's "Option 1b contrast" decision
  actually chose, so those are the values.
- **Ochre is a FILL.** As text it is 2.54:1 on paper: ochre text is `#7A4408` (`--gold-dim`) and
  an ochre fill under white type is `#9A6018`. Leaf is a fill only (1.2:1 as text).
- **Don't hardcode a colour that has to follow the theme.** `--bg-0/1/2`, `--border`,
  `--text-primary/secondary/muted`, `--gold`, `--blue`, `--emerald`, `--orange`, `--violet` and
  the forest steps are declared per theme column and change with it. `--color-card`,
  `--color-paper`, `--text`, `--text-2`, `--text-3`, `--brand` and `--surface` are `:root`-only
  constants that look identical in earth light and do not move in dark — painting a surface or
  text with those is the bug `tests/theme-token-coverage.test.ts` exists to catch.
- **Responsive type:** never reuse phone px on desktop (see DESIGN.md §0 table). Use `clamp()` / `md:`/`lg:` breakpoints.
- **Home is task-first**, not role-first. No data-vendor badges in the UI.

## Working here
- Verify changes with `npx tsc --noEmit` before committing. Run the dev server to check UI.
- Deploy = push to `main` → GitHub Actions → Vercel (~2 min). Don't commit `.env*` or secrets.
- Env vars live in the Vercel project (mirrored from GitHub secrets via `.github/workflows/set-vercel-env.yml`).
