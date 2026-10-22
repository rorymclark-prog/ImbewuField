import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// WHY DARK MODE ONLY HALF-WORKED.
//
// globals.css carries two overlapping families of colour token. One is theme-aware: --bg-0/1/2,
// --border, --text-primary/secondary/muted, --gold, --blue, --emerald and the rest are declared
// once per theme column, so they change when the theme does. The other — --color-card,
// --color-paper, --surface-2, --text, --text-2, --text-3, --brand, --surface, --bg — is declared
// in `:root` ONLY. Those never change. They read like design tokens and behave like constants.
//
// Reaching for the wrong family is invisible in light mode, because in earth light the two
// families hold nearly the same values. It only shows up in dark mode, as a card that stayed
// white under text that went pale, or ink that stayed dark on a ground that went black. That is
// exactly what /calendar was: a light page with a black tab bar.
//
// So this file asserts the property that matters — every token used to paint a SURFACE, TEXT or
// BORDER on a farmer's screen is declared in all four theme columns. A token that is not cannot
// be used for those jobs, whatever its name suggests.

const CSS = fileURLToPath(new URL('../app/globals.css', import.meta.url));

const COLUMNS = [
  'html[data-theme="earth"]',
  'html[data-theme="earth"].dark',
  'html[data-theme="slate"]',
  'html[data-theme="slate"].dark',
];

/**
 * Tokens the components reach for when painting a surface, text or a border. Each must resolve to
 * a different value per theme, or the thing it paints will not follow the theme.
 *
 * This is not every token in the file — an accent used only as a FILL under fixed white type
 * (--ochre) is deliberately constant, and so is anything on a permanently dark panel.
 */
const MUST_BE_THEME_AWARE = [
  '--bg-0', '--bg-1', '--bg-2', '--bg-3',
  '--border', '--border-bright', '--border-strong',
  '--text-primary', '--text-secondary', '--text-muted',
  '--color-forest-800', '--color-forest-700', '--color-muted',
  '--gold', '--gold-dim', '--blue', '--emerald', '--orange', '--teal', '--violet',
  '--color-sage-100', '--input-bg',
];

/** Tokens that are `:root`-only by design. Naming them here is the warning, not an exemption. */
const ROOT_ONLY_BY_DESIGN = [
  '--color-card', '--color-paper', '--surface-2',
  '--text', '--text-2', '--text-3',
  '--brand', '--surface', '--bg', '--ochre',
];

type Blocks = Map<string, Map<string, string>>;

