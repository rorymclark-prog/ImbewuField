import { expandedAssets } from './core-ordinary-expanded-history-checks.ts';
import { ordinaryFramingAssets } from './ordinary-framing-history-checks.ts';
import { fairSharingAssets } from './intro-fair-sharing-history-checks.ts';
import { veOrdinaryAssets } from './ve-ordinary-reviewed-history-checks.ts';
import { finalLanguageNextPairedBytesBefore } from './final-language-next-checks.ts';
import { frostAssets } from './ve-reading-frost-history-checks.ts';
import { finalLanguageNextMediaProof } from './final-language-next-media-history-checks.ts';
import { coreHeldOrdinaryAssets } from './core-held-ordinary-history-checks.ts';
import { currentBatchProof, ensureCurrentBatch, followupAssetBefore, followupAssets } from './core-reading-vegetables-followup-history-checks.ts';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { nativePairedResidualManifestBefore968 } from './native-paired-residual-media-history-checks.ts';
import { tsSharedSourceBeforeNativeOrdinary } from './native-ordinary-final-history-checks.ts';
import { lightestAssetBefore, lightestAssetRows, lightestManifestBefore } from './reading-title-lightest-media-history-checks.ts';
import { stIntroRuntimeResidualAssets, stIntroRuntimeResidualAssetBefore, stIntroRuntimeResidualManifestBefore } from './st-intro-runtime-residual-history-checks.ts';
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
const vegetablesResidualMedia = frozen('docs/study-translation-reviews/vegetables-two-ordinary-residual-2026-10-08/media-proof.json',
  'de15dd6662fa5fbd88f98f3c38a8fac00e8e9cbaf62ab80739ad758c42be4117');
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
// VE Reading's accepted frost stills follow the earlier regional card layers.
for (const [url, frame] of Object.entries(frostAssets)) if (frame.changed) {
  const prior=currentInventory.get(url);
  assert.equal(prior?.bytes, frame.beforeBytes, `${url}: frost proof starts at the exact earlier inventory size`);
  assert.equal(prior?.sha256, frame.beforeSha256, `${url}: frost proof predecessor digest matches the earlier inventory`);
  currentInventory.set(url, {bytes:frame.afterBytes,sha256:frame.afterSha256});
}
// The five-clause followup redraws are later than the earlier 69-card layer.
// Keep their exact outputs in the live inventory before the newest batch.
for (const [url, frame] of Object.entries(followupAssets)) if (frame.changed) {
  currentInventory.set(url, {bytes:frame.afterBytes, sha256:frame.afterSha256});
}
// The newest accepted batch supersedes five of those stills. Freeze the older
// inventory as the exact predecessor, then expose the newest complete proof.
const beforeCurrentBatchInventory = new Map(currentInventory);
const currentBatchAssets = new Map(currentBatchProof.assets.map(row => [row.url, row]));
for (const frame of currentBatchProof.assets) {
  const prior = beforeCurrentBatchInventory.get(frame.url);
  assert.equal(prior?.bytes, frame.beforeBytes, `${frame.url}: newest proof starts at the complete prior inventory`);
  assert.equal(prior?.sha256, frame.beforeSha256, `${frame.url}: newest proof predecessor digest matches the prior inventory`);
  currentInventory.set(frame.url, {bytes:frame.afterBytes,sha256:frame.afterSha256});
}
// The four expanded ordinary cards keep this complete live inventory authoritative.
// Their immutable predecessor must join every prior byte guard before any old view is exposed.
for (const frame of expandedAssets) {
  const prior = currentInventory.get(frame.url);
  assert.equal(prior?.bytes, frame.beforeBytes, `${frame.url}: expanded proof starts at the exact current inventory`);
  assert.equal(prior?.sha256, frame.beforeSha256, `${frame.url}: expanded predecessor SHA joins the full inventory`);
  currentInventory.set(frame.url, {bytes: frame.afterBytes, sha256: frame.afterSha256});
}
// PR985's ten Intro silent assets precede this branch's four disjoint still updates.
for (const frame of stIntroRuntimeResidualAssets) currentInventory.set(frame.url,{bytes:frame.after.bytes,sha256:frame.after.sha256});
// The two later Vegetables card refreshes retain their older recorded sources
// while the complete current-disk inventory expects the measured new bytes.
for (const frame of vegetablesResidualMedia.assets) currentInventory.set(frame.url,{bytes:frame.afterBytes,sha256:frame.afterSha256});
// The 8 October four-card batch replaces exact existing Reading and Vegetables stills.
// Its complete proof is checked before any older inventory descriptor is exposed.
export const readingTitleLightestAssets = lightestAssetRows();
const beforeReadingTitleLightestInventory = new Map(currentInventory);
export const readingTitleLightestBeforeInventory = beforeReadingTitleLightestInventory;
for (const frame of readingTitleLightestAssets) {
  const prior = currentInventory.get(frame.url);
  assert.equal(prior?.bytes, frame.beforeBytes, `${frame.url}: newest card proof starts at exact current inventory bytes`);
  assert.equal(prior?.sha256, frame.beforeSha256, `${frame.url}: newest card proof starts at exact current inventory hash`);
  currentInventory.set(frame.url, {bytes: frame.afterBytes, sha256: frame.afterSha256});
}
const laterReplacedURLs = new Set<string>([
  ...expandedAssets.map((frame: any) => frame.url),
  ...stIntroRuntimeResidualAssets.map((frame: any) => frame.url),
  ...silentIntroIntegration.actualAssets.map((frame:any)=>frame.url),
  ...latest.frames.map((frame:any)=>'/' + frame.repositoryPath.replace(/^public\//,'')),
  ...finalLanguageNextMediaProof.frames.map((frame:any)=>frame.url),
  ...coreHeldOrdinaryAssets.map((frame:any)=>frame.url),
  ...veOrdinaryAssets.map((frame:any)=>frame.url),
  ...ordinaryFramingAssets.map((frame:any)=>frame.url),
  ...fairSharingAssets.filter(frame => frame.before).map(frame => frame.url),
  ...currentBatchProof.assets.map(frame => frame.url),
  ...readingTitleLightestAssets.map((frame: any) => frame.url),
  ...vegetablesResidualMedia.assets.map((frame: any) => frame.url),
]);
// Only these frozen, listed URLs need a historical descriptor. Bulk inventory
// callers still check every other real file directly, without recursively
// validating two thousand assets for each unchanged row.
export function isSilentIntroLaterReplacedAsset(path: string): boolean {
  const url = path.startsWith('public/') ? path.slice(6) : path;
  return laterReplacedURLs.has(url) || Boolean(followupAssets[url]?.changed);
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
  // Verify the immutable latest five-file proof before any older layer can
  // return a predecessor descriptor.
  ensureCurrentBatch();
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
let validatedManifest: string | undefined;
let validatedDiskSignature: string | undefined;
function liveHistorySignature() {
  const files = new Set<string>([
    ...[...currentInventory.keys()].map(url => 'public' + url),
    ...applied.verification.oldSTProtectedByteInventory.map((row: any) => row.path),
    'app/sw.js/route.ts',
  ]);
  // Source projections compose across several modules. Include the whole live
  // source directories rather than guessing which latest owner reads a file.
  for (const directory of ['lib', 'docs/narration-reviews']) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isFile()) files.add(directory + '/' + entry.name);
    }
  }
  return [...files].sort().map(path => {
    const s = statSync(path, { bigint: true });
    return [path, s.dev, s.ino, s.size, s.mtimeNs, s.ctimeNs].join(':');
  }).join('|');
}
export function validateSilentIntroMedia(manifest=readFileSync('lib/course-asset-sizes.ts','utf8')) {
  // Both CI jobs reached GitHub's six-hour limit by re-entering the full
  // historical projection for every dated asset. Reuse a successful whole-disk
  // validation only for identical caller bytes and identical filesystem state.
  // ctime/mtime nanoseconds and inode retain the existing same-size corruption
  // and replacement checks; failures never populate this cache.
  const signature = liveHistorySignature();
  if (validatedManifest === manifest && validatedDiskSignature === signature) return;
  validateSilentIntroMediaUncached(manifest);
  validatedManifest = manifest;
  validatedDiskSignature = signature;
}
function validateSilentIntroMediaUncached(manifest: string) {
  // The frozen latest batch is validated first. Existing source-history owners
  // then compose its predecessor through the followup and frost layers once.
  ensureCurrentBatch();
  const lightestPredecessor = lightestManifestBefore(manifest);
  const runtimePreviousManifest = stIntroRuntimeResidualManifestBefore(lightestPredecessor);
  const priorManifest = nativePairedResidualManifestBefore968(runtimePreviousManifest);
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
  validateSilentIntroMedia(manifest);
  let before=nativePairedResidualManifestBefore968(stIntroRuntimeResidualManifestBefore(lightestManifestBefore(manifest)));
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
  const actual=fileDescriptor('public'+url);const expected=currentInventory.get(url);assert.ok(expected);
  assert.equal(actual.bytes,expected.bytes);assert.equal(actual.sha256,expected.sha256);
  // The live whole-inventory guard above validates both layers. Check the current
  // card projection before returning its exact predecessor descriptor.
  if (readingTitleLightestAssets.some((frame: any) => frame.url === url)) {
    const projected = lightestAssetBefore('public' + url, readFileSync('public' + url));
    const prior = beforeReadingTitleLightestInventory.get(url);
    assert.ok(prior, `${url}: newest still replaces an existing verified inventory asset`);
    assert.deepEqual({ bytes: projected.length, sha256: sha(projected) }, prior,
      `${url}: newest compressed bytes project to the exact predecessor in the complete earlier inventory`);
    const historical = inventory.get(url);
    assert.ok(historical, `${url}: exact predecessor remains in the frozen original inventory`);
    return historical;
  }
  stIntroRuntimeResidualAssetBefore(path,readFileSync('public'+url));
  // These four later stills were not all listed by the preceding five-card
  // batch. The complete live inventory above must pass before their original
  // Intro-era descriptors are exposed; never treat a replacement as unlisted.
  if (expandedAssets.some((frame: any) => frame.url === url)) {
    const historical = inventory.get(url); assert.ok(historical);
    return {bytes: historical.bytes, sha256: historical.sha256};
  }
  const currentBatch = currentBatchAssets.get(url);
  if(currentBatch) {
    const prior=beforeCurrentBatchInventory.get(url);assert.ok(prior);
    assert.deepEqual({bytes:currentBatch.beforeBytes,sha256:currentBatch.beforeSha256},prior,
      `${url}: exact newest predecessor is the saved earlier inventory descriptor`);
    const projected=followupAssetBefore('public'+url,readFileSync('public'+url));assert.ok(projected);
    assert.deepEqual({bytes:projected.bytes,sha256:projected.sha256},prior,
      `${url}: current caller bytes are verified before exposing the newest predecessor`);
    // Older Intro inventories predate several of these later layers. Continue
    // the exact chain to that frozen baseline rather than returning the
    // immediately previous (still post-Intro) descriptor above.
    const historical=inventory.get(url);assert.ok(historical, `${url}: newest current asset belongs to the complete older inventory`);
    return historical;
  }
  if(latest.frames.some((frame:any)=>'/' + frame.repositoryPath.replace(/^public\//,'')===url) || finalLanguageNextMediaProof.frames.some((frame:any)=>frame.url===url)) {
    const previous=inventory.get(url);assert.ok(previous);
    return {bytes:previous.bytes,sha256:previous.sha256};
  }
  const row=silentIntroIntegration.actualAssets.find((f:any)=>f.url===url && f.beforeBytes!==null);
  if(row) return {bytes:row.beforeBytes,sha256:row.beforeSHA256};
  if(followupAssets[url]?.changed || [...coreHeldOrdinaryAssets,...veOrdinaryAssets,...ordinaryFramingAssets,...fairSharingAssets.filter(frame=>frame.before)].some((frame:any)=>frame.url===url)) { const previous=inventory.get(url);assert.ok(previous);return {bytes:previous.bytes,sha256:previous.sha256}; }
  return undefined;
}
