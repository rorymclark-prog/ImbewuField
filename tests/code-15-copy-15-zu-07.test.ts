import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { controlT, type ControlLanguage } from './control-icon-renderers.ts';

// code-15/copy-15/zu-07 (2026-10-16 visual/UX audit), owned-files portion:
//   code-15 — app/account/page.tsx's 5 `outline-none` inputs had no focus-visible replacement
//     (globals.css's global ring is a zero-specificity :where() selector the utility class wins
//     over), so keyboard users lost the focus indicator on every field.
//   copy-15 — community post/profile photos were marked decorative (alt="") when they carry the
//     post's or person's own content; a screen-reader user heard nothing for them.
//   zu-07 — the fixed sample-mode "Tour" pill was hardcoded English in both SampleModeBanner and
//     AccountButton regardless of language, while MenuButton already showed isiZulu "Uhambo" for
//     the same control.
//
// Not touched: app/invoice/page.tsx, app/surveys/page.tsx, app/records/page.tsx,
// app/mentor/page.tsx, components/CropSelect.tsx, components/records/RecordQuantityFields.tsx,
// components/SavedPlaces.tsx, components/SiteSurveySheet.tsx, components/design/DesignCanvas.tsx,
// app/network/page.tsx, components/network/FarmerPanel.tsx, components/journal/FieldJournal.tsx,
// components/EvidenceSheet.tsx, components/MenuButton.tsx — all named in these findings'
// suggested file lists but outside this track's files.

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('code-15: every outline-none input in app/account/page.tsx has a focus-visible ring', () => {
  const src = source('../app/account/page.tsx');
  const outlineNoneCount = (src.match(/outline-none/g) ?? []).length;
  const ringCount = (src.match(/outline-none focus-visible:ring-2 focus-visible:ring-\[var\(--gold\)\]/g) ?? []).length;
  assert.equal(outlineNoneCount, 5, 'the input count changed; re-check whether this test still covers all of them');
  assert.equal(ringCount, 5, 'every outline-none element must also carry the focus-visible ring');
});

// Literal English templates stopped being the contract once accessibility text gained native drafts.
// Evaluate the real JSX alt expressions; owner/ordinal context and the exact English source must survive.
function photoCaption(file:string,src:string) {
  const tree=ts.createSourceFile(file,source(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const matches:ts.JsxAttribute[]=[];
  function visit(node:ts.Node){
    if((ts.isJsxSelfClosingElement(node)||ts.isJsxOpeningElement(node))&&node.tagName.getText(tree)==='img'){
      const props=node.attributes.properties.filter(ts.isJsxAttribute);
      const actualSrc=props.find(p=>p.name.getText(tree)==='src')?.initializer;
      if(actualSrc&&ts.isJsxExpression(actualSrc)&&actualSrc.expression?.getText(tree)===src){const alt=props.find(p=>p.name.getText(tree)==='alt');if(alt)matches.push(alt);}
    }
    ts.forEachChild(node,visit);
  }
  visit(tree);assert.equal(matches.length,1,`one photo caption for ${file}/${src}`);
  const value=matches[0].initializer;assert.ok(value&&ts.isJsxExpression(value)&&value.expression,'a content photo needs a context-dependent caption');
  const code=ts.transpileModule(`return (${value.expression.getText(tree)});`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  return(scope:Record<string,unknown>)=>String(new Function('scope',`with(scope){${code}}`)(scope));
}
function requirePhotoContext(kind:'board'|'profile'|'public',caption:string,expected:{name:string;number:number;total:number}){
  assert.ok(caption.trim(),'a content photo must not be decorative');
  if(kind!=='profile')assert.ok(caption.includes(expected.name),'the original farmer identity stays in the caption');
  if(kind!=='board')assert.ok(caption.includes(String(expected.number)),'the actual photo ordinal stays in the caption');
  if(kind==='public')assert.ok(caption.includes(String(expected.total)),'the actual gallery count stays in the caption');
  const framing=caption.replaceAll(expected.name,'').replace(/\d+/g,'').replace(/[^\p{L}]/gu,'');
  assert.ok(framing.length>1,'identity/numbers alone do not describe a photograph');
}
test('copy-15: community post/profile/public-profile photos describe their original owner and actual photo number in every language',()=>{
  const board=photoCaption('../app/community/page.tsx','p.photo_url');
  const profile=photoCaption('../app/community/profile/page.tsx','url');
  const publicProfile=photoCaption('../app/community/u/[uid]/page.tsx','url');
  for(const lang of ['en','zu','st','ts','ve'] as ControlLanguage[])for(const[number,total]of[[1,4],[7,9]]){
    const name='QA {number} $& farmer',scope={t:controlT(lang),p:{owner_name:name},i:number-1,profile:{display_name:name,photos:Array(total).fill('qa-photo')}};
    const captions={board:board(scope),profile:profile(scope),public:publicProfile(scope)};
    for(const kind of ['board','profile','public']as const)requirePhotoContext(kind,captions[kind],{name,number,total});
    if(lang==='en'){assert.equal(captions.board,`Photo posted by ${name}`);assert.equal(captions.profile,`Profile photo ${number}`);assert.equal(captions.public,`Photo of ${name}, ${number} of ${total}`);}
  }
  assert.doesNotMatch(source('../app/community/page.tsx'),/data-photo-preview src=\{p\.photo_url\} alt=""/);
});
test('the photo-description guard rejects decorative, anonymous and wrong-number captions',()=>{
  const expected={name:'QA Farmer',number:7,total:9};
  for(const[kind,caption]of[['board',''],['board','Photo posted by another farmer'],['profile','Profile photo 1'],['public','Photo of QA Farmer, 7 of 4']]as const)assert.throws(()=>requirePhotoContext(kind,caption,expected));
});

test('zu-07: SampleModeBanner and AccountButton share the tourPill translation key', () => {
  const banner = source('../components/SampleModeBanner.tsx');
  const button = source('../components/AccountButton.tsx');
  assert.match(banner, /\{t\('tourPill'\)\}/);
  assert.match(button, /isSampleMode\(\) \? t\('tourPill'\)/);
  assert.doesNotMatch(button, /isSampleMode\(\) \? 'Tour'/, 'must no longer be a hardcoded English literal');

  const i18n = source('../lib/i18n.tsx');
  const zuLocale = source('../lib/locales/zu.ts');
  assert.match(i18n, /tourPill: 'Tour',/);
  assert.match(zuLocale, /tourPill: 'Uhambo',/, 'must match MenuButton.tsx\'s own hardcoded isiZulu text for this control');
});
