import { reportRecordedSourceLabel } from '../lib/report-localisation.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import typescript from 'typescript';
import { ELEMENTS_BY_ID } from '../lib/design-elements.ts';
import { plantCodesForSheet } from '../lib/plant-codes.ts';
import { BED_DEF_IDS } from '../lib/design-beds-bridge.ts';
import { sitePlanFigure, landUseFigure, statusFigure, siteReportFigures, type ReportFigure } from '../lib/report-figures.ts';
import { REPORT_VISUAL_COPY, reportVisualText, siteReportVisuals, withReportFigures } from '../lib/report-visuals.ts';
import type { DesignCanvasState } from '../lib/design-canvas.ts';
import type { MapRefLayers } from '../lib/base-layers.ts';
import type { ReportSiteFacts } from '../lib/report-site-facts.ts';
import type { LocationData } from '../lib/types.ts';
import type { PhasePlan } from '../lib/phasing.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const fixture = JSON.parse(read('tests/fixtures/report-figures-translation/source-cases.json')) as {
  canvas: DesignCanvasState; refs: MapRefLayers; facts: ReportSiteFacts; location: LocationData;
  phasePlan: PhasePlan; figures: Record<'en'|'zu', ReportFigure[]>;
};
const before = JSON.parse(read('tests/fixtures/report-figures-translation/source-pairs.json')) as {
  pairs: Array<{english:string;zu:string}>; catalogueSources:string[];
};
const languages = ['zu','st','ts','ve'] as const;
const sources = new Map(REPORT_VISUAL_COPY.map(row=>[row.english,row]));
const selected = new Set(['site-plan','land-use','status']);
const all = (language:string, canvas=fixture.canvas) => siteReportFigures(fixture.facts,fixture.location,language,{canvas,mapLayers:fixture.refs,phasePlan:fixture.phasePlan});
const words = (svg:string) => [...svg.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)].map(row=>row[1].replace(/&amp;/g,'&').replace(/&apos;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>')).join(' ').replace(/\s+/g,' ');
const normalize = (text:string) => text.replace(/\s+/g,' ').trim();

function audit(text:string) {
  const tree=typescript.createSourceFile('figures.ts',text,typescript.ScriptTarget.Latest,true);
  const pairs:Array<{english:string;zu:string}>=[];
  for(const node of tree.statements){
    if(!typescript.isFunctionDeclaration(node)||!node.name||!['sitePlanFigure','landUseFigure','statusFigure','siteReportFigures'].includes(node.name.text))continue;
    function visit(n:typescript.Node){
      if(typescript.isCallExpression(n)&&typescript.isIdentifier(n.expression)&&['t','reportVisualText'].includes(n.expression.text)&&n.arguments[0]&&typescript.isStringLiteral(n.arguments[0])){
        assert.ok(sources.has(n.arguments[0].text),`unregistered diagram source: ${n.arguments[0].text}`);
        if(n.expression.text==='t'&&n.arguments[1]&&typescript.isStringLiteral(n.arguments[1]))pairs.push({english:n.arguments[0].text,zu:n.arguments[1].text});
      }
      typescript.forEachChild(n,visit);
    }visit(node);
  }
  return pairs;
}

test('the three translated drawings retain every existing source pair and new diagram text cannot silently fall back',()=>{
  assert.deepEqual(audit(read('lib/report-figures.ts')),before.pairs.map(({english,zu})=>({english,zu})));
  assert.throws(()=>audit("function statusFigure(){return t('New unregistered status caveat','okusha');}"),/unregistered diagram source/);
  for(const row of before.pairs)assert.equal(reportVisualText(row.english,'zu',{},row.zu),row.zu);
  for(const language of languages){
    const result=reportVisualText('{count} staple plots (P1–P{count})',language,{count:12});
    assert.ok(result.includes('12'));assert.ok(result.includes('P1–P12'));assert.ok(!result.includes('{count}'));
  }
});

test('English drawings remain exact and native drawings keep all original figures and inputs',()=>{
  const snapshot=JSON.stringify(fixture);
  assert.deepEqual(all('en'),fixture.figures.en);
  for(const language of languages){
    const figures=all(language);
    assert.deepEqual(figures.map(f=>f.id),fixture.figures.en.map(f=>f.id),'no drawing disappears behind the aggregator catch');
    for(const figure of figures.filter(f=>selected.has(f.id))){
      const original=fixture.figures.en.find(f=>f.id===figure.id)!;
      for(const key of ['title','note','alt'] as const)assert.notEqual(figure[key],original[key],`${language} ${figure.id} ${key}`);
      assert.equal(figure.width,original.width);assert.equal(figure.height,Number(/height="(\d+)"/.exec(figure.svg)![1]));
    }
  }
  assert.equal(JSON.stringify(fixture),snapshot,'drawing may not mutate saved geometry, names or measurements');
});

test('native plan labels leave the north-up ground projection, bed codes and species identities exact',()=>{
  const english=sitePlanFigure(fixture.canvas,'en',fixture.refs)!;
  const projection=(svg:string)=>svg.split('<g clip-path="url(#plan)">')[1].split('</g>')[0];
  const codes=plantCodesForSheet(fixture.canvas.items.map(row=>row.defId));
  for(const language of languages){
    const figure=sitePlanFigure(fixture.canvas,language,fixture.refs)!;
    assert.equal(projection(figure.svg),projection(english.svg));
    // The shared code map also contains bed IDs; bed numbers belong to the bed legend, not the plant-name key.
    for(const [id,code]of codes)if(!(BED_DEF_IDS as readonly string[]).includes(id))assert.ok(words(figure.svg).includes(`${code} ${ELEMENTS_BY_ID[id].name}`),'plant names are identities, not translation candidates');
    assert.ok(figure.alt.includes(' m.'));assert.ok(figure.note.includes(reportVisualText('It is not a land survey.',language)));
    assert.ok(figure.note.includes(reportVisualText('Bed numbers match the bed list. ',language).trim()));
  }
});

test('every default equipment label has a draft while saved English-looking names remain exact',()=>{
  const defs=Object.values(ELEMENTS_BY_ID),codes=plantCodesForSheet(defs.map(d=>d.id));
  const defaults=defs.filter(d=>!codes.has(d.id)&&!(BED_DEF_IDS as readonly string[]).includes(d.id));
  assert.deepEqual(defaults.map(d=>d.name),before.catalogueSources,'new equipment needs a source-bound draft too');
  for(const language of languages)for(const def of defaults){
    assert.ok(sources.has(def.name));assert.notEqual(reportVisualText(def.name,language),def.name);
    const canvas={...fixture.canvas,items:[{...fixture.canvas.items[0],defId:def.id,label:undefined}],zones:[],lines:[]};
    const figure=sitePlanFigure(canvas,language)!;
    assert.ok(words(figure.svg).includes(normalize(reportVisualText(def.name,language))),`${language}: full ${def.name} survives a clipped symbol label`);
    const custom=sitePlanFigure({...canvas,items:[{...canvas.items[0],label:'Rain Barrel'}]},language)!;
    assert.ok(words(custom.svg).includes('Rain Barrel'),'farmer-entered words may equal a known source and must remain unchanged');
  }
});

test('land shares, progress marks and missing-data rules survive longer translated words',()=>{
  const english=landUseFigure(fixture.facts)!;
  const areas=(svg:string)=>[...svg.matchAll(/<rect[^>]+ y="38"[^>]+>/g)].map(m=>m[0]);
  // The last two circles are legend swatches and move horizontally with their translated words.
  const marks=(svg:string)=>[...svg.matchAll(/<circle[^>]+>/g)].slice(0,-2).map(m=>m[0].replace(/cy="[^"]+"/,'cy="ROW"'));
  const swatches=(svg:string)=>[...svg.matchAll(/<circle[^>]+>/g)].slice(-2).map(m=>m[0].replace(/c[xy]="[^"]+"/g,'POSITION'));
  const counts=(svg:string)=>words(svg).match(/\d+ \/ \d+/g);
  const status=statusFigure(fixture.canvas)!;
  for(const language of languages){
    const native=landUseFigure(fixture.facts,language)!;
    assert.deepEqual(areas(native.svg),areas(english.svg));assert.deepEqual(native.alt.match(/\d[\d ]* m²/g),english.alt.match(/\d[\d ]* m²/g));
    assert.ok(words(native.svg).includes(normalize(reportVisualText('Everything else: paths, trees, yard, open ground',language))),'the whole remainder label stays readable');
    // Tshivenda can fit on one line; the longer Xitsonga case must expand rather than collide with the values.
    if(language==='ts')assert.ok(native.height>english.height,'long remainder labels get more room');
    const progress=statusFigure(fixture.canvas,language)!;
    assert.deepEqual(marks(progress.svg),marks(status.svg));assert.deepEqual(swatches(progress.svg),swatches(status.svg));assert.deepEqual(counts(progress.svg),counts(status.svg));
    assert.equal(landUseFigure(null,language),null);assert.equal(statusFigure(null,language),null);assert.equal(sitePlanFigure(null,language),null);
    assert.equal(landUseFigure({...fixture.facts,boundary:{areaM2:1,source:'Original source'}},language),null,'oversubscribed area is not silently scaled to fit');
  }
});

test('original evidence attribution and the changed-design warning reach the selected-language chart',()=>{
  for(const language of languages){
    const changed={...fixture.facts.design!,bedCount:(fixture.facts.design?.bedCount??0)+1};
    const figures=siteReportFigures(fixture.facts,fixture.location,language,{canvas:fixture.canvas,mapLayers:fixture.refs,designToday:changed});
    const caution=reportVisualText('The design has changed since this report was written. This picture shows the design as it is today.',language);
    for(const figure of figures.filter(f=>['site-plan','status'].includes(f.id)))assert.ok(figure.note.startsWith(caution));
    // Known collector provenance is now translated. Keep its meaning and still preserve arbitrary
    // recorded source annotations, rather than pinning an English metadata sentence.
    assert.ok(landUseFigure(fixture.facts,language)!.source.includes(reportRecordedSourceLabel(fixture.facts.boundary!.source,language)));
    const customFacts={...fixture.facts,boundary:{...fixture.facts.boundary!,source:'Recorded field notebook annotation'}};
    assert.ok(landUseFigure(customFacts,language)!.source.includes(customFacts.boundary.source));
    const visuals=withReportFigures(siteReportVisuals(fixture.facts,fixture.location,language),figures,language);
    for(const figure of figures.filter(f=>selected.has(f.id))){
      const chart=visuals.charts.find(chart=>chart.figure?.id===figure.id)!;
      assert.equal(chart.figure,figure);assert.ok(chart.note.includes(figure.source));assert.equal(chart.title,figure.title);
    }
  }
});
