// Node ESM customization hook: resolves this repo's Next.js '@/*' path alias (see tsconfig.json
// `paths`) to an absolute file URL under the repo root, so lib/*.ts modules that use `@/lib/...`
// imports (the codebase-standard style — see components/design/DesignGlossy.tsx and friends) can
// be exercised directly by `node --test`, not just by Next's webpack bundler.
//
// Also resolves extensionless relative specifiers ('./foo', '../foo') the same way Next's
// webpack bundler does. Node's own ESM resolver requires an explicit extension on relative
// specifiers, so modules written in the codebase's other common style — e.g. lib/user-sync.ts's
// `import { getFirebase } from './firebase/init'` — fail to resolve under plain `node --test`
// without this. Only kicks in when the default resolver can't find the bare specifier.
//
// Everything else (bare package specifiers like 'firebase/firestore') passes straight through
// to the default resolver. Registered via tests/register-alias.mjs (see package.json's "test" script).
// A folder specifier ('@/lib/crop-optimizer') resolves to that folder's index file, again
// matching webpack. Node's own resolver throws ERR_UNSUPPORTED_DIR_IMPORT for these, so this
// is purely additive: no import that resolves today changes, and a module folder can now be
// imported by the same path the app uses rather than by an '/index' spelling only tests need.
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = new URL('../', import.meta.url); // repo root (this file lives in tests/)
const EXTENSIONS = ['.ts', '.tsx', '.mts', '.mjs', '.js'];

function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function resolveFileOrIndex(base) {
  if (existsSync(base) && !isDirectory(base)) return base;
  for (const ext of EXTENSIONS) {
    if (existsSync(base + ext)) return base + ext;
  }
  if (isDirectory(base)) {
    for (const ext of EXTENSIONS) {
      if (existsSync(`${base}/index${ext}`)) return `${base}/index${ext}`;
    }
  }
  return undefined;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const resolvedPath = resolveFileOrIndex(fileURLToPath(new URL(specifier.slice(2), ROOT)));
    if (resolvedPath) return nextResolve(pathToFileURL(resolvedPath).href, context);
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
    try {
      return await nextResolve(specifier, context);
    } catch (err) {
      const resolvedPath = resolveFileOrIndex(fileURLToPath(new URL(specifier, context.parentURL)));
      if (resolvedPath) return nextResolve(pathToFileURL(resolvedPath).href, context);
      throw err;
    }
  }
  return nextResolve(specifier, context);
}
