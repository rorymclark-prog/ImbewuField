import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, readdirSync, copyFileSync, symlinkSync, rmSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { silentIntroIntegration, validateSilentIntroMedia, silentIntroAssetSizesBefore, silentIntroMediaBefore, verifySilentIntroAsset, verifySilentIntroFrame } from './intro-silent-media-history-checks.ts';
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
test('the silent Introduction release validates25 measured assets and1902 unlisted assets before the exact post967 manifest rewind',()=>{
  validateSilentIntroMedia();
  assert.equal(sha(silentIntroAssetSizesBefore()),'60064c611c8140cd6b20875a8f673a933b9007f523a46460933d866b493d3571');
  const prior=silentIntroIntegration.actualAssets.filter((f:any)=>f.beforeBytes!==null);
  assert.equal(prior.length,3);
  for(const f of prior) assert.deepEqual(silentIntroMediaBefore(f.path),{bytes:f.beforeBytes,sha256:f.beforeSHA256});
});
test('extra or unlisted manifest entries and wrong measured aggregate cannot expose any dated silent-release media',()=>{
  const actual=readFileSync('lib/course-asset-sizes.ts','utf8');
  for(const mutated of [actual.replace('});',"  '/unlisted-extra.webp': 1,\n});"),actual.replace(silentIntroIntegration.finalManifest.summaryLine,'// Incorrect aggregate'),actual.replace("'/course-decks/intro-permaculture/st/slide-22.webp':", "'/renamed-old-st.webp':")]){
    assert.notEqual(mutated,actual);assert.throws(()=>silentIntroAssetSizesBefore(mutated));
  }
});
test('same-size new-frame corruption and dimension changes fail before historical descriptors, without editing protected assets',()=>{
  const frame=silentIntroIntegration.actualAssets[0];const bytes=readFileSync(frame.path);
  const corrupted=Buffer.from(bytes);corrupted[corrupted.length-1]^=1;
  assert.throws(()=>verifySilentIntroFrame(frame,corrupted));
  assert.throws(()=>verifySilentIntroFrame({...frame,height:frame.height-1},bytes));
  const old='/course-decks/intro-permaculture/st/slide-22.webp';const archive=readFileSync('public'+old);const bad=Buffer.from(archive);bad[bad.length-1]^=1;
  assert.throws(()=>verifySilentIntroAsset(old,bad),'unlisted archive corruption must also fail');
});

// 6 October 2026: a previously initialized historical view must not hide later disk drift.
// Use a real copied unlisted asset in an isolated child workspace so parallel test files
// never observe a deliberately corrupted public asset in the shared checkout.
test('same-size unlisted disk mutation after initialization withdraws the entire historical view',()=>{
  const fixture=mkdtempSync(join(tmpdir(),'imbewu-silent-media-mutation-'));
  const originalRoot=process.cwd();
  function mirror(source:string,target:string,parts:string[]) {
    mkdirSync(target,{recursive:true});
    for(const name of readdirSync(source)) {
      const from=join(source,name),to=join(target,name);
      if(name===parts[0]) {
        if(parts.length===1) copyFileSync(from,to);
        else mirror(from,to,parts.slice(1));
      } else symlinkSync(from,to,statSync(from).isDirectory()?'dir':'file');
    }
  }
  try {
    for(const name of ['docs','lib']) symlinkSync(join(originalRoot,name),join(fixture,name),'dir');
    mirror(join(originalRoot,'public'),join(fixture,'public'),['course-images','vegetables-staples','vegetables-staples-l1.jpg']);
    const helper=pathToFileURL(join(originalRoot,'tests/intro-silent-media-history-checks.ts')).href;
    execFileSync(process.execPath,['--input-type=module','-e',`
      import assert from 'node:assert/strict';
      import {readFileSync,writeFileSync} from 'node:fs';
      import {validateSilentIntroMedia} from ${JSON.stringify(helper)};
      validateSilentIntroMedia();
      const path='public/course-images/vegetables-staples/vegetables-staples-l1.jpg';
      const original=readFileSync(path);const corrupt=Buffer.from(original);corrupt[corrupt.length-1]^=1;
      writeFileSync(path,corrupt);
      // The later full-inventory guard can reject first. Both routes must name
      // this actual same-size corrupted asset, not an unrelated setup failure.
      assert.throws(()=>validateSilentIntroMedia(),error=>
        error instanceof Error && error.message.includes(path) &&
        /entire current inventory SHA|exact current inventory hash/.test(error.message));
      writeFileSync(path,original);validateSilentIntroMedia();
    `],{cwd:fixture,stdio:'pipe'});
  } finally {rmSync(fixture,{recursive:true,force:true});}
});
