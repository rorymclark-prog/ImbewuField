import { ordinaryFramingAssets } from './ordinary-framing-history-checks.ts';
import { fairSharingAssets } from './intro-fair-sharing-history-checks.ts';
import { veOrdinaryAssets } from './ve-ordinary-reviewed-history-checks.ts';
import { finalLanguageNextPairedBytesBefore } from './final-language-next-checks.ts';
import { finalLanguageNextMediaProof } from './final-language-next-media-history-checks.ts';
import { coreHeldOrdinaryAssets } from './core-held-ordinary-history-checks.ts';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { nativePairedResidualManifestBefore968 } from './native-paired-residual-media-history-checks.ts';
import { tsSharedSourceBeforeNativeOrdinary } from './native-ordinary-final-history-checks.ts';
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
// The later Vegetables/Market redraws leave Intro968 intact. Keep its complete
// prior inventory for historical descriptors, and validate all real current bytes.
const latest = frozen('docs/study-translation-reviews/final-native-ordinary-application-2026-10-06/native-paired-residual-layer-2026-10-06/render-proof.json',
  'f9ff13f9ee8366b0cf8881242e55f415842e972a8d2387b1252eac1faa4b59e1');
const currentInventory = new Map(inventory);
assert.equal(latest.frames.length, 13);
for (const frame of latest.frames) {
  const url = '/' + frame.repositoryPath.replace(/^public\//, '');
  assert.ok(inventory.has(url), url + ': later redraw replaces an existing claimed frame');
  currentInventory.set(url, {bytes: frame.bytes, sha256: frame.sha256});
}
assert.equal(currentInventory.size, inventory.size, 'later redraws add no unlisted assets');
// 6 October: complete later 36-frame layer is validated before older descriptors.
for (const frame of finalLanguageNextMediaProof.frames) currentInventory.set(frame.url, frame.new);
// 7 October redraws only these69 reviewed source-paired cards. The full
// inventory remains an actual-byte guard, including every recording/archive.
// The subsequent 15-card layer also replaces existing stills; retain every archive check.
for (const frame of [...coreHeldOrdinaryAssets,...veOrdinaryAssets]) currentInventory.set(frame.url,{bytes:frame.afterBytes,sha256:frame.afterSHA256});
// These ten measured framing replacements keep the full1927-file guard current.
for (const frame of ordinaryFramingAssets) currentInventory.set(frame.url,{bytes:frame.bytes,sha256:frame.sha256});
// Two replacements and two new silent ZU cards extend the actual disk guard;
// no audio or archive is removed from its complete current inventory.
for (const frame of fairSharingAssets) currentInventory.set(frame.url,{bytes:frame.bytes,sha256:frame.sha256});
const laterReplacedURLs = new Set<string>([
  ...silentIntroIntegration.actualAssets.map((frame:any)=>frame.url),
  ...latest.frames.map((frame:any)=>'/' + frame.repositoryPath.replace(/^public\//,'')),
  ...finalLanguageNextMediaProof.frames.map((frame:any)=>frame.url),
  ...coreHeldOrdinaryAssets.map((frame:any)=>frame.url),
  ...veOrdinaryAssets.map((frame:any)=>frame.url),
  ...ordinaryFramingAssets.map((frame:any)=>frame.url),
  ...fairSharingAssets.filter(frame => frame.before).map(frame => frame.url),
]);
// Only these frozen, listed URLs need a historical descriptor. Bulk inventory
// callers still check every other real file directly, without recursively
// validating two thousand assets for each unchanged row.
export function isSilentIntroLaterReplacedAsset(path: string): boolean {
  return laterReplacedURLs.has(path.startsWith('public/') ? path.slice(6) : path);
}
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
  for(const [url, expected] of currentInventory) {
    const actual=fileDescriptor('public'+url);
    assert.equal(actual.bytes,expected.bytes,url+': entire current inventory measured bytes');
    assert.equal(actual.sha256,expected.sha256,url+': entire current inventory SHA');
  }
  for (const output of [...Object.values(applied.outputs.native),...Object.values(applied.outputs.existingPaired),applied.outputs.newSilentST] as any[]) {
    const sourceHash = output.path === 'lib/course-translation-drafts-ts.ts'
      ? sha(tsSharedSourceBeforeNativeOrdinary(readFileSync(output.path, 'utf8')))
      : sha(finalLanguageNextPairedBytesBefore(output.path, readFileSync(output.path)));
    assert.equal(sourceHash,output.sha256,'approved Intro native/paired files remain exact after the validated later Reading projection');
  }
  for(const old of applied.verification.oldSTProtectedByteInventory) {
    const actual=fileDescriptor(old.path);assert.equal(actual.bytes,old.bytes);assert.equal(actual.sha256,old.sha256,'archived ST files still exact');
  }
  assert.equal(fileDescriptor('lib/course-modules.ts').sha256,applied.beforeSnapshots['canonical-before.ts.txt'].sha256);
}
export function verifySilentIntroAsset(url: string, bytes: Buffer) {
  const expected=currentInventory.get(url); assert.ok(expected, url + ': claimed current asset');
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
  const priorManifest = nativePairedResidualManifestBefore968(manifest);
  assert.equal(sha(priorManifest),silentIntroIntegration.finalManifest.sha256,'after validating all later redraws, the complete accepted silent Intro manifest remains exact');
  verifyCurrentDiskInventory();
  if(initialized) return;
  const entries=Object.fromEntries([...priorManifest.matchAll(/^  '([^']+)': (\d+),$/gm)].map(m=>[m[1],Number(m[2])]));
  assert.deepEqual(entries,silentIntroIntegration.finalManifest.expectedEntries,'full manifest including unlisted entries');
  assert.equal(Object.keys(entries).length,1927);
  assert.equal(Object.values(entries).reduce((a,b)=>a+b,0),silentIntroIntegration.finalManifest.totalBytes);
  assert.equal(priorManifest.split(silentIntroIntegration.finalManifest.summaryLine).length,2);
  assert.equal(sha(readFileSync('lib/course-modules.ts')),applied.beforeSnapshots['canonical-before.ts.txt'].sha256,'canonical source remains exact');
  assert.equal(render.frames.length,25);assert.equal(silentIntroIntegration.actualAssets.length,25);
  assert.equal(new Set(render.frames.map((f:any)=>f.destination)).size,25);
  for (const output of [...Object.values(applied.outputs.native),...Object.values(applied.outputs.existingPaired),applied.outputs.newSilentST] as any[]) {
    const sourceHash = output.path === 'lib/course-translation-drafts-ts.ts'
      ? sha(tsSharedSourceBeforeNativeOrdinary(readFileSync(output.path, 'utf8')))
      : sha(finalLanguageNextPairedBytesBefore(output.path, readFileSync(output.path)));
    assert.equal(sourceHash,output.sha256,'approved complete Intro source/status/provenance after the validated later Reading projection');
  }
  for (const f of render.frames) {
    const bound=silentIntroIntegration.actualAssets.find((a:any)=>a.path===f.destination);assert.ok(bound);
    assert.equal(bound.sha256,f.sha256);assert.equal(bound.bytes,f.bytes);
    assert.equal(sha(finalLanguageNextPairedBytesBefore(f.pairedDraft, readFileSync(f.pairedDraft))),f.pairedDraftSHA256);
    const pair=JSON.parse(finalLanguageNextPairedBytesBefore(f.pairedDraft, readFileSync(f.pairedDraft)));const slide=pair.slides[f.slide-1];
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
  validateSilentIntroMedia(manifest);let before=nativePairedResidualManifestBefore968(manifest);
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
  const actual=fileDescriptor('public'+url);const expected=currentInventory.get(url);assert.ok(expected);assert.equal(actual.bytes,expected.bytes);assert.equal(actual.sha256,expected.sha256);
  if(latest.frames.some((frame:any)=>'/' + frame.repositoryPath.replace(/^public\//,'')===url) || finalLanguageNextMediaProof.frames.some((frame:any)=>frame.url===url)) {
    const previous=inventory.get(url);assert.ok(previous);
    return {bytes:previous.bytes,sha256:previous.sha256};
  }
  const row=silentIntroIntegration.actualAssets.find((f:any)=>f.url===url && f.beforeBytes!==null);
  if(row) return {bytes:row.beforeBytes,sha256:row.beforeSHA256};
  if([...coreHeldOrdinaryAssets,...veOrdinaryAssets,...ordinaryFramingAssets,...fairSharingAssets.filter(frame=>frame.before)].some((frame:any)=>frame.url===url)) { const previous=inventory.get(url);assert.ok(previous);return {bytes:previous.bytes,sha256:previous.sha256}; }
  return undefined;
}
