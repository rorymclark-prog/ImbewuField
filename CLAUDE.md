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
- **Palette:** Forest `#1F4D2B` · Mid-green `#2E6B3A` · Leaf `#A8D88A` · Ochre `#C07A1E` (primary CTA) · Water `#235E86` · Paper `#F7F2E9` · Card `#FBF6EC` · Ink `#20190F` · Hairline `#E2D8C4`.
- **Responsive type:** never reuse phone px on desktop (see DESIGN.md §0 table). Use `clamp()` / `md:`/`lg:` breakpoints.
- **Home is task-first**, not role-first. No data-vendor badges in the UI.

## Working here
- Verify changes with `npx tsc --noEmit` before committing. Run the dev server to check UI.
- Deploy = push to `main` → GitHub Actions → Vercel (~2 min). Don't commit `.env*` or secrets.
- Env vars live in the Vercel project (mirrored from GitHub secrets via `.github/workflows/set-vercel-env.yml`).
