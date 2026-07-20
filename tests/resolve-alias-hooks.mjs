// Node ESM customization hook: resolves this repo's Next.js '@/*' path alias (see tsconfig.json
// `paths`) to an absolute file URL under the repo root, so lib/*.ts modules that use `@/lib/...`
// imports (the codebase-standard style — see components/design/DesignGlossy.tsx and friends) can
// be exercised directly by `node --test`, not just by Next's webpack bundler.
//
// Only handles bare '@/' specifiers; everything else passes straight through to the default
// resolver. Registered via tests/register-alias.mjs (see package.json's "test" script).
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = new URL('../', import.meta.url); // repo root (this file lives in tests/)
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.mjs', '.js'];

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const base = fileURLToPath(new URL(specifier.slice(2), ROOT));
    let resolvedPath = existsSync(base) ? base : undefined;
    if (!resolvedPath) {
      for (const ext of EXTENSIONS) {
        if (existsSync(base + ext)) {
          resolvedPath = base + ext;
          break;
        }
      }
    }
    if (resolvedPath) return nextResolve(pathToFileURL(resolvedPath).href, context);
  }
  return nextResolve(specifier, context);
}
