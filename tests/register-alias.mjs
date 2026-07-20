// Entry point for `node --import` (see package.json's "test" script): registers the '@/*' alias
// resolver hook so `node --test` can load lib/*.ts modules that use Next.js-style `@/lib/...`
// imports. See resolve-alias-hooks.mjs for what it actually does.
import { register } from 'node:module';

register('./resolve-alias-hooks.mjs', import.meta.url);
