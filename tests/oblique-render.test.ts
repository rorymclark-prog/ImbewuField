import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { buildObliquePrompt, obliqueAnchors, obliqueAnchorBrief, obliqueRoofGuides, obliqueRoofBrief, fitObliqueReference, isObliqueJobStyle, obliqueJobStyle, obliqueStyleFromJob, obliqueStyleDescription,
  obliqueTerrainEvidence, paintObliqueReferenceBoard, OBLIQUE_BOARD, OBLIQUE_REVIEW_NOTICE } from '@/lib/oblique-render';
import { STYLE_LINES, type StylePreset } from '@/lib/producer-prompt';
import type { SheetContourResult } from '@/lib/sheet-contours';
import { normaliseRenderJobDoc, renderJobRequestError } from '@/lib/render-jobs';
import { createRenderSceneSnapshot, decodeRenderSceneSnapshot, type RenderSceneInput } from '@/lib/render-scene';
import { DEFAULT_PRODUCER_STYLE } from '@/lib/sheet-render-route';

const unavailable: SheetContourResult = { lines: [], intervalM: 1, tooFlat: false, status: 'unavailable', source: null };
const site = { elevation: { slopeDeg: 6.7, slopePct: 11.8, aspectDeg: 188, aspectLabel: 'S', directionConfidence: 'site-local-indicative' as const } };
const frame = { centerLng: 31.9, centerLat: -27.7, zoom: 18, imgW: 960, imgH: 640, mPerPx: 0.4 };
const contourLines: SheetContourResult = { ...unavailable, status: 'ok', source: 'mapbox-terrain-rgb', lines: [
  { points: [[0.2, 0.3], [0.8, 0.4]], elevM: 100, major: true },
  { points: [[0.2, 0.4], [0.8, 0.5]], elevM: 101, major: false },
] };

