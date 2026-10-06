import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
const sha = (b: Uint8Array | string) => createHash('sha256').update(b).digest('hex');
const review = 'docs/study-translation-reviews/st-intro-silent-completion-2026-10-06/';
function frozen(path: string, digest: string) {
  const bytes = readFileSync(path); assert.equal(sha(bytes), digest, path + ': immutable accepted authority');
  return JSON.parse(bytes.toString());
}
const applied = frozen(review + 'applied-proof.json', '356243b0a456b820208971c4349b893011a018d97e3e45943171152de9bd8d45');
const render = frozen('docs/media/intro-silent-completion-2026-10-06/rendered-frames-proof.json', 'c619ca9c3e1fab4c79e57a9a683d4c5c3380be4f0a3a3d59d5343a178429bb64');
export const silentIntroIntegration = frozen(review + 'after-soilwater-media-integration-plan.json', '1ecbeab0c238b7d2236c12e179ab6d15d71885aa4ddfbb048c5a6a0c2f9835e5');
const intro = frozen('docs/media/intro-full-ordinary-completion-2026-10-06/frames.json', 'ab1079681559b79534e22c9d6e64e08ba11f385f1471758bbe9fabc40c9e7967');
const residual = frozen('docs/media/soil-water-residual-2026-10-06/frames.json', 'abfc32697890076025c169f4efa854ef433e30107a23776e7a76c4e353afb9d3');
const predecessor = frozen('docs/media/intro-full-ordinary-completion-2026-10-06/all-manifest-assets-before.json', intro.allAssetBeforeSHA256);
const inventory = new Map<string, {bytes: number; sha256: string}>(predecessor.map((r: any) => [r.path, {bytes:r.bytes,sha256:r.sha256}]));
for (const f of intro.frames) inventory.set(f.path, f.new);
for (const f of residual.renderedFrames) inventory.set('/' + f.path.replace(/^public\//,''), {bytes:f.bytes,sha256:f.sha256After});
assert.equal(inventory.size, 1905);
for (const f of silentIntroIntegration.actualAssets) {
  const previous = inventory.get(f.url);
  if (f.beforeBytes !== null) assert.deepEqual({bytes:previous?.bytes,sha256:previous?.sha256},{bytes:f.beforeBytes,sha256:f.beforeSHA256});
  else assert.equal(previous, undefined);
  inventory.set(f.url, {bytes:f.bytes,sha256:f.sha256});
}
assert.equal(inventory.size, 1927);
const observed = new Map<string,{signature:string;bytes:number;sha256:string}>();
function fileDescriptor(path: string) {
  const stat=statSync(path,{bigint:true});
  const signature=[stat.dev,stat.ino,stat.size,stat.mtimeNs,stat.ctimeNs].join(':');
  const old=observed.get(path); if(old?.signature===signature) return old;
  const bytes=readFileSync(path);
  const value={signature,bytes:bytes.length,sha256:sha(bytes)};observed.set(path,value);return value;
}
function verifyCurrentDiskInventory() {
  // Every later call still notices same-size writes. Cache hashes, not700MB of
  // media buffers, and reuse them only while all filesystem identities match.
  for(const [url, expected] of inventory) {
    const actual=fileDescriptor('public'+url);
    assert.equal(actual.bytes,expected.bytes,url+': entire current inventory measured bytes');
    assert.equal(actual.sha256,expected.sha256,url+': entire current inventory SHA');
  }
  for (const output of [...Object.values(applied.outputs.native),...Object.values(applied.outputs.existingPaired),applied.outputs.newSilentST] as any[]) {
    assert.equal(fileDescriptor(output.path).sha256,output.sha256,'approved current native/paired files still exact');
  }
  for(const old of applied.verification.oldSTProtectedByteInventory) {
    const actual=fileDescriptor(old.path);assert.equal(actual.bytes,old.bytes);assert.equal(actual.sha256,old.sha256,'archived ST files still exact');
  }
  assert.equal(fileDescriptor('lib/course-modules.ts').sha256,applied.beforeSnapshots['canonical-before.ts.txt'].sha256);
}
export function verifySilentIntroAsset(url: string, bytes: Buffer) {
  const expected=inventory.get(url); assert.ok(expected, url + ': claimed current asset');
  assert.equal(bytes.length,expected.bytes,url + ': exact measured bytes');
  assert.equal(sha(bytes),expected.sha256,url + ': exact current asset SHA');
}
export function verifySilentIntroFrame(frame: any, bytes: Buffer) {
  verifySilentIntroAsset(frame.url,bytes);
  assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
  assert.equal(bytes.toString('ascii',12,16),'VP8 ');
  assert.equal(bytes.readUInt16LE(26)&0x3fff,frame.width);
  assert.equal(bytes.readUInt16LE(28)&0x3fff,frame.height);
  assert.equal(frame.width,1440);assert.ok(frame.height>=5400);
}
let initialized=false;
// 6 October 2026: the new silent ST release and three VE/TS stills supersede the
// published post-967 media layer. Full real current validation precedes any dated
// descriptor; immutable manifests stay checked on every call without rereading1902 files.
export function validateSilentIntroMedia(manifest=readFileSync('lib/course-asset-sizes.ts','utf8')) {
  assert.equal(sha(manifest),silentIntroIntegration.finalManifest.sha256,'only the complete accepted silent Intro manifest is current');
  verifyCurrentDiskInventory();
  if(initialized) return;
  const entries=Object.fromEntries([...manifest.matchAll(/^  '([^']+)': (\d+),$/gm)].map(m=>[m[1],Number(m[2])]));
  assert.deepEqual(entries,silentIntroIntegration.finalManifest.expectedEntries,'full manifest including unlisted entries');
  assert.equal(Object.keys(entries).length,1927);
  assert.equal(Object.values(entries).reduce((a,b)=>a+b,0),silentIntroIntegration.finalManifest.totalBytes);
  assert.equal(manifest.split(silentIntroIntegration.finalManifest.summaryLine).length,2);
  assert.equal(sha(readFileSync('lib/course-modules.ts')),applied.beforeSnapshots['canonical-before.ts.txt'].sha256,'canonical source remains exact');
  assert.equal(render.frames.length,25);assert.equal(silentIntroIntegration.actualAssets.length,25);
  assert.equal(new Set(render.frames.map((f:any)=>f.destination)).size,25);
  for (const output of [...Object.values(applied.outputs.native),...Object.values(applied.outputs.existingPaired),applied.outputs.newSilentST] as any[]) {
    assert.equal(sha(readFileSync(output.path)),output.sha256,'approved complete current native/paired source/status/provenance');
  }
  for (const f of render.frames) {
    const bound=silentIntroIntegration.actualAssets.find((a:any)=>a.path===f.destination);assert.ok(bound);
    assert.equal(bound.sha256,f.sha256);assert.equal(bound.bytes,f.bytes);
    assert.equal(sha(readFileSync(f.pairedDraft)),f.pairedDraftSHA256);
    const pair=JSON.parse(readFileSync(f.pairedDraft,'utf8'));const slide=pair.slides[f.slide-1];
    assert.equal(slide.n,f.slide);assert.deepEqual(slide.english,f.englishSource);assert.deepEqual(slide.target,f.target);
    verifySilentIntroFrame(bound,readFileSync(f.destination));
  }
  assert.equal(applied.verification.oldSTProtectedByteInventory.length,48);
  for(const old of applied.verification.oldSTProtectedByteInventory) {
    const actual=fileDescriptor(old.path);assert.equal(actual.bytes,old.bytes);assert.equal(actual.sha256,old.sha256,'archived ST pair/audio/stills unchanged');
  }
  const changed=new Set(silentIntroIntegration.actualAssets.map((f:any)=>f.url));let unlisted=0;
  for(const [url] of inventory) if(!changed.has(url)) {unlisted++;}
  assert.equal(unlisted,1902,'all other predecessor assets exact, not a prefix exclusion');
  initialized=true;
}
export function silentIntroAssetSizesBefore(manifest=readFileSync('lib/course-asset-sizes.ts','utf8')) {
  validateSilentIntroMedia(manifest);let before=manifest;
  for(const f of silentIntroIntegration.actualAssets) {
    const row=`  '${f.url}': ${f.bytes},\n`;assert.equal(before.split(row).length,2);
    before=before.replace(row,f.beforeBytes===null?'':`  '${f.url}': ${f.beforeBytes},\n`);
  }
  before=before.replace(silentIntroIntegration.finalManifest.summaryLine,silentIntroIntegration.expectedPredecessor.summaryLine);
  assert.equal(sha(before),'60064c611c8140cd6b20875a8f673a933b9007f523a46460933d866b493d3571','only25 slots/header rewind to exact post-967 predecessor');
  return before;
}
export function silentIntroMediaBefore(path: string) {
  validateSilentIntroMedia();const url=path.startsWith('public/')?path.slice(6):path;
  const actual=fileDescriptor('public'+url);const expected=inventory.get(url);assert.ok(expected);assert.equal(actual.bytes,expected.bytes);assert.equal(actual.sha256,expected.sha256);
  const row=silentIntroIntegration.actualAssets.find((f:any)=>f.url===url && f.beforeBytes!==null);
  return row?{bytes:row.beforeBytes,sha256:row.beforeSHA256}:undefined;
}
