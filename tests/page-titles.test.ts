// nav-16 / copy-13 (wave 13 audit): ~39 of 51 EN routes shared the one root <title> ("ImbewuField
// — permaculture planning for South African farmers"), so a mentor with several tabs open
// couldn't tell them apart in the tab bar, history or share sheet. Every route is a 'use client'
// page, so it cannot export its own metadata — the fix is a small server app/<route>/layout.tsx
// per segment that only exports `metadata = { title }`.
//
// This test walks every app/**/page.tsx and fails when the route has no way to get a distinct
// title: no metadata/generateMetadata of its own, no non-root ancestor layout title, no legacy
// document.title assignment (app/pitch/page.tsx's existing pattern), and isn't a pure
// server-redirect (app/finances/page.tsx — the destination page carries the title instead).
//
// Run with:
//   node --import ./tests/register-alias.mjs --test tests/page-titles.test.ts

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const APP_ROOT = new URL('../app', import.meta.url).pathname;

type LayoutTitle = { kind: 'inherit' } | { kind: 'title'; value: string } | { kind: 'unsupported' };
function staticLayoutTitle(source: string): LayoutTitle {
  const tree = ts.createSourceFile('layout.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  for (const statement of tree.statements) {
    if (!ts.canHaveModifiers(statement) || !ts.getModifiers(statement)?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === 'generateMetadata') return { kind: 'unsupported' };
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === 'generateMetadata') return { kind: 'unsupported' };
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== 'metadata') continue;
      const metadata = declaration.initializer;
      if (!metadata || !ts.isObjectLiteralExpression(metadata)) return { kind: 'unsupported' };
      // A spread/computed key could override title. This check handles the
      // actual static layouts, rather than pretending to execute metadata code.
      if (metadata.properties.some(property => ts.isSpreadAssignment(property)
        || property.name && ts.isComputedPropertyName(property.name))) return { kind: 'unsupported' };
      const titles = metadata.properties.filter(property => property.name
        && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) && property.name.text === 'title');
      if (!titles.length) return { kind: 'inherit' };
      if (titles.length !== 1 || !ts.isPropertyAssignment(titles[0])) return { kind: 'unsupported' };
      const value = titles[0].initializer;
      return ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)
        ? { kind: 'title', value: value.text } : { kind: 'unsupported' };
    }
  }
  // Re-exported metadata is outside the static rule too; do not silently walk
  // past an unknown override and certify an older ancestor instead.
  if (tree.statements.some(statement => ts.isExportDeclaration(statement) && statement.exportClause
    && ts.isNamedExports(statement.exportClause) && statement.exportClause.elements.some(element => element.name.text === 'metadata' || element.name.text === 'generateMetadata'))) return { kind: 'unsupported' };
  return { kind: 'inherit' };
}
function inheritedNonRootTitle(directory: string, appRoot: string, rootTitle: string,
  readLayout: (path: string) => string | undefined): boolean {
  if (!directory.startsWith(`${appRoot}/`)) return false;
  for (let current = directory; current !== appRoot; current = dirname(current)) {
    const source = readLayout(join(current, 'layout.tsx'));
    if (source === undefined) continue;
    const title = staticLayoutTitle(source);
    if (title.kind === 'unsupported') return false;
    if (title.kind === 'title') return !!title.value.trim() && title.value !== rootTitle;
  }
  return false;
}
function readLayout(path: string): string | undefined {
  try { return readFileSync(path, 'utf8'); } catch { return undefined; }
}

function findPages(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      findPages(full, out);
    } else if (entry === 'page.tsx') {
      out.push(full);
    }
  }
  return out;
}

// Routes this track does not own and cannot add a layout.tsx title to without stepping into
// another track's territory: app/cropplan/page.tsx and app/facilitator/crops/page.tsx belong to
// the crop/production planner (Codex-owned, explicitly off limits this wave). app/facilitator/
// print/page.tsx left this list in wave 15 (nav-16) with its own 'Printable plan' layout title.
// Tracked here, not silently skipped — a route leaving this list without gaining a real title
// should fail the test like any other regression.
const OUT_OF_SCOPE_THIS_WAVE = new Set([
  'cropplan/page.tsx',
  'facilitator/crops/page.tsx',
]);