test('Oblique exposes every style even when entered from an exact or Sector sheet', () => {
  const source = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');
  const tree = ts.createSourceFile('DesignGlossy.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const initializers = new Map<string, string>();
  let selectStyle: string | undefined;
  let selectView: string | undefined;
  function walk(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.initializer)
      initializers.set(node.name.getText(tree), node.initializer.getText(tree));
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(tree) === 'button') {
      const attribute = node.openingElement.attributes.properties.find((attribute) => ts.isJsxAttribute(attribute)
        && attribute.name.getText(tree) === 'onClick' && attribute.initializer
        && attribute.initializer.getText(tree).includes('chooseStyle(s.key)')) as ts.JsxAttribute | undefined;
      if (attribute && attribute.initializer && ts.isJsxExpression(attribute.initializer))
        selectStyle = attribute.initializer.expression!.getText(tree);
      const viewAttribute = node.openingElement.attributes.properties.find((attribute) => ts.isJsxAttribute(attribute)
        && attribute.name.getText(tree) === 'onClick' && attribute.initializer
        && attribute.initializer.getText(tree).includes('setAiView(view)')) as ts.JsxAttribute | undefined;
      if (viewAttribute && viewAttribute.initializer && ts.isJsxExpression(viewAttribute.initializer))
        selectView = viewAttribute.initializer.expression!.getText(tree);
    }
    ts.forEachChild(node, walk);
  }
  walk(tree);
  function execute(expression: string, scope: Record<string, unknown>) {
    const js = ts.transpileModule(`const result = (${expression}); return result;`,
      { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    return new Function(...Object.keys(scope), js)(...Object.values(scope));
  }
  const styles = execute(initializers.get('PRODUCER_STYLES')!, {});
  const sectorStyles = execute(initializers.get('SECTOR_STYLE_CHOICES')!, { PRODUCER_STYLES: styles });
  for (const selectedSheet of [{ exact: 'base' }, { exact: 'sector' }, { exact: 'implementation' }, { exact: 'water' }, { filter: 'all' }, { filter: 'zones' }]) {
    for (const mode of ['exact', 'ai']) {
      const scope: Record<string,any> = { aiRenderOn: true, aiView: 'oblique', selectedSheet, mode, sectorAiMode: 'exact' in selectedSheet,
        phasingAiMode: false, PRODUCER_STYLES: styles, SECTOR_STYLE_CHOICES: sectorStyles };
      scope.topDownStyleChoices = execute(initializers.get('topDownStyleChoices')!, scope);
      const analytical = ('exact' in selectedSheet && ['base', 'sector', 'implementation'].includes(selectedSheet.exact!)) || selectedSheet.filter === 'zones';
      assert.deepEqual(scope.topDownStyleChoices.map((style:any) => style.key),
        (analytical ? sectorStyles : styles).map((style:any) => style.key),
        'Base, Sector and Phasing must not offer a top-down style that their renderer silently replaces');
      assert.equal(execute(initializers.get('aiLayerMode')!, scope), true,
        'choosing an angled view must expose its styles regardless of the previous finish');
      assert.deepEqual(new Set(execute(initializers.get('availableStyleChoices')!, scope).map((style:any) => style.key)),
        new Set(Object.keys(STYLE_LINES)), 'Sector restrictions belong only to top-down restyling');
      assert.equal(execute(initializers.get('aiLayerMode')!, { ...scope, aiView: 'top-down' }), true,
        'an approved user must be able to choose styling before switching an exact sheet to AI');
      assert.equal(execute(initializers.get('aiLayerMode')!, { ...scope, aiRenderOn: false }), false);
      assert.equal(execute(initializers.get('aiLayerMode')!, { ...scope, selectedSheet: null }), false);
    }
  }
  assert.equal(execute(initializers.get('aiLayerMode')!, { aiRenderOn: true, aiView: 'top-down',
    selectedSheet: { exact: 'base' }, mode: 'exact', sectorAiMode: false, phasingAiMode: false }), true,
  'Rory’s missing-step screenshot supersedes hiding styles in Exact: choosing appearance must be reachable before AI mode');
  assert.ok(selectStyle);
  for (const style of styles) {
    let selected = 'initial', queued = 0;
    const scope = { s: style, selectedSheet: { no:'02', exact: 'sector' }, aiView:'oblique', loading:null,
      manualUnderlaysRef:{current:new Set(['test:02'])},state:{siteId:'test'},
      setProducerStyle: (key:string) => { selected=key; }, setAnalysisStyle:()=>{},setExactSheet:()=>{},setMode:()=>{},
      applySheet:()=>{selected='seeded-default';},setResultImage:()=>{},enqueueRenderJobCapped:()=>{queued++;} };
    const chooseStyle = execute(initializers.get('chooseStyle')!, scope);
    execute(selectStyle!, { ...scope, chooseStyle })();
    assert.equal(selected, style.key, 'the selected card must win over applySheet seeding a default');
    assert.equal(queued, 0, 'changing appearance must not purchase an image');
    const description = obliqueStyleDescription(style.key);
    const prompt = buildObliquePrompt({ style: style.key, hasPhoto: true, terrain: obliqueTerrainEvidence(unavailable, null),
      designBrief: 'Saved design', elements: 'Saved inventory' });
    assert.equal(prompt.split('\n')[0], description, 'the visible style description must match the requested appearance');
    assert.ok(description.length > 0);
  }
  assert.equal(new Set(styles.map((style:any)=>obliqueStyleDescription(style.key))).size, styles.length,
    'different style choices must not all request the same appearance');
  assert.ok(selectView);
  for (const view of ['oblique','top-down']) for (const sectorAiMode of [true,false]) for (const style of styles) {
    let selected=style.key;
    execute(selectView!,{view,sectorAiMode,producerStyle:style.key,SECTOR_STYLE_CHOICES:sectorStyles,
      topDownStyleChoices:sectorAiMode?sectorStyles:styles,DEFAULT_PRODUCER_STYLE,setAiView:()=>{},setProducerStyle:(key:string)=>{selected=key;}})();
    assert.equal(selected,view==='top-down'&&sectorAiMode&&!sectorStyles.some((s:any)=>s.key===style.key)
      ? DEFAULT_PRODUCER_STYLE:style.key,
    'returning to top-down Sector replaces only an incompatible style; other choices stay selected');
  }
});

test('a reloaded oblique job keeps its viewpoint and style without changing legacy top-down jobs', () => {
  for (const preset of Object.keys(STYLE_LINES) as StylePreset[]) {
    assert.equal(obliqueStyleFromJob(obliqueJobStyle(preset)), preset);
    assert.equal(obliqueStyleFromJob(preset), null);
  }
  for (const invalid of ['oblique:v2:precision_atlas', 'oblique:v1:__proto__', 'oblique:v1:missing', 'oblique:']) {
    assert.equal(isObliqueJobStyle(invalid), true);
    assert.equal(obliqueStyleFromJob(invalid), null, 'unknown perspective versions must not silently become a top-down finisher');
  }
});

test('missing or a single contour height never masquerades as a measured terrain surface', () => {
  assert.equal(obliqueTerrainEvidence(contourLines, site).kind, 'contours');
  for (const result of [unavailable, { ...contourLines, lines: [contourLines.lines[0]] },
    { ...contourLines, lines: [contourLines.lines[0], contourLines.lines[0]] },
    { ...contourLines, source: null }, { ...contourLines, status: 'too-flat' as const }]) {
    assert.equal(obliqueTerrainEvidence(result, site).kind, 'indicative-slope');
    assert.equal(obliqueTerrainEvidence(result, null).kind, 'unavailable');
  }
  const slope = obliqueTerrainEvidence(unavailable, site);
  assert.match(slope.note, /6\.7 degrees.*188 degrees/);
  for (const elevation of [{ ...site.elevation, directionConfidence: 'unconfirmed' as const },
    { ...site.elevation, slopeDeg: NaN }, { ...site.elevation, aspectDeg: 360 }]) {
    assert.equal(obliqueTerrainEvidence(unavailable, { elevation }).kind, 'unavailable');
  }
  assert.match(obliqueTerrainEvidence(unavailable, null).note, /do not infer measured flat ground/);
});

test('vehicle access follows the site evidence, including a driveway traced on the west', () => {
  const base = { style: 'precision_atlas' as const, elements:'', designBrief:'', terrain:obliqueTerrainEvidence(unavailable,null) };
  assert.match(buildObliquePrompt({...base,hasPhoto:true}), /through-road past the property/);
  assert.doesNotMatch(buildObliquePrompt({...base,hasPhoto:false}), /driveway branching/);
  const lines: number[][] = [], captions: string[] = [];
  const ctx = new Proxy({}, {get: (_, key) => (...args: unknown[]) => {
    if (key === 'lineTo') lines.push(args as number[]);
    if (key === 'fillText') captions.push(String(args[0]));
  },set:()=>true}) as CanvasRenderingContext2D;
  const photo = { width: 400, height: 400 } as HTMLCanvasElement;
  const input = {design:photo,photo, boundary:[],frame:{...frame,satDataUrl:null},contours:unavailable,terrain:base.terrain};
  paintObliqueReferenceBoard(ctx,input);
  assert.ok(!captions.some(x=>x.includes('driveway trace')));
  paintObliqueReferenceBoard(ctx,{...input,driveway:[[.02,.4],[.22,.47]]});
  const r=fitObliqueReference(400,400,OBLIQUE_BOARD.photo);
  assert.ok(lines.some(([x,y])=>x===r.x+.22*r.w && y===r.y+.47*r.h));
  assert.ok(captions.some(x=>x.includes('driveway trace')));
});

test('the south camera shows the classroom end-on and the separate east-west store broadside', () => {
  type Ring = Array<[number, number]>;
  // On this narrow frame the classroom is wider than tall in normalized coordinates.
  // In ground metres it is twice as long north–south, so a normalized-axis test would fail.
  const classroom: Ring = [[.1,.2],[.3,.2],[.3,.3],[.1,.3]];
  const store: Ring = [[.5,.2],[.7,.2],[.7,.22],[.5,.22]];
  const state = { zones: [
    { id:'class', name:'Classroom', feature:'house' as const, zone:0 as const, points:classroom },
    { id:'store', name:'Store', feature:'house' as const, zone:0 as const, points:store },
    { id:'yard', name:'Yard', feature:'patio' as const, zone:0 as const, points:store },
  ] };
  const reference = { imgW:400, imgH:1600, mPerPx:.05 };
  const roofs = obliqueRoofGuides(state, { house:[...classroom].reverse() }, reference);
  assert.equal(roofs.length, 2);
  assert.equal(roofs[0].name, 'Classroom');
  assert.equal(roofs[0].bearing, 0);
  assert.ok(Math.abs(roofs[0].alongM - 8) < 1e-8 && Math.abs(roofs[0].acrossM - 4) < 1e-8);
  assert.equal(roofs[1].bearing, 90);
  assert.match(obliqueRoofBrief(roofs), /Classroom.*short end faces the viewer/);
  assert.match(obliqueRoofBrief(roofs), /Store.*long side runs across the view/);
  assert.doesNotMatch(obliqueRoofBrief(roofs), /Yard/);
  assert.equal(obliqueRoofBrief([]), '');
  assert.deepEqual(obliqueRoofGuides({zones:[]}, {house:[]}, reference), []);
  const compact = obliqueRoofGuides(state, {house:[]}, {...reference,imgH:800});
  assert.match(obliqueRoofBrief(compact), /Classroom.*compact footprint/);
  const photos: number[][] = [];
  const photo = { width:800, height:3200 } as HTMLCanvasElement;
  const ctx = new Proxy({}, {get: (_, key) => (...a: unknown[]) => {
    if (key === 'drawImage' && a[0] === photo && a.length === 9) photos.push(a.slice(1) as number[]);
  },set:()=>true}) as CanvasRenderingContext2D;
  paintObliqueReferenceBoard(ctx, {design: photo, photo, roofs, boundary:[], contours:unavailable,
    frame:{...frame,...reference,satDataUrl:null}, terrain:obliqueTerrainEvidence(unavailable,null)});
  assert.equal(photos.length, 1);
  const [x,y,w,h,,,projectedW,projectedH] = photos[0];
  for (const [actual, expected] of [[x,80],[y,640],[w,160],[h,320]]) assert.ok(Math.abs(actual-expected)<1e-8);
  assert.ok(Math.abs(projectedH/projectedW - 2*Math.sin(Math.PI/4)) < 1e-8);
});

test('tanks and hives remain anchored at their own end of the angled design', () => {
  const items = [
    { defId: 'jojo_5000', x: 0.25, y: 0.18 }, { defId: 'beehive', x: 0.19, y: 0.84 },
    { defId: 'beehive', x: 0.23, y: 0.84 }, { defId: 'veg_bed', x: 0.25, y: 0.64 },
    { defId: 'beehive', x: 1.2, y: 0.84 },
  ];
  const anchors = obliqueAnchors(items);
  assert.equal(anchors.length, 3);
  assert.equal(obliqueAnchorBrief([]), '');
  assert.match(obliqueAnchorBrief(anchors), /1 × tank \(far \/ north, left \/ west\)/);
  assert.match(obliqueAnchorBrief(anchors), /2 × hive \(near \/ south, left \/ west\)/);
  const marks: number[][] = [];
  const ctx = new Proxy({}, { get: (_, key) => (...a: number[]) => {
    if (key === 'arc' || (key === 'rect' && a[2] === 10)) marks.push(a);
  }, set: () => true }) as CanvasRenderingContext2D;
  const design = { width: 400, height: 600 } as HTMLCanvasElement;
  paintObliqueReferenceBoard(ctx, { design, anchors, contours: unavailable, frame: { ...frame, satDataUrl: null }, boundary: [],
    terrain: obliqueTerrainEvidence(unavailable, null) });
  const r = fitObliqueReference(400, 600 * Math.sin(Math.PI / 4), OBLIQUE_BOARD.groundView);
  assert.equal(marks.length, anchors.length);
  anchors.forEach(({ kind, x, y }, i) => {
    const inset = kind === 'hive' ? 5 : 0;
    assert.equal(marks[i][0] + inset, r.x + x * r.w);
    assert.equal(marks[i][1] + inset, r.y + y * r.h);
  });
});

test('reference images remain complete and undistorted on the board, including very tall farms', () => {
  for (const [width, height] of [[960, 640], [640, 2000], [3000, 200]]) {
    for (const box of [OBLIQUE_BOARD.design, OBLIQUE_BOARD.photo]) {
      const r = fitObliqueReference(width, height, box);
      assert.ok(Math.abs(r.w / r.h - width / height) < 1e-9);
      assert.ok(r.x >= box.x && r.y >= box.y);
      assert.ok(r.x + r.w <= box.x + box.w + 1e-9 && r.y + r.h <= box.y + box.h + 1e-9);
    }
  }
  assert.throws(() => fitObliqueReference(0, 1, OBLIQUE_BOARD.design));
});

test('the terrain panel uses actual projected contour points and labels without changing farm geometry', () => {
  const texts: string[] = []; const points: number[][] = []; const images: unknown[][] = [];
  const clips: string[] = [];
  const ctx = { fillRect() {}, strokeRect() {}, fillText(s: string) { texts.push(s); }, drawImage(...args: unknown[]) { images.push(args); },
    beginPath() {}, moveTo(x: number, y: number) { points.push([x, y]); }, lineTo(x: number, y: number) { points.push([x, y]); },
    closePath() {}, stroke() {}, save() {}, restore() {}, rect() {}, clip(rule = 'nonzero') {clips.push(rule);},
  } as unknown as CanvasRenderingContext2D;
  const boundary: Array<[number, number]> = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const input = { design: { width: 960, height: 640 } as HTMLCanvasElement,
    photo: { width: 960, height: 640 } as HTMLCanvasElement, contours: contourLines, frame: { ...frame, satDataUrl: null },
    terrain: obliqueTerrainEvidence(contourLines, site), boundary };
  const before = JSON.stringify(input);
  paintObliqueReferenceBoard(ctx, input);
  assert.equal(images.length, 4, 'the cropped exterior photo reaches the tilted guide as well as the full site photo panel');
  assert.ok(clips.includes('evenodd'), 'the exterior context must not overwrite the design inside the boundary');
  assert.equal(images[0][0], input.design);
  assert.equal(images[1][0], input.design, 'the oblique ground guide uses the exact same design pixels');
  assert.equal(images[2][0], input.photo);
  assert.deepEqual(images[2].slice(1), images[1].slice(1), 'the outside road uses the same camera projection as the plot');
  assert.equal(images[3][0], input.photo);
  const [,x,y,w,h] = images[1] as [unknown, number, number, number, number];
  assert.ok(x >= OBLIQUE_BOARD.groundView.x && y >= OBLIQUE_BOARD.groundView.y);
  assert.ok(x + w <= OBLIQUE_BOARD.groundView.x + OBLIQUE_BOARD.groundView.w + 1e-8);
  assert.ok(y + h <= OBLIQUE_BOARD.groundView.y + OBLIQUE_BOARD.groundView.h + 1e-8);
  assert.ok(Math.abs(h / w - (640 / 960) * Math.sin(Math.PI / 4)) < 1e-9);
  assert.ok(texts.includes('100 m') && texts.includes('101 m'));
  const r = fitObliqueReference(frame.imgW, frame.imgH, OBLIQUE_BOARD.terrain);
  assert.ok(points.some(([px, py]) => px === r.x + 0.2 * r.w && py === r.y + 0.3 * r.h));
  assert.equal(JSON.stringify(input), before);
  texts.length = 0;
  paintObliqueReferenceBoard(ctx, { ...input, terrain: obliqueTerrainEvidence(unavailable, null) });
  assert.ok(texts.some((text) => text.includes('Elevation unavailable')));
  assert.ok(!texts.includes('100 m'), 'unsupported elevations must never be painted');
});

test('oblique instructions request one angled image using layout, photo and honest terrain roles', () => {
  for (const style of Object.keys(STYLE_LINES) as StylePreset[]) {
    const prompt = buildObliquePrompt({ style, hasPhoto: true, terrain: obliqueTerrainEvidence(contourLines, site),
      elements: 'Two existing tanks', designBrief: 'Nine planned beds' });
    assert.match(prompt, /ONE finished oblique/);
    assert.match(prompt, /south.*looking north/);
    assert.match(prompt, /Two existing tanks/);
    assert.match(prompt, /Nine planned beds/);
    assert.match(prompt, /Tree crowns may overlap/);
    assert.match(prompt, /not a measured 3D reconstruction/);
    assert.match(prompt, /no.*scale bar/);
  }
  assert.match(OBLIQUE_REVIEW_NOTICE, /Not to scale/);
  assert.match(OBLIQUE_REVIEW_NOTICE, /Legend lists the saved design/);
});

test('an oblique job can resume through the existing owner-bound frozen scene and durable input', async () => {
  const input: RenderSceneInput = { state: { siteId: 'farm', frame, items: [], zones: [], lines: [], step: 'review', updatedAt: '2026-10-30' },
    frame: { ...frame, satDataUrl: null }, site, refLayers: { boundary: [[0, 0], [1, 0], [1, 1]], house: [], driveway: [] }, labelMode: 'names', underlay: 'plain',
    outputScale: 3, renderRecipe: 'r8', planVersion: 'v93' };
  const before = JSON.stringify(input);
  const scene = await createRenderSceneSnapshot(input);
  const jobId = 'farmer_20261030';
  const job = normaliseRenderJobDoc(jobId, { uid: 'farmer', siteId: 'farm', style: obliqueJobStyle('precision_atlas'),
    engine: 'openai', quality: 'low', outputMode: 'hybrid', status: 'complete', attemptId: 'oblique-attempt', ...scene,
    sheets: [{ key: 'all', label: 'Oblique design view', prompt: 'Frozen board roles and terrain evidence', status: 'done',
      inputPath: `renders/farmer/${jobId}/input-all.jpg`, outputPath: `renders/farmer/${jobId}/output-all.png`,
      geometryLock: false, showcase: false, resultKind: 'hybrid' }] });
  assert.ok(job);
  assert.equal(obliqueStyleFromJob(job.style), 'precision_atlas');
  const restored = await decodeRenderSceneSnapshot(job.sceneJson!, job.designRevision!);
  assert.deepEqual(restored.state, input.state);
  assert.equal(JSON.stringify(input), before);
  assert.equal(renderJobRequestError([{ key: 'all', label: 'Oblique', prompt: 'Use reference board',
    compositeDataUrl: 'data:image/png;base64,iVBORw0KGgo=', geometryLock: false, showcase: false, resultKind: 'hybrid' }]), null);
});

test('the oblique UI uses one guarded paid queue call and the saved raw-input gate before a perspective finisher', () => {
  const source = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');
  const start = source.indexOf('const generateObliqueViaQueue = useCallback(');
  const callback = source.slice(start, source.indexOf('\n  }, [', start));
  assert.match(callback, /!aiRenderOn \|\| isSampleMode\(\)/);
  assert.match(callback, /queueJobId \|\| gallerySiteId !== state.siteId/);
  assert.equal((callback.match(/await enqueueRenderJobCapped\(/g) ?? []).length, 1);
  assert.doesNotMatch(callback, /runLockedPolishFlow\(|useProtectMaskForEdit: true/);
  assert.match(callback, /decodeRenderSceneSnapshot/);
  assert.match(callback, /fetchSheetContours/);
  assert.match(callback, /paintObliqueReferenceBoard/);
  assert.match(source, /aiView === 'oblique' \? generateObliqueViaQueue\(\) : runLockedPolishFlow\('hybrid'\)/);
  const finisher = source.indexOf('if (obliqueStyle) {');
  assert.ok(source.lastIndexOf('await fetchRenderOutput(sheet.inputPath)', finisher) > 0);
  assert.ok(source.lastIndexOf("paidRenderDecision(diff, 'hybrid')", finisher) > 0);
  const perspective = source.slice(finisher, source.indexOf('// finishStyledSheet', finisher));
  assert.match(perspective, /resultKind: 'ai-illustrated'/);
  assert.match(perspective, /geometryLock: false/);
  assert.match(perspective, /obliqueArtwork: true/);
  assert.doesNotMatch(perspective, /restoreProtectedPixels|producerLabels|buildProtectMask/);
  assert.match(source, /if \(!options.obliqueArtwork\) \{\s+const pxPerM[\s\S]*?drawBlueprintScaleBar[\s\S]*?drawSheetNorthArrow/);
});