/** Every top-level block's declarations, last-one-wins within a block, comments stripped. */
function declarations(css: string): Blocks {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks: Blocks = new Map();
  let selector: string | null = null;
  for (const raw of withoutComments.split('\n')) {
    const line = raw.trim();
    const opens = line.match(/^([^{}]+)\{\s*$/);
    if (opens) { selector = opens[1].trim(); continue; }
    if (line.startsWith('}')) { selector = null; continue; }
    if (!selector) continue;
    const decl = line.match(/^(--[\w-]+)\s*:\s*([^;]+);/);
    if (!decl) continue;
    if (!blocks.has(selector)) blocks.set(selector, new Map());
    blocks.get(selector)!.set(decl[1], decl[2].trim());
  }
  return blocks;
}

/** What `token` resolves to for `column`: its own declaration, else the `:root` it inherits. */
function resolved(blocks: Blocks, column: string, token: string): string | undefined {
  return blocks.get(column)?.get(token) ?? blocks.get(':root')?.get(token);
}

test('every token used for a surface, text or border changes with the theme', () => {
  const blocks = declarations(readFileSync(CSS, 'utf8'));
  const stuck: string[] = [];

  for (const token of MUST_BE_THEME_AWARE) {
    const values = COLUMNS.map((c) => resolved(blocks, c, token));
    const missing = COLUMNS.filter((c, i) => values[i] === undefined);
    assert.equal(
      missing.length, 0,
      `${token} is not declared for ${missing.join(', ')} — components paint surfaces and text `
        + 'with it, so every column needs its own value.',
    );
    // Light and dark within a theme must differ, or the token is constant where it matters most.
    for (const [light, dark] of [[0, 1], [2, 3]] as const) {
      if (values[light] === values[dark]) {
        stuck.push(`${token}: ${COLUMNS[light]} and ${COLUMNS[dark]} are both ${values[light]}`);
      }
    }
  }

  assert.deepEqual(
    stuck, [],
    'these tokens hold the same value in a theme\'s light and dark columns, so anything painted '
      + `with them will not follow the theme:\n${stuck.map((s) => `  ${s}`).join('\n')}`,
  );
});

test('the :root-only tokens are still :root-only, so nobody mistakes them for theme tokens', () => {
  // The mirror of the test above. If one of these ever gains a per-column override it becomes a
  // theme token and belongs in MUST_BE_THEME_AWARE; until then, painting with it is a bug, and
  // this assertion is what makes that statement true rather than a comment.
  const blocks = declarations(readFileSync(CSS, 'utf8'));
  for (const token of ROOT_ONLY_BY_DESIGN) {
    const overridden = COLUMNS.filter((c) => blocks.get(c)?.has(token));
    assert.deepEqual(
      overridden, [],
      `${token} now has a per-column value (${overridden.join(', ')}). That makes it theme-aware: `
        + 'move it into MUST_BE_THEME_AWARE above rather than leaving this list wrong.',
    );
  }
});

test('the two families really do look alike in earth light — which is why this test exists', () => {
  // Pins the trap itself. --color-card and --bg-1 are the same colour in the theme everyone
  // develops in, and different in the one nobody checks; that is the entire failure mode.
  const blocks = declarations(readFileSync(CSS, 'utf8'));
  const earth = 'html[data-theme="earth"]';
  const earthDark = 'html[data-theme="earth"].dark';
  assert.equal(resolved(blocks, earth, '--color-card'), resolved(blocks, earth, '--bg-1'));
  assert.notEqual(resolved(blocks, earthDark, '--color-card'), resolved(blocks, earthDark, '--bg-1'));
});

// ═══════════════════════════════════════════════════════════════════════════════════
// swarm/w13-staff-dark — consumer-side scan.
//
// The tests above prove the TOKENS resolve per theme. They cannot see whether a component
// actually reaches for one. sdesk-01 / staff-01 / dark-01 were a regression of exactly that:
// components/MelDashboard.module.css (and the other staff-dashboard CSS modules sharing its
// shape) painted .root/.card/.notice/.compact/.cyclePanel/.attention and the form controls with
// literal light hex ('#eff4ef' page, 'white' cards, '#e5eff8' notices, ...), so every staff
// dashboard — /mentor, /ngo, /funder, /assessments, /reports, /samples — rendered as a full light
// sheet between a dark header and a dark bottom nav. Fixed by routing those declarations through
// var(--bg-0/1/2), var(--border), var(--text-primary/secondary/muted), var(--emerald) and
// var(--badge-bg); tinted fills (notices, the "due" tag, the "attention" panel) use
// color-mix(in srgb, var(--token) X%, var(--bg-0)) since no themed "soft" variant of
// --blue/--gold exists yet and these all already resolve per theme.
//
// This scan covers the files this track owns and fixed. It is a flat text scan like
// tests/staff-theme-tokens.test.ts / tests/ngo-dashboard-theme.test.ts — it cannot see contrast
// or rendering, only that a banned literal hasn't crept back in.

const read = (rel: string) => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');

/** Strip `var(--token, #fallback)` fallbacks before scanning — they're deliberate (see
 *  components/Illustration.tsx for the existing convention), not a literal override. */
function stripVarFallbacks(src: string): string {
  return src.replace(/var\(\s*--[\w-]+\s*,\s*#[0-9A-Fa-f]{3,8}\s*\)/g, 'var(--fallback-stripped)');
}

function findHexHits(src: string): { hex: string; line: number; text: string }[] {
  const hits: { hex: string; line: number; text: string }[] = [];
  const stripped = stripVarFallbacks(src);
  stripped.split('\n').forEach((text, i) => {
    const matches = text.match(/#[0-9A-Fa-f]{3,8}\b/g) ?? [];
    for (const hex of matches) hits.push({ hex: hex.toUpperCase(), line: i + 1, text: text.trim() });
  });
  return hits;
}

/** Each owned file, and the literal hex it is still deliberately allowed to carry: solid
 *  permanently-dark brand bands (the forest `.hero`/`.head` panels and their fixed white/light
 *  type, same precedent as tests/staff-theme-tokens.test.ts's ALLOWED_HEX), the `.ink` print-style
 *  variant and `@media print` blocks (paper is paper on purpose), and decorative near-transparent
 *  shadow tints. None of these are the "half dark" bug: they are already dark (or already paper)
 *  in every theme, not a surface that stayed light. */
const OWNED_FILE_ALLOWED_HEX: Record<string, string[]> = {
  'components/MelDashboard.module.css': [
    '#214D35', '#245739', '#FFF', '#18342706',
  ],
  'components/FieldWork.module.css': [
    '#214D35', '#FFF', '#F0F6ED', '#D6E8BE', '#183427',
  ],
  'components/ProgrammeProgress.module.css': [],
  'components/ProgrammeReport.module.css': [
    '#173E2C', '#FFF', '#E7F1E9', '#183427', '#254F36', '#405747', '#364C3D', '#334D3C',
    '#1738270A',
  ],
  'components/DashboardTabs.module.css': [],
  'components/SampleExperience.module.css': [
    '#245739',
  ],
};

for (const [relativePath, allowed] of Object.entries(OWNED_FILE_ALLOWED_HEX)) {
  const allowedSet = new Set(allowed.map((h) => h.toUpperCase()));
  test(`${relativePath} carries no un-themed hex colour outside its deliberate brand/print exceptions`, () => {
    const src = read(relativePath);
    const hits = findHexHits(src).filter((h) => !allowedSet.has(h.hex));
    assert.deepEqual(
      hits, [],
      hits.length
        ? `Found hard-coded hex colour(s) in ${relativePath} that bypass the theme system:\n`
          + hits.map((h) => `  line ${h.line}: ${h.hex}  —  ${h.text}`).join('\n')
          + '\nRoute these through var(--bg-0/1/2), var(--border), var(--text-primary/secondary/'
          + 'muted), var(--emerald) or var(--badge-bg) instead, or add a justified entry to '
          + 'OWNED_FILE_ALLOWED_HEX in this test.'
        : undefined,
    );
  });
}

const CONSUMER_FILES_FOR_ROOT_ONLY = [
  'components/MelDashboard.module.css',
  'components/MelDashboard.tsx',
  'components/DashboardTabs.module.css',
  'components/DashboardTabs.tsx',
  'components/FieldWork.module.css',
  'components/ProgrammeProgress.module.css',
  'components/ProgrammeReport.module.css',
  'components/FieldTeams.tsx',
  'components/ProgrammeEvidence.tsx',
  'components/SampleProgramme.tsx',
  'components/funder/CohortDashboard.tsx',
  'components/SampleExperience.module.css',
];

test('none of this track\'s owned files paint a surface, border or text with a :root-only constant', () => {
  const offenders: string[] = [];
  for (const relativePath of CONSUMER_FILES_FOR_ROOT_ONLY) {
    const src = read(relativePath);
    const pattern = new RegExp(`var\\(\\s*(${ROOT_ONLY_BY_DESIGN.map((t) => t.replace('-', '\\-')).join('|')})\\s*[,)]`, 'g');
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(src))) {
      offenders.push(`${relativePath}: var(${m[1]})`);
    }
  }
  assert.deepEqual(
    offenders, [],
    offenders.length
      ? `Found a :root-only token used for a surface/text/border — it will not follow the theme:\n`
        + offenders.map((o) => `  ${o}`).join('\n')
      : undefined,
  );
});

// ═══════════════════════════════════════════════════════════════════════════════════
// swarm/w14-dark-leftovers — this track's consumer-side scan.
//
// dark-05 / nav-01 / dark-10: the Design Studio picker (app/design/page.tsx's EmptyState), the
// "design is safe" rescue page (app/design/lite/page.tsx) and the /partners landing page
// rendered fully light in dark mode because they painted page chrome with literal hex (or the
// :root-only bg-paper/bg-card/text-ink Tailwind constants) instead of theme tokens. Fixed by
// routing the PAPER/DARK constants and the hairline/muted-ink literals through
// var(--bg-0/1), var(--border), var(--text-primary/secondary/muted) and
// var(--on-forest)/var(--color-forest-800) for the forest-brand text/border cases. The Design
// Studio CANVAS itself (satellite imagery, floating tool palettes drawn over the map) is
// explicitly out of scope — only the plain-page chrome this track touched is checked here.
//
// dark-11 / code-17: the /samples/production example and its ChatPanel/Screenshot consumers used
// the :root-only --bg/--surface/--surface-2/--text/--text-2/--text-3 family (same trap as the
// wave-13 staff-dark bug above) plus literal pastel calendar-cell colours that stayed pale in
// dark mode. Fixed by routing to --bg-0/1/2 and --text-primary/secondary/muted, and by rebuilding
// the harvest/stored/reference calendar-cell colours as color-mix(in srgb, var(--emerald|--gold)
// X%, var(--bg-1)) so the hue-coding adapts with the theme instead of staying a fixed pale tint.

const W14_BANNED_LITERAL_HEX: Record<string, RegExp[]> = {
  'app/design/page.tsx': [/#FFFEFA\b/i, /#0B120B\b/i, /#E2D8C4\b/i, /#C9BFAD\b/i],
  'app/design/lite/page.tsx': [
    /#E4DCC6\b/i, /#FBF6EC\b/i, /#E2D8C4\b/i, /#20190F\b/i, /#5C5040\b/i, /#755942\b/i,
    /#FDF4E3\b/i, /#E8D5A8\b/i,
  ],
  'app/partners/page.tsx': [/#E2D8C4\b/i],
  'app/samples/production/ProductionExample.module.css': [
    /#56834e\b/i, /#c99d35\b/i, /#a47627\b/i, /#dce9d5\b/i, /#f2e4bb\b/i, /#fcf7ea\b/i,
    /#a3bb98\b/i, /#d5bd7e\b/i, /#b58f4a\b/i, /#70511a\b/i, /#815e23\b/i,
  ],
};

for (const [relativePath, patterns] of Object.entries(W14_BANNED_LITERAL_HEX)) {
  test(`${relativePath} does not reintroduce the literal hex this track replaced with theme tokens (w14 dark-leftovers)`, () => {
    const src = read(relativePath);
    for (const pattern of patterns) {
      assert.doesNotMatch(src, pattern, `${relativePath} should use a theme token instead of ${pattern}`);
    }
  });
}

// GOLD_DIM may only read var(--gold-dim) in app/design/page.tsx because PAPER was made
// theme-aware (var(--bg-1)) in the same commit — unlike components/design/SectorSummary.tsx /
// TankCalculator.tsx (tests/design-studio-ochre-text.test.ts), which keep a FIXED PAPER card and
// so must keep GOLD_DIM fixed at #7A4408 too (dark mode's --gold-dim is ~2.6:1 on a card that
// never goes dark). If either constant in app/design/page.tsx reverts without the other, text
// goes near-invisible in one theme. This pins the pairing, not just one half of it.
test('app/design/page.tsx keeps PAPER and GOLD_DIM paired as theme-aware tokens (ux-07/dark-05 — do not revert only one)', () => {
  const src = read('app/design/page.tsx');
  assert.match(src, /const PAPER = 'var\(--bg-1\)';/, 'PAPER must stay var(--bg-1) — GOLD_DIM below assumes the surface it sits on now follows the theme');
  assert.match(src, /const GOLD_DIM = 'var\(--gold-dim\)';/, 'GOLD_DIM must stay var(--gold-dim) now that PAPER follows the theme');
});

test('app/partners/page.tsx no longer paints its root/sections with the bg-paper/text-ink :root-only Tailwind constants (code-08)', () => {
  const src = read('app/partners/page.tsx');
  assert.doesNotMatch(src, /\bbg-paper\b/, 'bg-paper is a :root-only Tailwind constant (tailwind.config.ts) — use bg-[var(--bg-0)] instead');
  assert.doesNotMatch(src, /\btext-ink\b(?!-)/, 'text-ink is a :root-only Tailwind constant outside the fixed forest band — use text-[var(--text-primary)] instead');
});

const W14_CONSUMER_FILES_FOR_ROOT_ONLY = [
  'app/design/page.tsx',
  'app/design/lite/page.tsx',
  'app/partners/page.tsx',
  'components/partners/Screenshot.tsx',
  'components/ChatPanel.tsx',
];

test("none of w14 dark-leftovers' owned page files paint a surface, border or text with a :root-only constant", () => {
  const offenders: string[] = [];
  for (const relativePath of W14_CONSUMER_FILES_FOR_ROOT_ONLY) {
    const src = read(relativePath);
    const pattern = new RegExp(`var\\(\\s*(${ROOT_ONLY_BY_DESIGN.map((t) => t.replace('-', '\\-')).join('|')})\\s*[,)]`, 'g');
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(src))) {
      offenders.push(`${relativePath}: var(${m[1]})`);
    }
  }
  assert.deepEqual(
    offenders, [],
    offenders.length
      ? `Found a :root-only token used for a surface/text/border — it will not follow the theme:\n`
        + offenders.map((o) => `  ${o}`).join('\n')
      : undefined,
  );
});

// app/samples/production/ProductionExample.module.css deliberately keeps var(--brand,#1f4d2b)
// and var(--ochre) as FILLS (same precedent as every other forest/ochre fill in the app), so it
// is checked against a narrower list — the bg/surface/text family code-17 actually named — rather
// than the full ROOT_ONLY_BY_DESIGN scan above, which would also flag those intentional fills.
const W14_BG_SURFACE_TEXT_ONLY = ['--color-card', '--color-paper', '--surface-2', '--text-2', '--text-3', '--surface', '--text', '--bg'];

// ux-07: ochre used as TEXT (the /samples/production "...Field" wordmark) measures 2.54:1 on
// paper — CLAUDE.md's "ochre is a FILL" rule. var(--gold-dim) is the themed dim variant.
test('app/samples/production/ProductionExample.module.css no longer paints .brandField text with raw var(--ochre) (ux-07)', () => {
  const src = read('app/samples/production/ProductionExample.module.css');
  assert.match(src, /\.brandField \{ color:var\(--gold-dim\); \}/, '.brandField should read var(--gold-dim), not var(--ochre), for its text colour');
});

test("app/samples/production/ProductionExample.module.css does not paint a surface, border or text with the :root-only bg/surface/text family (code-17)", () => {
  const src = read('app/samples/production/ProductionExample.module.css');
  const offenders: string[] = [];
  const pattern = new RegExp(`var\\(\\s*(${W14_BG_SURFACE_TEXT_ONLY.map((t) => t.replace('-', '\\-')).join('|')})\\s*[,)]`, 'g');
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(src))) offenders.push(`var(${m[1]})`);
  assert.deepEqual(
    offenders, [],
    offenders.length
      ? `Found a :root-only bg/surface/text token — it will not follow the theme:\n${offenders.map((o) => `  ${o}`).join('\n')}`
      : undefined,
  );
});

