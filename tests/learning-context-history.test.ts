import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { readFileSync, statSync, mkdtempSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { resolve, join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Only file delivery to the three actual history helpers is virtual. Mutations
// never touch the app, preserved fixtures or media. Real stat values deliberately
// stay unchanged so a warm older signature cannot conceal changed source reads.
const root = fileURLToPath(new URL('../', import.meta.url));
const page = 'app/student/page.tsx', notice = 'components/studies/LearningRegionNotice.tsx';
const absolute = (file: string) => resolve(root, file);
const current = readFileSync(absolute(page)), component = readFileSync(absolute(notice));
const before17 = readFileSync(absolute('tests/fixtures/student-page-before-wave-17.tsx.txt'));
const before16 = readFileSync(absolute('tests/fixtures/student-page-before-wave-16.tsx.txt'));
const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
// CI can be shallow: derive the independently pinned wave17 successor from its
// existing predecessor fixture and the original four reviewed contrast changes.
assert.equal(before17.length, 88037);
assert.equal(sha(before17), '409bbf272668a9fca892fc7b1970324aa505c41e83210244b4c022bd734b60aa');
let predecessorText = before17.toString();
for (const oldSpan of [
  "style={{ background: 'var(--color-forest-800)', color: 'var(--on-forest)' }}",
  "? { background: 'var(--color-forest-800)', color: 'var(--on-forest)', border: '1px solid var(--color-forest-800)' }",
  "color: done ? 'var(--color-forest-800)' : 'var(--on-forest)',",
  "style={{ background: 'var(--color-forest-800)', color: 'var(--on-forest)', textDecoration: 'none' }}>",
]) {
  const at = predecessorText.indexOf(oldSpan);
  assert.ok(at >= 0, 'the pinned fixture contains each original wave17 contrast edit');
  assert.equal(predecessorText.indexOf(oldSpan, at + oldSpan.length), -1);
  predecessorText = predecessorText.slice(0, at) + oldSpan.replace('var(--on-forest)', 'var(--on-forest-800)')
    + predecessorText.slice(at + oldSpan.length);
}
const predecessor = Buffer.from(predecessorText);
assert.equal(current.length, 88187); assert.equal(sha(current), 'ece4f0787a0e0c5e14d6d5f406aef782e195cedb22b1578013a0b2781e173730');
assert.equal(predecessor.length, 88053); assert.equal(sha(predecessor), 'a361890bfdb03c22e74a01b61516f759cf93225ca20b83edf422aa37a9712272');
const overrides = new Map<string, Buffer>(), reads = new Map<string, number>();
const oldGlobal = Object.getOwnPropertyDescriptor(globalThis, '__learningContextHistoryReads');
const state = {
  read(file: string | URL, options?: unknown) {
    const path = absolute(file instanceof URL ? fileURLToPath(file) : String(file));
    reads.set(path, (reads.get(path) ?? 0) + 1);
    const bytes = Buffer.from(overrides.get(path) ?? readFileSync(path));
    const encoding = typeof options === 'string' ? options : (options as { encoding?: string } | undefined)?.encoding;
    return encoding ? bytes.toString(encoding as BufferEncoding) : bytes;
  },
  stat: (...args: Parameters<typeof statSync>) => statSync(...args),
};
Object.assign(globalThis, { __learningContextHistoryReads: state });
const helperURLs = new Set(['learning-context-history-checks.ts', 'wave-17-history-checks.ts', 'wave-16-history-checks.ts']
  .map(name => pathToFileURL(absolute('tests/' + name)).href));
const virtualFs = 'data:text/javascript,' + encodeURIComponent(`
const state=globalThis.__learningContextHistoryReads;
export const readFileSync=(...args)=>state.read(...args);
export const statSync=(...args)=>state.stat(...args);`);
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'node:fs' && context.parentURL && helperURLs.has(context.parentURL)) return { shortCircuit: true, url: virtualFs };
  return next(specifier, context);
} });
const layer = await import('./learning-context-history-checks.ts');
const wave17 = await import('./wave-17-history-checks.ts');
const wave16 = await import('./wave-16-history-checks.ts');
beforeEach(() => { overrides.clear(); reads.clear(); });
after(() => {
  overrides.clear(); hooks.deregister();
  if (oldGlobal) Object.defineProperty(globalThis, '__learningContextHistoryReads', oldGlobal);
  else Reflect.deleteProperty(globalThis, '__learningContextHistoryReads');
});
const changedByte = (input: Buffer, at = Math.floor(input.length / 2)) => {
  const bytes = Buffer.from(input); bytes[at] ^= 1;
  assert.equal(bytes.length, input.length, 'the adverse source retains exactly the original byte count');
  return bytes;
};
const rejectLive = /complete actual live successor/;

