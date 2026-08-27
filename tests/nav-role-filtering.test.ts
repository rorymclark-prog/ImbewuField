/*
 * THE MENUS MUST OFFER ONLY DOORS THAT OPEN.
 *
 * Four pages gate themselves by role (`canAccessRolePage`), and until now the two navigation
 * surfaces that link to them — components/NavDrawer.tsx and the "Dashboards" row on
 * app/home/page.tsx — offered every link to every role. A farmer tapping "NGO" landed on "This is
 * the NGO area". For the smallholder this was audited against, a refusal screen is indistinguishable
 * from having broken something, so a door she may not open must not be drawn at all.
 *
 * lib/role-access.ts now holds ROLE_GATED_ROUTES, a MIRROR of what those four pages declare inline.
 * The inline declaration stays the real gate — it belongs beside the code it protects — and this
 * file is the drift guard the mirror's comment promises: it reads the four pages, extracts their
 * `*_ALLOWED_ROLES` sets from source, and asserts the table still agrees with them exactly.
 *
 * WHY DRIFT IS ASYMMETRIC, AND BOTH DIRECTIONS ARE BUGS:
 *   • table NARROWER than the page → a user who is allowed in can no longer find the way in. The
 *     page works; the menu has quietly deleted it. Nothing errors, so nobody reports it.
 *   • table WIDER than the page → we are back to drawing doors that refuse, which is the bug this
 *     whole change exists to remove.
 * So the assertion is equality, not containment.
 *
 * Source-shape test, in the style of tests/paid-api-auth-wiring.test.ts: importing four 'use client'
 * page components into node:test to read a const off them would drag in Next's router, Firebase and
 * Mapbox for no gain. The invariant is about what the source DECLARES, which is checkable directly.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

/** Strip block and line comments, so prose about a rule never satisfies or breaks it. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** Pull `new Set<UserRole>(['a', 'b'])` out of a source file, as a sorted role list. */
function rolesIn(src: string, constName: string): string[] {
  const m = code(src).match(new RegExp(`${constName}\\s*=\\s*new Set<UserRole>\\(\\[([^\\]]*)\\]\\)`));
  assert.ok(m, `${constName} must be declared as an explicit new Set<UserRole>([...])`);
  return m[1].split(',').map((r) => r.trim().replace(/['"]/g, '')).filter(Boolean).sort();
}

/** The four gated pages, and the inline constant each one gates itself with. */
const GATED = [
  { href: '/network', file: 'app/network/page.tsx', constName: 'NETWORK_ALLOWED_ROLES' },
  { href: '/funder', file: 'app/funder/page.tsx', constName: 'FUNDER_ALLOWED_ROLES' },
  { href: '/mentor', file: 'app/mentor/page.tsx', constName: 'MENTOR_ALLOWED_ROLES' },
  { href: '/ngo', file: 'app/ngo/page.tsx', constName: 'NGO_ALLOWED_ROLES' },
] as const;

const roleAccess = read('lib/role-access.ts');

/** The mirror table in lib/role-access.ts, parsed back out of its own source. */
function registryTable(): Record<string, string[]> {
  const body = code(roleAccess);
  const block = body.match(/ROLE_GATED_ROUTES[^=]*=\s*Object\.freeze\(\{([\s\S]*?)\n\}\)/);
  assert.ok(block, 'ROLE_GATED_ROUTES must be an Object.freeze({...}) literal this test can read');
  const out: Record<string, string[]> = {};
  for (const m of block[1].matchAll(/'([^']+)':\s*new Set<UserRole>\(\[([^\]]*)\]\)/g)) {
    out[m[1]] = m[2].split(',').map((r) => r.trim().replace(/['"]/g, '')).filter(Boolean).sort();
  }
  return out;
}

test('the nav registry matches every page’s own gate, exactly', () => {
  const table = registryTable();
  for (const { href, file, constName } of GATED) {
    assert.ok(table[href], `${href} is gated by ${file} but missing from ROLE_GATED_ROUTES`);
    assert.deepEqual(
      table[href], rolesIn(read(file), constName),
      `${href}: the nav registry and ${file}'s ${constName} disagree. ` +
      'Narrower hides a page the user may open; wider draws a door that refuses. Fix both together.',
    );
  }
});

test('no page gates itself without appearing in the registry', () => {
  // The failure this catches is a NEW gated page: someone adds app/whatever/page.tsx with its own
  // canAccessRolePage() call and never tells navigation, so the link is offered to everyone again.
  const known = new Set<string>(GATED.map((g) => g.file));
  const pages = readdirSync(join(ROOT, 'app'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => `app/${d.name}/page.tsx`);
  const gatedNow: string[] = [];
  for (const p of pages) {
    let src: string;
    try { src = read(p); } catch { continue; }               // not every app/ dir has a page.tsx
    if (/canAccessRolePage\(/.test(code(src))) gatedNow.push(p);
  }
  assert.ok(gatedNow.length >= GATED.length, 'expected to find the four known role-gated pages');
  const unregistered = gatedNow.filter((p) => !known.has(p));
  assert.deepEqual(unregistered, [],
    'these pages gate themselves by role but are not in ROLE_GATED_ROUTES, so both menus still ' +
    'offer them to everyone. Add them to lib/role-access.ts AND to GATED in this file.');
});

test('both navigation surfaces actually call the gate', () => {
  // The registry is inert until something asks it. Each surface was unfiltered before this change,
  // in a different way, so each is asserted separately rather than by a shared grep.
  const drawer = code(read('components/NavDrawer.tsx'));
  assert.match(drawer, /canSeeNavLink\(role,/, 'NavDrawer must filter its items through canSeeNavLink');
  assert.match(drawer, /items\.length > 0/,
    'NavDrawer must drop a section whose items all filtered out — an empty heading is a dead end');

  const home = code(read('app/home/page.tsx'));
  assert.match(home, /canSeeNavLink\(role,/, 'the home Dashboards row must filter through canSeeNavLink');
  assert.match(home, /useAuth\(\)/, 'the home page must read the role it filters by');
  assert.ok(/\{\s*user\s*,\s*role\s*\}\s*=\s*useAuth\(\)/.test(home) || /role\s*\}\s*=\s*useAuth\(\)/.test(home),
    'the home page must destructure `role` from useAuth — filtering by an undefined role hides nothing');
});

test('an unknown role is shown gated links, and a resolved wrong role is not', () => {
  // This is the one behavioural rule in the file, and it is deliberate rather than incidental:
  // `role` is null both when signed out (the demo tour must still show the dashboards) and for a
  // beat while a profile loads (hiding then reappearing reads as a glitch on a slow phone).
  const body = code(roleAccess);
  const fn = body.match(/export function canSeeNavLink[\s\S]*?\n\}/);
  assert.ok(fn, 'canSeeNavLink must exist');
  assert.match(fn[0], /if \(role === null\) return true/,
    'canSeeNavLink must show gated links for an unresolved role — the page gate is what protects it');
  assert.match(fn[0], /if \(!allowed\) return true/,
    'a route absent from the table is ungated and must always be shown');
  assert.match(fn[0], /split\('\?'\)/,
    'the query string must be stripped, or /farmer?panel=Reports would never match /farmer');
});

/*
 * ── the Journal label ────────────────────────────────────────────────────────
 * Same audit, different finding, guarded here because it is the same class of lie: the home tile
 * said "Log harvests" over a store with no weight field and no sale field, so a harvest logged
 * there was invisible to every figure the app reports. The fix was the label, not the store —
 * lib/field-journal.ts is a diary, deliberately localStorage-only so sample mode sandboxes it.
 */
test('the Journal tile does not promise to record harvests', () => {
  const en = read('lib/i18n.tsx');
  const desc = en.match(/homeQuickJournalDesc:\s*'([^']*)'/);
  assert.ok(desc, 'homeQuickJournalDesc must exist in the English dictionary');
  assert.doesNotMatch(desc[1], /harvest/i,
    'the Journal stores notes and photos, not weights. A tile that says "Log harvests" sends a ' +
    'farmer to record her yield somewhere no report will ever read it. Weights live in /records.');

  // And no locale may re-introduce it: the claim had been faithfully translated into all ten, which
  // is how a false statement gets ten times harder to withdraw.
  const dir = join(ROOT, 'lib/locales');
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
    const src = read(`lib/locales/${f}`);
    assert.doesNotMatch(src, /homeQuickJournalDesc:/,
      `${f} redefines homeQuickJournalDesc. It is pending review in JOURNAL_ENGLISH_PENDING and ` +
      'must stay English until a speaker writes the true sentence — never the old harvest claim.');
  }
});

test('the Journal says on screen where it saves, and where weights go instead', () => {
  const view = code(read('components/journal/FieldJournal.tsx'));
  assert.match(view, /journalLocalOnlyNote/, 'the Journal must state that entries stay on the phone');
  assert.match(view, /journalWeightsLiveElsewhere/, 'it must say where harvest weights actually go');
  assert.match(view, /href="\/records"/, 'and link there — telling her without a way is not a fix');
});

test('the example entries do not teach her to record a yield in the diary', () => {
  // The label was only half the lie. The first thing a farmer with no entries sees is the example
  // card, and it read "Cabbage harvested — 6 heads … weighed 9 kg" — a worked demonstration of
  // putting a harvest weight into a store that has no weight field, shown directly beneath the
  // new line saying weights go elsewhere. An example outranks a caption.
  const src = read('components/journal/FieldJournal.tsx');
  const block = src.match(/EXAMPLE_JOURNAL_ENTRIES[^=]*=\s*\[([\s\S]*?)\n\];/);
  assert.ok(block, 'EXAMPLE_JOURNAL_ENTRIES must be a readable array literal');
  const examples = code(block[1]);
  assert.doesNotMatch(examples, /\d+\s?kg/i,
    'no example may show a weight being recorded in the Journal — that is what /records is for');
  assert.match(examples, /My Records/,
    'the harvest example should say where the weight actually went, so the split is demonstrated ' +
    'rather than only asserted in the note above it');
});