// nav-12: .page scrolled the whole document sideways instead of letting only .calendarScroll
// (min-width:870px table) scroll internally; the h1's two phrases were joined with a <br> but no
// space, so flattened text (screen readers, this audit's own scraper) read "...farm.A year...".
test('app/samples/production/ProductionExample.module.css constrains horizontal overflow to .calendarScroll, not the whole .page (nav-12)', () => {
  const src = read('app/samples/production/ProductionExample.module.css');
  assert.match(src, /\.page \{[^}]*overflow-x:hidden/, '.page should clip horizontal overflow so only .calendarScroll scrolls sideways');
  assert.match(src, /\.calendarScroll \{[^}]*max-width:100%/, '.calendarScroll should be capped at 100% of its container');
});

test('app/samples/production/page.tsx\'s hero h1 has a space between its two stacked phrases, not just a <br> (nav-12/nav-17)', () => {
  const src = read('app/samples/production/page.tsx');
  assert.match(src, /<h1>A whole farm\.<br \/>\{' '\}A year of food\.<\/h1>/, 'the <br /> alone leaves no space in the flattened text content — add a literal space alongside it');
});

// dark-12: components/invoice/InvoiceDocument.tsx is a deliberately un-themed printed artefact
// (its own header comment explains why — dark-mode text fell to 2.89–3.48:1 on the sheet) and
// must stay that way; app/invoice/page.tsx frames it instead, so a bare white rectangle in dark
// mode reads as a deliberate paper preview rather than a broken card.
test('components/invoice/InvoiceDocument.tsx keeps its printed sheet un-themed on purpose (dark-12 — do not theme this file)', () => {
  const src = read('components/invoice/InvoiceDocument.tsx');
  assert.match(src, /background: '#FFFEFA', border: '1px solid #E2D8C4'/, 'the sheet itself must stay literal — see the file\'s own header comment');
});