test('the reviewed notice removes only its two exact additions and the original wave17 and wave16 predecessors still match', () => {
  layer.ensureLearningContextCurrent(); wave17.ensureWave17Current(); wave16.ensureWave16Current();
  assert.deepEqual(layer.learningContextSourceBefore(page, current), predecessor);
  assert.deepEqual(wave17.wave17SourceBefore(page, current), before17);
  assert.deepEqual(wave16.wave16SourceBefore(page, current), before16);
  let removed = Buffer.from(current);
  for (const addition of [
    Buffer.from("import LearningRegionContext from '@/components/studies/LearningRegionNotice';\n"),
    Buffer.from('        <LearningRegionContext scope="core-farming" />\n'),
  ]) {
    const at = removed.indexOf(addition); assert.ok(at >= 0);
    assert.equal(removed.indexOf(addition, at + addition.length), -1);
    removed = Buffer.concat([removed.subarray(0, at), removed.subarray(at + addition.length)]);
  }
  assert.deepEqual(removed, predecessor, 'all unlisted bytes equal the independently pinned wave17 successor');
});

test('string, Buffer and Uint8Array callers receive their own detached historical value', () => {
  const text = layer.learningContextSourceBefore(page, current.toString()); assert.equal(text, predecessor.toString());
  const buffer = layer.learningContextSourceBefore(page, current); assert.ok(Buffer.isBuffer(buffer)); assert.notEqual(buffer, current);
  const input = new Uint8Array(current), bytes = layer.learningContextSourceBefore(page, input);
  assert.ok(bytes instanceof Uint8Array); assert.equal(Buffer.isBuffer(bytes), false); assert.notEqual(bytes, input);
  assert.deepEqual(Buffer.from(bytes), predecessor); assert.deepEqual(Buffer.from(input), current);
  buffer.fill(0); bytes.fill(0);
  assert.deepEqual(layer.learningContextSourceBefore(page, current), predecessor, 'a modified output cannot poison later projection');
});

test('an already historical caller is retained only while the actual newer page and notice remain valid', () => {
  const caller = Buffer.from(predecessor);
  assert.equal(layer.learningContextSourceBefore(page, caller), caller);
  overrides.set(absolute(notice), changedByte(component));
  assert.throws(() => layer.learningContextSourceBefore(page, caller), rejectLive,
    'known predecessor bytes cannot bypass changed current notice bytes');
});

test('unknown paths retain the exact caller and do not widen this layer into a global source override', () => {
  const caller = Buffer.from('unrelated source'); overrides.set(absolute(page), changedByte(current));
  assert.equal(layer.learningContextSourceBefore('app/unrelated/page.tsx', caller), caller);
  assert.equal(reads.size, 0);
});

for (const addition of ["import LearningRegionContext from '@/components/studies/LearningRegionNotice';", '<LearningRegionContext scope="core-farming" />']) {
  test(`a changed exact learning addition stays exposed: ${addition}`, () => {
    const at = current.indexOf(addition); assert.ok(at >= 0);
    const caller = changedByte(current, at);
    assert.equal(layer.learningContextSourceBefore(page, caller), caller);
    assert.equal(wave17.wave17SourceBefore(page, caller), caller);
    assert.notEqual(sha(wave16.wave16SourceBefore(page, caller)), sha(before16), 'the original complete-byte owner cannot accept changed caller content');
    overrides.set(absolute(page), caller);
    assert.throws(() => wave17.ensureWave17Current(), rejectLive);
  });
}

test('a repeated learning mount is not stripped into an apparently approved predecessor', () => {
  const caller = Buffer.concat([current, Buffer.from('        <LearningRegionContext scope="core-farming" />\n')]);
  assert.equal(layer.learningContextSourceBefore(page, caller), caller);
  overrides.set(absolute(page), caller); assert.throws(() => layer.ensureLearningContextCurrent(), rejectLive);
});

test('a same-size unlisted caller edit remains the same object and cannot satisfy the original predecessor guard', () => {
  const caller = changedByte(current, current.length - 2);
  assert.equal(layer.learningContextSourceBefore(page, caller), caller);
  assert.equal(wave17.wave17SourceBefore(page, caller), caller);
  assert.notEqual(sha(caller), sha(predecessor)); assert.notEqual(sha(caller), sha(before17));
});

test('warm wave17 validation still rereads same-size current page bytes before its successful signature return', () => {
  wave17.ensureWave17Current(); const first = reads.get(absolute(page))!;
  wave17.ensureWave17Current(); assert.ok(reads.get(absolute(page))! > first);
  overrides.set(absolute(page), changedByte(current, current.length - 2));
  assert.throws(() => wave17.ensureWave17Current(), rejectLive,
    'unchanged real stat metadata cannot conceal changed actual source bytes');
  assert.throws(() => wave16.wave16SourceBefore(page, current), rejectLive);
});

test('warm predecessor projections still check the complete notice even when page bytes and old stat signatures stay unchanged', () => {
  wave16.wave16SourceBefore(page, current); const first = reads.get(absolute(notice))!;
  overrides.set(absolute(notice), changedByte(component, component.length - 2));
  assert.throws(() => wave16.wave16SourceBefore(page, current), rejectLive);
  assert.ok(reads.get(absolute(notice))! > first);
  overrides.delete(absolute(notice)); assert.deepEqual(wave16.wave16SourceBefore(page, current), before16);
});

