// sec-09: `value in ALLOW_LIST` and `ALLOW_LIST[value]` walk the whole prototype chain, so
// '__proto__' or 'constructor' reads as an allowed key on any plain object literal even though it
// was never one of the entries. Object.hasOwn is the fix — pinned here both as the general
// property (demonstrated against the real STYLE_LINES export) and as a source-scan that the fixed
// call sites actually use it.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { STYLE_LINES } from '@/lib/producer-prompt';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

test('the vulnerability, demonstrated: `in` admits __proto__/constructor on a plain allow-list, Object.hasOwn does not', () => {
  const allowList: Record<string, string> = { a: 'x', b: 'y' };
  assert.equal('__proto__' in allowList, true, '`in` walks the prototype chain — this is the bug');
  assert.equal('constructor' in allowList, true);
  assert.equal(Object.hasOwn(allowList, '__proto__'), false);
  assert.equal(Object.hasOwn(allowList, 'constructor'), false);
  assert.equal(Object.hasOwn(allowList, 'a'), true);
});

test('STYLE_LINES itself admits neither __proto__ nor constructor as an own key', () => {
  assert.equal(Object.hasOwn(STYLE_LINES, '__proto__'), false);
  assert.equal(Object.hasOwn(STYLE_LINES, 'constructor'), false);
  assert.ok(Object.keys(STYLE_LINES).length > 0);
});

const SITES: Array<{ file: string; needle: string }> = [
  { file: 'app/api/image-producer/route.ts', needle: 'Object.hasOwn(STYLE_LINES, body.stylePreset)' },
  { file: 'app/api/image-producer/route.ts', needle: 'Object.hasOwn(GEMINI_MODELS, body.model)' },
  { file: 'app/api/ai-render/route.ts', needle: 'Object.hasOwn(GEMINI_MODELS, body.geminiModel)' },
  { file: 'app/api/chat/route.ts', needle: 'Object.hasOwn(LANG_NAMES, ctx.language)' },
];

for (const { file, needle } of SITES) {
  test(`${file} validates with Object.hasOwn, not a bare \`in\`/index allow-list check`, () => {
    const src = read(file);
    assert.ok(src.includes(needle), `expected to find: ${needle}`);
  });
}

test('image-producer/ai-render no longer use the vulnerable `x in ALLOW_LIST` pattern', () => {
  const imageProducer = read('app/api/image-producer/route.ts');
  const aiRender = read('app/api/ai-render/route.ts');
  assert.doesNotMatch(imageProducer, /body\.stylePreset in STYLE_LINES/);
  assert.doesNotMatch(imageProducer, /body\.model in GEMINI_MODELS/);
  assert.doesNotMatch(aiRender, /body\.geminiModel in GEMINI_MODELS/);
});

test('chat guards the bare index lookup with Object.hasOwn rather than indexing unconditionally', () => {
  const chat = read('app/api/chat/route.ts');
  const line = chat.split('\n').find((l) => l.includes('const langName ='));
  assert.ok(line, 'expected a `const langName =` line');
  assert.match(line!, /Object\.hasOwn\(LANG_NAMES, ctx\.language\)/);
});