test('app/invoice/page.tsx frames the un-themed invoice preview with a themed well instead of theming the sheet (dark-12)', () => {
  const src = read('app/invoice/page.tsx');
  assert.match(src, /invoice-preview[^`]*`\}\s*style=\{\{\s*background: 'var\(--bg-2\)'/, 'the preview wrapper should sit on a themed var(--bg-2) well');
  assert.match(src, /boxShadow: 'var\(--shadow-panel\)'/, 'the preview wrapper should carry a visible shadow so it reads as a deliberate frame');
});

// code-05: disabled invoice controls and the Save/Share/Print fills used fixed light hex
// (#DDD5C5/#755942/#5C5040, a stale rgba(226,216,196,…) disabled fill) that stayed light-on-light
// in dark mode, plus a hardcoded forest/ochre-notice pairing instead of the theme tokens already
// used right beside them.
test('app/invoice/page.tsx does not reintroduce the code-05 disabled/fill literals', () => {
  const src = read('app/invoice/page.tsx');
  for (const hex of [/#DDD5C5\b/i, /#755942\b/i, /#5C5040\b/i, /#EAF2EB\b/i, /#244E33\b/i, /rgba\(226,216,196/i]) {
    assert.doesNotMatch(src, hex, `app/invoice/page.tsx should use a theme token instead of ${hex}`);
  }
  // #9A6018 (CLAUDE.md's ochre-fill-under-white-text value) and #1F4D2B as var(--color-forest-800)'s
  // light-mode value are deliberate fixed fills elsewhere in this file and are not banned here.
});

// code-15: 18 outline-none utility classes had no focus-visible replacement, so the global
// :where(...):focus-visible ring (zero specificity) lost to the plain outline-none class and
// keyboard users got no focus indicator on any invoice field.
test('app/invoice/page.tsx pairs every outline-none with a focus-visible ring (code-15)', () => {
  const src = read('app/invoice/page.tsx');
  const bare = src.match(/outline-none(?! focus-visible:ring)/g) ?? [];
  assert.deepEqual(bare, [], 'every outline-none in this file must be paired with focus-visible:ring-2 focus-visible:ring-[var(--gold)]');
  const paired = (src.match(/outline-none focus-visible:ring-2 focus-visible:ring-\[var\(--gold\)\]/g) ?? []).length;
  assert.equal(paired, 18, 'expected all 18 outline-none fields to carry the focus-visible ring');
});

// copy-16: a failed sales-sync used to splice the raw JS/network error message straight into
// what the farmer sees ("Failed to fetch Reconnect and try again.").
test('app/invoice/page.tsx no longer shows a raw error.message to the farmer (copy-16)', () => {
  const src = read('app/invoice/page.tsx');
  assert.doesNotMatch(src, /\$\{error\.message\}/, 'a caught error\'s raw message should be console.error\'d, not interpolated into user-facing text');
});

// dark-14: the print-preview surround stayed a literal paper hex (#EDE7DB), so the empty band
// around the deliberately-white A4 sheet never followed the theme and read as a failed render.
// nav-13's scale-to-fit (SheetScaler) and the sample-mode toolbar padding were already fixed on
// main before this track started — not re-done here, just verified by the tests above.
test('app/facilitator/print/page.tsx themes its print-preview surround and captions the sheet (dark-14)', () => {
  const src = read('app/facilitator/print/page.tsx');
  // Scoped to the @media screen surround fix — the printed sheet's own content (bill-of-
  // quantities table border etc.) is deliberately literal, same as every other colour on that
  // sheet, and keeps its own #EDE7DB/#C7BCA6/#755942 on purpose.
  assert.match(src, /@media screen \{[^}]*body \{ background: var\(--bg-0\); \}/, 'the print-preview surround should follow the theme, not the literal paper hex');
  assert.match(src, /className="no-print"[^>]*>\s*Print preview/, 'the sheet should carry a "Print preview" caption so it reads as deliberate, not broken');
});

// desk-16: components/SampleExperience.module.css's .page h1 used clamp(28px,4vw,42px) while
// every other page uses DESIGN.md §0's Page H1 row (24/26/30, 600), so headings jumped in size
// between /feedback, /tips, /tour and their neighbours at desktop width.
test('components/SampleExperience.module.css\'s h1 matches the DESIGN.md §0 Page H1 scale (desk-16)', () => {
  const src = read('components/SampleExperience.module.css');
  assert.match(src, /\.page h1 \{ font:600 clamp\(24px,2\.4vw,30px\)\/1\.2 var\(--font-display\),serif; margin:16px 0; \}/, '.page h1 should use the shared 24/26/30 Page H1 scale, not a one-off larger clamp');
});

// nav-17: /design had no h1 at all (neither the empty-site picker nor the loaded studio view).
// /samples/production's h1 join-without-space is covered by the nav-12 test above; /partners
// already had a single h1 (its "long sentence truncates" sub-complaint did not reproduce in the
// current markup — no truncate/ellipsis/overflow-hidden class on it — so nothing to fix there).
test('app/design/page.tsx has exactly one h1 in each of its two render states (nav-17)', () => {
  const src = read('app/design/page.tsx');
  const matches = src.match(/<h1\b/g) ?? [];
  assert.equal(matches.length, 2, 'expected exactly two <h1> sites — EmptyState (no site) and the loaded studio header — never both in the same render');
});

// sdesk-03 / desk-13 (wave 15): pale literal fills kept their cream under theme-coloured text in
// dark. The exchange and atlas components paint with theme tokens; the /home coach gradient
// mixes gold into --bg-1; /example's completeness card follows the theme instead of a dark slab.
test('exchange and atlas components paint no literal paper/card fill (sdesk-03)', () => {
  const files = [
    'components/exchange/ExchangeBoard.tsx', 'components/exchange/ExchangeGuide.tsx',
    'components/exchange/ListingCard.tsx', 'components/exchange/NewListingForm.tsx',
    'components/exchange/ExchangeHeader.tsx', 'components/atlas/AtlasExplorer.tsx',
  ];
  const banned = /rgba\(\s*255\s*,\s*254\s*,\s*250|rgba\(\s*226\s*,\s*216\s*,\s*196\s*,\s*0\.[3-9]\d*\)\s*['"]\s*[,}]|#FFFEFA|#E2D8C4|#E4DCC6|#FBF6EC/i;
  const offenders: string[] = [];
  for (const f of files) read(f).split('\n').forEach((l, i) => { if (banned.test(l) && /background|fill/.test(l)) offenders.push(`${f}:${i + 1}`); });
  assert.deepEqual(offenders, []);
});

test('the /home next-step coach gradient and /example completeness card follow the theme', () => {
  assert.match(read('app/home/page.tsx'), /linear-gradient\(135deg, color-mix\(in srgb, var\(--gold\) 14%, var\(--bg-1\)\)/);
  assert.match(read('app/example/page.tsx'), /<CompletionScore inputs=\{DEMO_COMPLETION\} surface \/>/);
  assert.match(read('components/report/CompletionScore.tsx'), /bg: 'var\(--bg-1\)'/);
});