test('every app route can produce a page title distinct from the root default', () => {
  const pages = findPages(APP_ROOT);
  const failures: string[] = [];
  const rootTitle = staticLayoutTitle(readFileSync(join(APP_ROOT, 'layout.tsx'), 'utf8'));
  assert.equal(rootTitle.kind, 'title', 'the root baseline must remain an inspected static title');
  if (rootTitle.kind !== 'title') return;
  for (const pagePath of pages) {
    const relPath = pagePath.slice(APP_ROOT.length + 1);
    if (OUT_OF_SCOPE_THIS_WAVE.has(relPath)) continue;
    const dir = dirname(pagePath);
    const src = readFileSync(pagePath, 'utf8');
    const hasOwnMetadata = /export const metadata|export (async )?function generateMetadata/.test(src);
    const hasDocumentTitle = /document\.title\s*=/.test(src);
    const isPureRedirect = /\bredirect\(/.test(src) && !/<h1[\s>]/i.test(src);
    if (hasOwnMetadata || hasDocumentTitle || isPureRedirect) continue;
    // Next 14.2.18 collects and merges ancestor metadata. The nursery worksheet's
    // saved hosted HTML emits its existing Language draft review ancestor title;
    // the old immediate-sibling-only rule falsely claimed it used the root title.
    // Root-only inheritance still fails: it caused the original indistinct tabs.
    if (!inheritedNonRootTitle(dir, APP_ROOT, rootTitle.value, readLayout)) failures.push(relPath);
  }
  assert.deepEqual(failures, [], 'these routes have no own title path or verified non-root inherited static title; unsupported metadata needs source review');
});

const SYNTHETIC_ROOT = '/synthetic-title-app';
const SYNTHETIC_ROOT_TITLE = 'Synthetic root default';
function inherits(layouts: Record<string, string>, directory = 'section/child') {
  return inheritedNonRootTitle(join(SYNTHETIC_ROOT, directory), SYNTHETIC_ROOT, SYNTHETIC_ROOT_TITLE,
    path => layouts[path.slice(SYNTHETIC_ROOT.length + 1)]);
}
const ancestor = "export const metadata = { title: 'Synthetic section title' };";

test('a nested page inherits a real non-root ancestor title without requiring duplicate child metadata', () => {
  assert.equal(inherits({ 'section/layout.tsx': ancestor }), true);
});
test('an intervening layout with unrelated exported metadata preserves the ancestor title', () => {
  assert.equal(inherits({ 'section/layout.tsx': ancestor,
    'section/child/layout.tsx': "export const metadata = { description: 'Synthetic description' };" }), true);
});
test('only the root title or an unrelated sibling title cannot distinguish a nested route', () => {
  assert.equal(inherits({ 'layout.tsx': "export const metadata = { title: 'Synthetic root default' };" }), false);
  assert.equal(inherits({ 'sibling/layout.tsx': ancestor }), false);
});
test('comments, ordinary strings and nested metadata titles are not exported page titles', () => {
  for (const source of ["// export const metadata = { title: 'Synthetic section title' };",
    "const example = \"export const metadata = { title: 'Example' };\";",
    "export const metadata = { description: 'title belongs in metadata' };",
    "export const metadata = { openGraph: { title: 'Synthetic social preview' } };"])
    assert.equal(inherits({ 'section/layout.tsx': source }), false, source);
});
for (const nearer of ['null', "''", "'   '", JSON.stringify(SYNTHETIC_ROOT_TITLE)]) {
  test(`a nearer explicit ${nearer} title cannot be rescued by an older ancestor`, () => {
    assert.equal(inherits({ 'section/layout.tsx': ancestor,
      'section/child/layout.tsx': `export const metadata = { title: ${nearer} };` }), false);
  });
}
test('unsupported nearer title code fails closed instead of certifying an older ancestor', () => {
  for (const source of ["export const metadata = { title: makeTitle() };",
    "export const metadata = { title: { template: '%s | Synthetic' } };",
    "export const metadata = { ...unknownMetadata };",
    "export { metadata } from './unknown-source';",
    "export const generateMetadata = async () => ({ title: 'Nearer dynamic title' });",
    "export function generateMetadata() { return computeMetadata(); }"])
    assert.equal(inherits({ 'section/layout.tsx': ancestor, 'section/child/layout.tsx': source }), false, source);
});

// w16-11: /manual and its sub-routes use the same 'Page name — ImbewuField' shape as every other
// route, not '·' separators.
test('manual route titles use the em-dash ImbewuField suffix', () => {
  const layout = readFileSync(join(APP_ROOT, 'manual/layout.tsx'), 'utf8');
  assert.match(layout, /title: 'Permaculture manual — ImbewuField'/);
  for (const rel of ['manual/[lang]/page.tsx', 'manual/[lang]/[slug]/page.tsx']) {
    const src = readFileSync(join(APP_ROOT, rel), 'utf8');
    const m = src.match(/generateMetadata[\s\S]*?title: (`[^`]*`)/);
    assert.ok(m, `${rel} must set a title in generateMetadata`);
    assert.ok(!m[1].includes('·'), `${rel} title still uses '·': ${m[1]}`);
    assert.ok(m[1].endsWith(' — ImbewuField`'), `${rel} title must end with ' — ImbewuField': ${m[1]}`);
  }
});
