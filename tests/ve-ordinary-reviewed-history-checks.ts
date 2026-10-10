import { ordinaryFramingPairBefore, ordinaryFramingPairBeforeHistory, ordinaryFramingPairBytesBefore, ordinaryFramingManifestBefore, ordinaryFramingAssetBefore, ordinaryFramingAssets } from './ordinary-framing-history-checks.ts';
import { veReadingFrostPairBefore, veReadingFrostAssetBefore, frostAssets } from './ve-reading-frost-history-checks.ts';
import { isCurrentOrBatchPredecessor } from './core-reading-vegetables-followup-history-checks.ts';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
const folder = 'docs/study-translation-reviews/ve-remaining-ordinary-review-2026-10-07/';
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const proofBytes = readFileSync(folder+'applied-field-proof.json');
assert.equal(sha(proofBytes),'128ae5b81a7fa66c24952b70a219ac9985d692ec8497622c8de0e975f6df0bea','immutable full field proof');
const groups = JSON.parse(proofBytes.toString()).groups;
const inputHashes: Record<string,string> = {"docs/narration/intro-permaculture.ve.paired-draft.json": "e69b13c7027d0038e0cca3ab575680aec296afd5772fc87865ad54516b0c70c7", "docs/narration/market-community.ve.paired-draft.json": "4b2819df030c6c71fb092e10132c66e082d271f3a22a198d30480902e7e9fdbf", "docs/narration/reading-landscape.ve.paired-draft.json": "51484fae7c92675fcafff6249373daf7460ce43ce575d697d792f1c3bdce9909", "docs/narration/vegetables-staples.ve.paired-draft.json": "feec5a2d8297840849312226b285340623817eda159041b9969e66e14db9e740"};
const before: Record<string,any> = {}, expected: Record<string,any> = {};
for(const [file,hash] of Object.entries(inputHashes)) {
  const bytes=readFileSync(folder+'before/'+file.split('/').pop());
  assert.equal(sha(bytes),hash,'complete frozen input');
  before[file]=JSON.parse(bytes.toString()); expected[file]=structuredClone(before[file]);
}
for(const row of groups) {
  const slide=expected[row.file].slides.find((s:any)=>s.n===row.slide);
  const index=Number(row.field.slice(5,-1));
  assert.equal(slide.english.body[index],row.source);
  assert.deepEqual(slide.target.body[index],row.before);
  slide.target.body[index]=row.after;
}
let signature='';
export function ensureVeOrdinaryReviewedText() {
  const next=Object.keys(expected).map(file=>{const s=statSync(file,{bigint:true});return [file,s.ino,s.size,s.mtimeNs,s.ctimeNs].join(':');}).join('|');
  if(next===signature)return;
  for(const [file,value] of Object.entries(expected))assert.deepEqual(ordinaryFramingPairBefore(file, JSON.parse(readFileSync(file,'utf8'))),value,'complete checked Tshivenda layer and every unlisted source/target');
  signature=next;
}
export function veOrdinaryPairBefore<T>(file:string,actual:T):T {
  if (isCurrentOrBatchPredecessor(file, actual)) actual = veReadingFrostPairBefore(file, actual);
  ensureVeOrdinaryReviewedText();
  actual = ordinaryFramingPairBeforeHistory(file, actual);
  if(!(file in expected))return actual;
  assert.deepEqual(actual,expected[file],'caller supplies complete current layer');
  return structuredClone(before[file]);
}
export function veOrdinaryPairBeforeHistory<T>(file:string,actual:T):T {
  ensureVeOrdinaryReviewedText();
  actual = ordinaryFramingPairBeforeHistory(file, actual);
  if(!(file in expected))return actual;
  const restored:any=structuredClone(actual);
  for(const row of groups.filter((r:any)=>r.file===file)){
    const slide=restored.slides.find((s:any)=>s.n===row.slide);const index=Number(row.field.slice(5,-1));
    if(JSON.stringify(slide.target.body[index])===JSON.stringify(row.after))slide.target.body[index]=structuredClone(row.before);
  }
  return restored;
}
const assetBytes=readFileSync(folder+'converted-assets.json');
assert.equal(sha(assetBytes),'c60361bcb2959a3df30790949648e33fb5f6d6293124a8fc316b8c2451503886');
export const veOrdinaryAssets:any[]=JSON.parse(assetBytes.toString()).assets;
const oldManifest=readFileSync(folder+'before/manifest.ts.txt','utf8');
let finalManifest=oldManifest;
for(const row of veOrdinaryAssets){const line=`  '${row.url}': ${row.beforeBytes},`;assert.equal(finalManifest.split(line).length,2);finalManifest=finalManifest.replace(line,`  '${row.url}': ${row.afterBytes},`);}
const total=[...finalManifest.matchAll(/^  '[^']+': (\d+),$/gm)].reduce((sum,row)=>sum+Number(row[1]),0);
finalManifest=finalManifest.replace(/\d+\.\d+ MB/,(total/1024/1024).toFixed(1)+' MB');
export function veOrdinaryManifestBefore(actual:string){actual = ordinaryFramingManifestBefore(actual);assert.equal(actual,finalManifest,'complete manifest after only 15 measured changes');return oldManifest;}

export function veOrdinaryAssetBefore(path:string,bytes:Uint8Array){
  const latest = frostAssets[path.startsWith('public/') ? path.slice(6) : path]?.changed ? veReadingFrostAssetBefore(path, bytes) : null;
  if (latest) {
    const framing = ordinaryFramingAssets.find(row => 'public' + row.url === path);
    if (framing) {
      assert.equal(latest.bytes, framing.bytes, `${path}: exact root predecessor is the reviewed ordinary-framing output`);
      assert.equal(latest.sha256, framing.sha256, `${path}: root predecessor digest binds ordinary framing`);
      return { bytes: framing.beforeBytes, sha256: framing.beforeSHA256, width: framing.beforeDimensions[0], height: framing.beforeDimensions[1] };
    }
    return latest;
  }
  const newest = ordinaryFramingAssetBefore(path, bytes);
  const row=veOrdinaryAssets.find(r=>'public'+r.url===path);if(!row)return newest;
  assert.equal(newest?.bytes ?? bytes.length,row.afterBytes,path+': exact reviewed bytes');assert.equal(newest?.sha256 ?? sha(bytes),row.afterSHA256,path+': exact reviewed hash');
  return {bytes:row.beforeBytes,sha256:row.beforeSHA256,width:row.beforeDimensions[0],height:row.beforeDimensions[1]};
}
export function veOrdinaryPairBytesBefore(file:string,bytes:Uint8Array):Uint8Array{
  const newest = ordinaryFramingPairBytesBefore(file, bytes);
  if(!(file in expected))return newest;
  veOrdinaryPairBefore(file,JSON.parse(Buffer.from(bytes).toString()));
  assert.equal(Buffer.from(bytes).toString(),readFileSync(file,'utf8'),'caller bytes are actual current bytes');
  return readFileSync(folder+'before/'+file.split('/').pop());
}
