import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const root='';
const source=readFileSync(root+'app/sw.js/route.ts','utf8');
const expected=JSON.parse(readFileSync('docs/study-translation-reviews/blind-reviewed-corrections-2026-10-12/media-preflight.json','utf8')).map((x: {path: string})=>'/'+x.path.slice(7));
const match=source.match(/async function migrateBlindReviewedStudyCorrectionStills\(\) \{[\s\S]*?\n\}\n/);assert.ok(match);
assert.ok(source.includes('.then(migrateZuluSilentSentenceRepairs).then(migrateBlindReviewedStudyCorrectionStills).then(function () {'));
const preserved=['/course-decks/intro-permaculture/st/slide-22.webp','/course-audio/intro-permaculture/st/slide-22.mp3','/course-audio/intro-permaculture/ts/slide-05.mp3','/course-full/intro-permaculture/ts.mp4','/course-decks/intro-permaculture/ts/slide-21.webp','/course-decks/market-community/ts/slide-04.webp','/course-decks/small-livestock/st/slide-07.webp'];
async function check(code: string, shouldFail=false){
 const records=new Map([...expected,...expected.map((x: string)=>x+'?v=old'),...preserved].map((x: string)=>['https://imbewufield.vercel.app'+x,'saved']));
 const deletes: string[]=[];let fetches=0;
 const cache={match:async (p: string)=>records.get('https://imbewufield.vercel.app'+p),keys:async()=>[...records.keys()].map(url=>({url})),delete:async (req: {url: string})=>{deletes.push(req.url);return records.delete(req.url)},put:async(p: string,r: Response)=>records.set('https://imbewufield.vercel.app'+p,await r.text())};
 const context=vm.createContext({URL,Response,COURSE_CACHE:'imbewufield-course-v1',caches:{open:async (key: string)=>{assert.equal(key,'imbewufield-course-v1');return cache}},fetch:()=>{fetches++;throw Error('migration may not fetch')}});
 vm.runInContext(code,context);await vm.runInContext('migrateBlindReviewedStudyCorrectionStills()',context);
 try{
 assert.deepEqual(deletes.sort(),[...expected,...expected.map((x: string)=>x+'?v=old')].map((x: string)=>'https://imbewufield.vercel.app'+x).sort());
 for(const p of preserved)assert.equal(records.get('https://imbewufield.vercel.app'+p),'saved',p);
 assert.equal(fetches,0);
 const count=deletes.length;for(const p of expected)records.set('https://imbewufield.vercel.app'+p,'new reviewed still');
 await vm.runInContext('migrateBlindReviewedStudyCorrectionStills()',context);assert.equal(deletes.length,count,'second activation must retain redownloaded corrected slides');
 for(const p of expected)assert.equal(records.get('https://imbewufield.vercel.app'+p),'new reviewed still');
 if(shouldFail)throw Error('mutation escaped detection');
 }catch(e: any){if(!shouldFail||e.message==='mutation escaped detection')throw e;return true}
 return true;
}
test('corrected cards refresh once while preserving saved voice, recorded Sesotho and unlisted media', async () => {
  await check(match[0]);
});
test('the correction migration detects accidental voice eviction and repeated corrected-slide eviction', async () => {
  assert.ok(await check(match[0].replace(expected[0],'/course-audio/intro-permaculture/st/slide-22.mp3'),true),'audio eviction mutation must fail');
  assert.ok(await check(match[0].replace('  if (await cache.match(marker)) return;\n',''),true),'missing once marker must fail');
});
