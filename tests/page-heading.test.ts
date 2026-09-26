import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// EVERY SCREEN SHOULD SAY WHAT IT IS.
//
// An <h1> is how a page announces its own name. It is invisible to a sighted reader — the title is
// usually already there in big type — but a screen-reader user navigates by jumping between
// headings, and "go to heading 1" on a page without one lands nowhere. The page is then unnamed:
// no announced title, nothing in the outline, nothing for a reader view to show.
//
// This app had 28 of 61 routes in exactly that state, because a page title drawn as
// `<span className="font-display">Atlas · global garden explorer</span>` looks identical to a
// heading and is not one. A previous pass fixed six of them and the claim "every page has an h1"
// was made on the strength of those six; it was wrong, and nothing was watching. Hence this file.
//
// WHY IT FOLLOWS IMPORTS. A page is often a thin wrapper — one line like
// `export { default } from '@/components/SomeScreen'`. Reading only
// page.tsx would call that a failure and push someone to add a second, duplicate heading. So the
// check asks the real question: starting at the route, is an <h1> reachable through the
// first-party modules it pulls in?

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const APP = path.join(ROOT, 'app');
const EXT = ['.tsx', '.ts'];

/**
 * Routes that render no markup at all, so there is nothing to put a heading on.
 *
 * These are server redirects: the body is `redirect('/somewhere')` and the reader never sees the
 * route. Anything added here needs that same justification — "it is hard" is not one, and a page
 * with a visible title and no h1 belongs fixed, not listed. A page whose design has no room for a
 * visible title gets `<h1 className="sr-only">` instead (see app/example/page.tsx).
 */
const RENDERS_NOTHING = new Set([
  'app/page.tsx',              // -> /home
  'app/plan/page.tsx',         // -> /facilitator/crops
  'app/facilitator/page.tsx',  // -> /design
  'app/finances/page.tsx',     // -> /records, forwarding its query string
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry === 'page.tsx') out.push(full);
  }
  return out;
}

/** Resolve an import specifier to a first-party file, or null for a package or an asset. */
function resolveImport(spec: string, fromFile: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = path.join(ROOT, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec);
  else return null;
  for (const e of EXT) if (existsSync(base + e)) return base + e;
  for (const e of EXT) {
    const index = path.join(base, `index${e}`);
    if (existsSync(index)) return index;
  }
  return null;
}

/** Whether an <h1> is reachable from `file` through first-party imports. Depth-bounded. */
function reachesHeading(file: string, seen = new Set<string>(), depth = 0): boolean {
  if (depth > 4 || seen.has(file)) return false;
  seen.add(file);
  let src: string;
  try { src = readFileSync(file, 'utf8'); } catch { return false; }
  if (/<h1[\s>]/.test(src)) return true;
  // Static `from '...'` and lazy `import('...')` both count: next/dynamic is how several of these
  // screens load the component that owns their heading.
  for (const m of [...src.matchAll(/from\s+'([^']+)'/g), ...src.matchAll(/import\('([^']+)'\)/g)]) {
    const resolved = resolveImport(m[1], file);
    if (resolved && reachesHeading(resolved, seen, depth + 1)) return true;
  }
  return false;
}

test('every route that renders anything reaches an h1', () => {
  const pages = walk(APP).sort();
  assert.ok(pages.length > 40, `expected to find the app routes, found ${pages.length}`);

  const missing = pages
    .map((p) => path.relative(ROOT, p).split(path.sep).join('/'))
    .filter((rel) => !RENDERS_NOTHING.has(rel))
    .filter((rel) => !reachesHeading(path.join(ROOT, rel)));

  assert.deepEqual(
    missing, [],
    'these routes render markup but no <h1> is reachable from them, so a screen reader has no '
      + `name for the page:\n${missing.map((m) => `  ${m}`).join('\n')}\n`
      + 'Turn the element that already looks like the page title into an <h1> (keep its classes '
      + 'and styles, add margin:0), or add <h1 className="sr-only"> when the design has no room '
      + 'for a visible one.',
  );
});

test('the redirect-only exemptions really do render nothing', () => {
  // The exemption list is the one way to pass this file without a heading, so it has to stay
  // honest: each entry must still be a redirect with no JSX. If one of these grows a real screen,
  // this fails and the route rejoins the check above.
  for (const rel of RENDERS_NOTHING) {
    const src = readFileSync(path.join(ROOT, rel), 'utf8');
    assert.match(src, /redirect\(/, `${rel} is exempt as a redirect but no longer calls redirect()`);
    assert.ok(
      !/<[a-z][a-z0-9]*[\s/>]/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')),
      `${rel} is exempt as rendering nothing, but it now renders JSX — give it an h1 and remove `
        + 'it from RENDERS_NOTHING.',
    );
  }
});
