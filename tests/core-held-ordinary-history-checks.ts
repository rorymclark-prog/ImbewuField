import { veOrdinaryPairBefore, veOrdinaryPairBeforeHistory, veOrdinaryManifestBefore, veOrdinaryAssetBefore, veOrdinaryPairBytesBefore } from './ve-ordinary-reviewed-history-checks.ts';
import { veReadingFrostPairBefore, frostFiles } from './ve-reading-frost-history-checks.ts';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';

const folder = 'docs/study-translation-reviews/core-held-ordinary-completion-2026-10-07/';
const sha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const planBytes = readFileSync(folder + 'applied-plan.json');
assert.equal(sha(planBytes), 'cf0b9bf342ae07b5c793dc320ddc31a8cbee8f309629e03eca757a6779d6d901');
const plan = JSON.parse(planBytes.toString());
const before: Record<string, any> = {}, expected: Record<string, any> = {};
for (const row of plan.groups) {
  if (!before[row.file]) {
    const bytes = readFileSync(folder + 'before/' + row.file.replaceAll('/', '__') + '.json');
    assert.equal(sha(bytes), row.fileSHA256);
    before[row.file] = JSON.parse(bytes.toString());
    expected[row.file] = structuredClone(before[row.file]);
  }
  const slide = expected[row.file].slides.find((item: any) => item.n === row.slide);
  const index = row.field.match(/^body\[(\d+)\]$/)?.[1];
  assert.equal(index === undefined ? slide.english.heading : slide.english.body[Number(index)], row.sourceEnglish);
  assert.deepEqual(index === undefined ? slide.target.heading : slide.target.body[Number(index)], row.before);
  if (index === undefined) slide.target.heading = row.after;
  else slide.target.body[Number(index)] = row.after;
}
let signature = '';
export function ensureCoreHeldOrdinaryText() {
  const next = Object.keys(expected).map(file => { const s = statSync(file, { bigint: true }); return [file,s.ino,s.size,s.mtimeNs,s.ctimeNs].join(':'); }).join('|');
  if (next === signature) return;
  for (const [file, value] of Object.entries(expected)) assert.deepEqual(veOrdinaryPairBefore(file, JSON.parse(readFileSync(file,'utf8'))), value, 'complete latest 109-field layer and all unlisted source/target objects');
  signature = next;
}
/** The newer layer must be checked in full before dated tests see its predecessor.
 * Explicit callers cannot hide corruption by supplying an already-rewound object. */
export function coreHeldOrdinaryPairBefore<T>(file: string, actual: T): T {
  if (frostFiles[file] && JSON.stringify(actual) === JSON.stringify(JSON.parse(readFileSync(file, 'utf8')))) actual = veReadingFrostPairBefore(file, actual);
  ensureCoreHeldOrdinaryText();
  actual = veOrdinaryPairBeforeHistory(file, actual);
  if (!(file in expected)) return actual;
  assert.deepEqual(actual, expected[file], 'caller supplies the complete accepted latest paired layer, including unlisted objects');
  return structuredClone(before[file]);
}
export function coreHeldOrdinaryPairBeforeHistory<T>(file: string, actual: T): T {
  ensureCoreHeldOrdinaryText();
  actual = veOrdinaryPairBeforeHistory(file, actual);
  if (!(file in expected)) return actual;
  // Older composition callers may already have restored other dated leaves.
  // Restore ONLY exact accepted new objects, keeping every other caller value
  // untouched for the next complete predecessor guard to accept or reject.
  const restored: any = structuredClone(actual);
  for(const row of plan.groups.filter((item:any)=>item.file===file)) {
    const slide=restored.slides.find((item:any)=>item.n===row.slide);
    const index=row.field.match(/^body\[(\d+)\]$/)?.[1];
    const cell=index===undefined?slide.target.heading:slide.target.body[Number(index)];
    if(JSON.stringify(cell)!==JSON.stringify(row.after)) continue;
    if(index===undefined)slide.target.heading=structuredClone(row.before);
    else slide.target.body[Number(index)]=structuredClone(row.before);
  }
  return restored;
}
export function coreHeldOrdinaryPairBytesBefore(file: string, bytes: Uint8Array): Uint8Array {
  // Verify caller bytes before reversing the newer checked layer; old guards
  // still see their exact complete predecessor, not a permissive partial view.
  const restored=veOrdinaryPairBytesBefore(file,bytes);
  if (!(file in expected)) return restored;
  coreHeldOrdinaryPairBefore(file, JSON.parse(Buffer.from(bytes).toString()));
  assert.equal(Buffer.from(bytes).toString(),readFileSync(file,'utf8'),'caller bytes are actual live paired bytes');
  return readFileSync(folder+'before/'+file.replaceAll('/','__')+'.json');
}
const assetProofBytes=readFileSync(folder+'converted-assets.json');
assert.equal(sha(assetProofBytes),'b6934367991b39d54fd34761f0cb88f7ae6500a13e429d7e8fd53fbbd43b642f','measured69-card before/after/dimension proof is immutable');
export const coreHeldOrdinaryAssets: any[] = JSON.parse(assetProofBytes.toString()).assets;
const assets = new Map(coreHeldOrdinaryAssets.map(row => ['public'+row.url,row]));
export function coreHeldOrdinaryAssetBefore(path: string, bytes: Uint8Array) {
  const row = assets.get(path);
  if (!row) return veOrdinaryAssetBefore(path, bytes);
  const newer = veOrdinaryAssetBefore(path, bytes);
  assert.equal(newer?.bytes ?? bytes.length,row.afterBytes,path+': exact current measured bytes');
  assert.equal(newer?.sha256 ?? sha(bytes),row.afterSHA256,path+': exact current SHA');
  return { bytes:row.beforeBytes,sha256:row.beforeSHA256,width:row.beforeDimensions[0],height:row.beforeDimensions[1] };
}
const oldManifest = readFileSync(folder+'before/manifest.ts.txt','utf8');
let expectedManifest = oldManifest;
for (const row of coreHeldOrdinaryAssets) {
  const entry = `  '${row.url}': ${row.beforeBytes},`;
  assert.equal(expectedManifest.split(entry).length,2);
  expectedManifest = expectedManifest.replace(entry,`  '${row.url}': ${row.afterBytes},`);
}
// The generated aggregate is measured from the complete asset map, not guessed.
const total = [...expectedManifest.matchAll(/^  '[^']+': (\d+),$/gm)].reduce((sum,row)=>sum+Number(row[1]),0);
expectedManifest = expectedManifest.replace(/\d+\.\d+ MB/, (total/1024/1024).toFixed(1)+' MB');
// The official generator now sorts st-silent before st; retain complete entries,
// including every unlisted size, while reconstructing its deterministic order.
const lines = [...expectedManifest.matchAll(/^  '[^']+': \d+,$/gm)].map(row=>row[0]);
expectedManifest = expectedManifest.replace(/(^  '[^']+': \d+,\n)+/m, lines.sort().join('\n')+'\n');
export function coreHeldOrdinaryManifestBefore(actual: string) {
  actual = veOrdinaryManifestBefore(actual);
  assert.equal(actual,expectedManifest,'complete current final-language manifest after checked 69-card layer');
  return oldManifest;
}
