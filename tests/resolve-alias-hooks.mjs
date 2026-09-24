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
// The same extensionless problem exists for BARE specifiers into a package that publishes no
// `exports` map: Next 14 ships next/navigation.js and no exports field, so webpack finds
// 'next/navigation' by adding the extension and Node's ESM resolver refuses it outright
// ("Did you mean to import next/navigation.js?"). Any test whose module graph reaches a client
// component that calls usePathname() therefore died at import time — not on an assertion, which
// makes it read as an unrelated crash. Same rule as above: only ever after the default resolver
// has already failed, so a package that resolves normally is never second-guessed.
//
// Everything else passes straight through to the default resolver. Registered via
// tests/register-alias.mjs (see package.json's "test" script).
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
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
    try {
      return await nextResolve(specifier, context);
    } catch (err) {
      const base = fileURLToPath(new URL(specifier, context.parentURL));
      for (const ext of EXTENSIONS) {
        if (existsSync(base + ext)) {
          return nextResolve(pathToFileURL(base + ext).href, context);
        }
      }
      throw err;
    }
  }
  // Bare specifier ('next/navigation', 'some-pkg/sub'). Let the default resolver try first; only
  // if it cannot find the module do we retry with each extension appended, exactly as the
  // relative-specifier branch above does. A specifier with its own extension is left alone.
  if (!specifier.startsWith('.') && !specifier.startsWith('@/') && specifier.includes('/')) {
    try {
      return await nextResolve(specifier, context);
    } catch (err) {
      if (err?.code !== 'ERR_MODULE_NOT_FOUND') throw err;
      for (const ext of EXTENSIONS) {
        try {
          return await nextResolve(specifier + ext, context);
        } catch { /* try the next extension */ }
      }
      throw err;
    }
  }

  return nextResolve(specifier, context);
}
