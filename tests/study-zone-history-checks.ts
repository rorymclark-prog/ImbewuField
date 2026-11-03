import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// Adding the opt-in explorer must not relax the older byte-exact protections for
// lesson/quiz wiring and theme fixes. Remove only these two approved UI additions,
// then require every predecessor byte to match the already checked wave 17 page.
const ADDITIONS = [
  "const ZoneExplorer = dynamic(() => import('@/components/studies/ZoneExplorer'), { ssr: false });\n",
  "          {(lesson.id === 'intro-permaculture-l3' || lesson.id === 'food-forest-l1') && (\n            <ZoneExplorer lang={lang} initialFeature={lesson.id === 'food-forest-l1' ? 'food-forest' : undefined} />\n          )}\n\n",
] as const;
const PREDECESSOR_SHA='a361890bfdb03c22e74a01b61516f759cf93225ca20b83edf422aa37a9712272';

export function studyZoneSourceBefore<T extends string | Uint8Array>(file:string,supplied:T):T {
  if(file!=='app/student/page.tsx')return supplied;
  let source=typeof supplied==='string'?supplied:Buffer.from(supplied).toString();
  if(!ADDITIONS.some(addition=>source.includes(addition)))return supplied;
  for(const addition of ADDITIONS){
    assert.equal(source.split(addition).length-1,1,'Study explorer must have exactly one approved import and mount');
    source=source.replace(addition,'');
  }
  assert.equal(createHash('sha256').update(source).digest('hex'),PREDECESSOR_SHA,
    'Study explorer addition must preserve every other lesson, quiz and page byte');
  return(typeof supplied==='string'?source:Buffer.from(source))as T;
}
