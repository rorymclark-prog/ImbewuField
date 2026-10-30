import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildObliquePrompt, fitObliqueReference, isObliqueJobStyle, obliqueJobStyle, obliqueStyleFromJob,
  obliqueTerrainEvidence, paintObliqueReferenceBoard, OBLIQUE_BOARD, OBLIQUE_REVIEW_NOTICE } from '@/lib/oblique-render';
import { STYLE_LINES, type StylePreset } from '@/lib/producer-prompt';
import type { SheetContourResult } from '@/lib/sheet-contours';
import { normaliseRenderJobDoc, renderJobRequestError } from '@/lib/render-jobs';
import { createRenderSceneSnapshot, decodeRenderSceneSnapshot, type RenderSceneInput } from '@/lib/render-scene';

const unavailable: SheetContourResult = { lines: [], intervalM: 1, tooFlat: false, status: 'unavailable', source: null };
const site = { elevation: { slopeDeg: 6.7, slopePct: 11.8, aspectDeg: 188, aspectLabel: 'S', directionConfidence: 'site-local-indicative' as const } };
const frame = { centerLng: 31.9, centerLat: -27.7, zoom: 18, imgW: 960, imgH: 640, mPerPx: 0.4 };
const contourLines: SheetContourResult = { ...unavailable, status: 'ok', source: 'mapbox-terrain-rgb', lines: [
  { points: [[0.2, 0.3], [0.8, 0.4]], elevM: 100, major: true },
  { points: [[0.2, 0.4], [0.8, 0.5]], elevM: 101, major: false },
] };

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
  const ctx = { fillRect() {}, fillText(s: string) { texts.push(s); }, drawImage(...args: unknown[]) { images.push(args); },
    beginPath() {}, moveTo(x: number, y: number) { points.push([x, y]); }, lineTo(x: number, y: number) { points.push([x, y]); },
    closePath() {}, stroke() {}, save() {}, restore() {}, rect() {}, clip() {},
  } as unknown as CanvasRenderingContext2D;
  const boundary: Array<[number, number]> = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const input = { design: { width: 960, height: 640 } as HTMLCanvasElement,
    photo: { width: 960, height: 640 } as HTMLCanvasElement, contours: contourLines, frame: { ...frame, satDataUrl: null },
    terrain: obliqueTerrainEvidence(contourLines, site), boundary };
  const before = JSON.stringify(input);
  paintObliqueReferenceBoard(ctx, input);
  assert.equal(images.length, 2);
  assert.ok(texts.includes('100 m') && texts.includes('101 m'));
  const r = fitObliqueReference(frame.imgW, frame.imgH, OBLIQUE_BOARD.terrain);
  assert.deepEqual(points[4], [r.x + 0.2 * r.w, r.y + 0.3 * r.h]);
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