test('a failed current observation is never reused as success and valid restoration does not hide a later failure', () => {
  wave17.ensureWave17Current();
  for (const [file, baseline] of [[page, current], [notice, component]] as const) {
    overrides.set(absolute(file), changedByte(baseline));
    assert.throws(() => wave17.ensureWave17Current(), rejectLive);
    assert.throws(() => wave17.ensureWave17Current(), rejectLive);
    overrides.delete(absolute(file)); assert.deepEqual(wave17.wave17SourceBefore(page, current), before17);
  }
  overrides.set(absolute(page), changedByte(current, current.length - 3));
  assert.throws(() => layer.learningContextSourceBefore(page, predecessor), rejectLive);
});

test('nested historical source reads cannot borrow a prior successful observation after current bytes change', () => {
  const outer = () => {
    assert.deepEqual(wave16.wave16SourceBefore(page, current), before16);
    const inner = () => {
      overrides.set(absolute(notice), changedByte(component));
      assert.throws(() => wave17.wave17SourceBefore(page, current), rejectLive);
      overrides.delete(absolute(notice));
      assert.deepEqual(wave17.wave17SourceBefore(page, current), before17);
    };
    inner();
    overrides.set(absolute(page), changedByte(current));
    assert.throws(() => wave16.wave16SourceBefore(page, current), rejectLive);
  };
  outer(); overrides.clear(); assert.deepEqual(layer.learningContextSourceBefore(page, current), predecessor);
});

test('the existing isolated history copy plan carries the new guard and notice, and its thin source fixture rejects real disk mutations', () => {
  const source = readFileSync(absolute('tests/blind-reviewed-study-corrections.test.ts'), 'utf8');
  const declaration = source.match(/const files=new Set<string>\(\[[\s\S]*?\]\);/);
  assert.ok(declaration, 'execute the actual existing fixture dependency declaration');
  const folder = 'docs/study-translation-reviews/blind-reviewed-corrections-2026-10-12/';
  const webpFolder = 'docs/study-translation-reviews/slides-webp-2026-10-14/';
  const proof = JSON.parse(readFileSync(absolute(folder + 'source-layer-proof.json'), 'utf8'));
  const inventory = JSON.parse(readFileSync(absolute(folder + 'media-before-inventory.json'), 'utf8'));
  const webp = JSON.parse(readFileSync(absolute(webpFolder + 'webp-layer-proof.json'), 'utf8'));
  const code = stripTypeScriptTypes(declaration[0]) + '\nreturn files;';
  const planned = new Function('inventory', 'proof', 'webp', code)(inventory, proof, webp) as Set<string>;
  const required = [page, notice, 'tests/learning-context-history-checks.ts',
    'tests/wave-17-history-checks.ts', 'tests/fixtures/student-page-before-wave-17.tsx.txt',
    'tests/wave-16-history-checks.ts', 'tests/fixtures/student-page-before-wave-16.tsx.txt'];
  for (const file of required) assert.ok(planned.has(file), 'the actual history fixture copy plan must include ' + file);
  // Only source dependencies are copied here. The older full media inventory and
  // its original corruption tests remain intact for the coordinator's full run.
  const fixture = mkdtempSync(join(tmpdir(), 'imbewu-learning-history-source-'));
  try {
    for (const file of required) { const target = join(fixture, file); mkdirSync(dirname(target), { recursive: true }); copyFileSync(absolute(file), target); }
    const child = String.raw`
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
const root=process.cwd(),page='app/student/page.tsx',notice='components/studies/LearningRegionNotice.tsx';
const history=await import(pathToFileURL(join(root,'tests/wave-17-history-checks.ts')).href);
const prior=await import(pathToFileURL(join(root,'tests/wave-16-history-checks.ts')).href);
const current=readFileSync(join(root,page)),component=readFileSync(join(root,notice));
history.ensureWave17Current();
assert.deepEqual(history.wave17SourceBefore(page,current),readFileSync(join(root,'tests/fixtures/student-page-before-wave-17.tsx.txt')));
let rejected=0;
for(const[file,bytes]of[[page,current],[notice,component]]){
 const changed=Buffer.from(bytes);changed[changed.length-2]^=1;assert.equal(changed.length,bytes.length);
 try{writeFileSync(join(root,file),changed);assert.throws(()=>history.ensureWave17Current(),/complete actual live successor/);rejected++;}
 finally{writeFileSync(join(root,file),bytes);}
 history.ensureWave17Current();
}
assert.deepEqual(prior.wave16SourceBefore(page,current),readFileSync(join(root,'tests/fixtures/student-page-before-wave-16.tsx.txt')));
process.stdout.write(JSON.stringify({rejected,sourceFiles:7}));`;
    const output = execFileSync(process.execPath, ['--input-type=module', '--eval', child],
      { cwd: fixture, encoding: 'utf8', timeout: 30_000, maxBuffer: 1 << 20 });
    assert.deepEqual(JSON.parse(output), { rejected: 2, sourceFiles: 7 });
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});
