import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  bedFootprintRegister,
  buildFinishedSheetPolishPrompt,
  buildPhasingRestylePrompt,
  buildLockedIllustrationPrompt,
  groundContractFor,
  isPhotoPreservingStyle,
} from '@/lib/producer-prompt';

// THE PLAIN UNDERLAY HAD NO CONTRACT OF ITS OWN, AND IT COST A PAID RENDER.
//
// The prompt has only ever answered "what is under this?" two ways: keep the photograph
// (photo_plan, satellite_overlay) or paint the ground away (everything else). Rory rendered
// AI Polished over the PLAIN underlay — white paper, no photograph anywhere — in the Photo Plan
// style, whose whole contract is "every pixel that is not overlay stays the supplied satellite
// image". There was no satellite image. The model resolved the contradiction by inventing a flat
// khaki ground, and the app then burned the exact artwork back over it, so the only visible thing
// the paid pass did was replace clean white paper with mud.
//
// Rory: "It's a mess tho it didn't look like ai polished anything", and on the next attempt:
// "Even with ChatGPT, it's a hybrid mess."

test('Photo Plan falls back to paper, while painted styles illustrate the saved property without a photo', () => {
  // Paper wins even for the two styles that would otherwise promise to keep a photograph — that
  // promise is unkeepable when there is no photograph, and an unkeepable absolute instruction is
  // exactly what this file already documents producing indistinguishable hybrids.
  assert.equal(groundContractFor('photo_plan', 'paper'), 'paper');
  assert.equal(groundContractFor('satellite_overlay', 'paper'), 'paper');
  // Rory's 30 October phone follow-up chooses a fully illustrated interior, with a white page.
  assert.equal(groundContractFor('homestead_storybook', 'paper'), 'paint');
  assert.equal(groundContractFor('precision_atlas', 'paper'), 'paint');
  // With a photograph present nothing changes: the style decides, exactly as before.
  assert.equal(groundContractFor('photo_plan', 'photo'), 'photo');
  assert.equal(groundContractFor('homestead_storybook', 'photo'), 'paint');
  // And the default keeps every existing caller on its current answer.
  assert.equal(groundContractFor('photo_plan'), 'photo');
  assert.equal(groundContractFor('homestead_storybook'), 'paint');
  assert.equal(isPhotoPreservingStyle('photo_plan'), true, 'the style predicate itself is unchanged');
});

test('on paper the model is told to invent no ground at all', () => {
  const prompt = buildLockedIllustrationPrompt('Planting', 'photo_plan', 'Mango Tree x4', '', 'paper');
  assert.match(prompt, /KEEP THE PAPER WHITE/);
  assert.match(prompt, /PLAIN WHITE PAPER/);
  assert.match(prompt, /EVERY OTHER PIXEL IS STILL WHITE PAPER/);
  // The two clauses that ORDER a painted ground must be absent — they are what produced the khaki.
  assert.doesNotMatch(prompt, /TONAL HIERARCHY/, 'a painted forest context must not be ordered on paper');
  assert.doesNotMatch(prompt, /MATERIAL SEPARATION/, 'gouache ground texture must not be ordered on paper');
  assert.doesNotMatch(prompt, /PAINT WHAT IS THERE/);
  // And it must not promise to preserve a photograph that does not exist.
  assert.doesNotMatch(prompt, /KEEP THE PHOTOGRAPH/);
  assert.doesNotMatch(prompt, /real photographed pixels/);
});

test('Photo Plan water on paper retains the no-invented-ground contract', () => {
  // The water branch carries its OWN copies of TONAL HIERARCHY and MATERIAL SEPARATION. They were
  // skipped only for photo-preserving styles, so on paper they would have re-opened the exact
  // contradiction the sheet-level branch closes.
  const prompt = buildLockedIllustrationPrompt('Water', 'photo_plan', 'JoJo Tank 2500L x1', '', 'paper');
  assert.doesNotMatch(prompt, /TONAL HIERARCHY/);
  assert.doesNotMatch(prompt, /MATERIAL SEPARATION/);
  assert.match(prompt, /KEEP THE PAPER WHITE/);
  assert.match(prompt, /WATER FEATURE ROLE/, 'the water direction itself must survive');
});

test('a painted paper property is illustrated inside its boundary without claiming an absent photo', () => {
  for (const layer of ['Water', 'Earthworks', 'Planting', 'Full design']) {
    const prompt = buildLockedIllustrationPrompt(layer, 'precision_atlas', 'Saved features only', '', 'paper');
    assert.match(prompt, /fully illustrated top-down/);
    assert.match(prompt, /There is no photograph/);
    assert.match(prompt, /page beyond the property pure white/);
    assert.match(prompt, /FINAL CHECK: the entire saved property is illustrated and the surrounding page is pure white/);
    assert.match(prompt, /each traced building into a complete detailed roof/);
    assert.match(prompt, /Unknown surfaces.*neutral texture/);
    assert.match(prompt, /do not infer crops, structures, terrain, contours or neighbouring land/);
    assert.doesNotMatch(prompt, /KEEP THE PAPER WHITE:|EVERY OTHER PIXEL IS STILL WHITE PAPER|the source contains a real aerial photograph|the entire frame is illustrated|the photo shows/);
    if (layer === 'Water') assert.match(prompt, /WATER FEATURE ROLE/);
  }
});

test('a painted water sheet derives its surroundings from the source instead of inventing a forest', () => {
  const prompt = buildLockedIllustrationPrompt('Water', 'homestead_storybook', 'JoJo Tank 2500L x1');
  assert.doesNotMatch(prompt, /forest context beyond the property/);
  assert.match(prompt, /preserve the source land-cover pattern/);
  assert.match(prompt, /keep unidentifiable surroundings neutral/);
  assert.match(prompt, /only surfaces identified in the source photograph or saved design/);
});

test('the photo and painted contracts are byte-for-byte what they were', () => {
  // This change must be invisible to every render that has a photograph under it.
  for (const style of ['photo_plan', 'satellite_overlay', 'homestead_storybook'] as const) {
    assert.equal(
      buildLockedIllustrationPrompt('Planting', style, 'Mango Tree x4', 'brief'),
      buildLockedIllustrationPrompt('Planting', style, 'Mango Tree x4', 'brief', 'photo'),
      `${style} must be unchanged when a photograph is present`,
    );
  }
  const painted = buildLockedIllustrationPrompt('Planting', 'homestead_storybook', 'Mango Tree x4');
  assert.match(painted, /PAINT WHAT IS THERE/);
  assert.match(painted, /TONAL HIERARCHY|MATERIAL SEPARATION|turn this exact saved design composite/);
});

test('the renderer tells the prompt which ground it actually has', () => {
  // satDataUrl is null ONLY on the plain underlay (frameForUnderlay drops it), so it is the honest
  // test for "is there a photograph". A source guard because DesignGlossy imports canvas and React.
  const glossy = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');
  const calls = [...glossy.matchAll(/buildLockedIllustrationPrompt\([^)]*\)/g)];
  assert.ok(calls.length >= 2, 'both locked-illustration call sites must be accounted for');
  for (const call of calls) {
    assert.match(call[0], /renderFrame\.satDataUrl \? 'photo' : 'paper'/,
      `a locked render is still asking for a photographed ground unconditionally: ${call[0]}`);
  }
});

// ── The INPUT, not just the prompt ────────────────────────────────────────────────────────────
//
// The prompt fix above shipped, Rory rendered again, and the sheet came back khaki AGAIN: "What
// ever you doing it's not working!" The prompt was fine — buildComposite, the function that builds
// the very picture the model is handed, filled its no-photo ground with #CBB98A (khaki) before
// drawing the marks. Photo Plan's contract is "keep every pixel of the supplied image", so the
// model was OBEYING: every "the AI invented a field" diagnosis had the direction wrong. And the
// locked pipeline restores unmarked pixels from that same source afterwards, so our own restore
// pass would re-khaki a render even if the model had painted white. Words versus picture: the
// picture always wins, so the picture must be white too.

import { PLAIN_PAPER_GROUND, paintPlainPaperGround } from '@/lib/sheet-underlay';

test('the ground painter paints the whole frame, in actual white pixels', () => {
  // A tiny raster ctx rather than a spy: the claim is about PIXELS a model will look at, so the
  // test rasterises. Parses #RRGGBB itself to stay honest about what fillStyle was set to.
  const W = 8, H = 5;
  const data = new Uint8ClampedArray(W * H * 4);
  const ctx = {
    fillStyle: '#000000' as string,
    fillRect(x: number, y: number, w: number, h: number) {
      const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(this.fillStyle));
      assert.ok(m, `fillStyle must be a plain hex colour, got ${String(this.fillStyle)}`);
      const [r, g, b] = [parseInt(m![1], 16), parseInt(m![2], 16), parseInt(m![3], 16)];
      for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) {
        const i = (py * W + px) * 4;
        data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
      }
    },
  };
  paintPlainPaperGround(ctx as unknown as CanvasRenderingContext2D, W, H);
  for (let i = 0; i < data.length; i += 4) {
    assert.deepEqual([data[i], data[i + 1], data[i + 2], data[i + 3]], [255, 255, 255, 255],
      `pixel ${i / 4} is not white paper`);
  }
  assert.equal(PLAIN_PAPER_GROUND.toUpperCase(), '#FFFFFF', 'paper means white, not another tint');
});

test('the model input builder uses the painter, and the khaki exists nowhere', () => {
  const glossySource = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');
  const designCanvasSource = readFileSync(new URL('../lib/design-canvas.ts', import.meta.url), 'utf8');
  // buildComposite's no-photo branch must go through the tested painter.
  const start = glossySource.indexOf('export async function buildComposite(');
  assert.ok(start > 0, 'buildComposite moved — update this guard, do not delete it');
  const body = glossySource.slice(start, glossySource.indexOf('\n}', start));
  assert.match(body, /paintPlainPaperGround\(ctx, imgW, imgH\)/,
    'the AI input ground must be painted by the tested painter');
  // The khaki must be gone from BOTH files — the photo-bake backdrop becomes satDataUrl, so its
  // margins ride into downstream sheets and AI inputs exactly like buildComposite's own fill.
  assert.doesNotMatch(glossySource, /CBB98A/i, 'khaki ground in the model input builder');
  assert.doesNotMatch(designCanvasSource, /CBB98A/i, 'khaki backdrop in the photo bake');
});

test('Earthworks stays at the digging stage in both paid passes and every visual style', () => {
  const styles = ['precision_atlas','photo_plan','master_atlas','chatgpt_atlas','field_ledger','homestead_storybook','extension_blueprint','karoo_folk','satellite_overlay'] as const;
  for (const style of styles) {
    for (const source of ['photo','paper'] as const) {
      const input=buildLockedIllustrationPrompt('Earthworks',style,'Vegetable Bed ×9, Tree pit to dig (one per tree) ×32, Swale ×2','Proposed fruit trees',source);
      assert.match(input,/BEFORE PLANTING/);
      assert.match(input,/one bare prepared bed/);
      assert.match(input,/one empty tree pit/);
      assert.match(input,/never blue water pipes/);
      assert.doesNotMatch(input,/planted beds into distinct cultivated rows|consistent top-down botanical map style|a PLANTED vegetable bed in full growth/);
      assert.match(input,/whole-site planting list describes a later stage/);
    }
    const polish=buildFinishedSheetPolishPrompt('Earthworks',style);
    assert.match(polish,/BEFORE PLANTING/);
    assert.doesNotMatch(polish,/PLANTED CONTENT:|fill each bed with neat top-down rows of leafy green crops/);
  }
  assert.match(buildFinishedSheetPolishPrompt('Planting','master_atlas'),/PLANTED CONTENT:/,'the growing-stage sheet must keep its planted-bed direction');
});

test('saved bed coordinates describe the same geometry at every print resolution without changing it', () => {
  const items=[{id:'bed-1',defId:'veg_bed',x:.2,y:.4,wM:12,hM:2,rot:17}, {id:'bed-2',defId:'veg_bed',x:.3,y:.5,wM:12,hM:2,rot:17}];
  const frozen=JSON.stringify(items),frame={imgW:1000,imgH:500,mPerPx:.1};
  const register=bedFootprintRegister(items,frame,'planting');
  assert.match(register,/2 separate saved rectangles/);
  assert.match(register,/centre\(20.00,40.00\), size\(12.00,4.00\), rotation 17deg/);
  assert.match(register,/centre\(30.00,50.00\)/);
  for(const scale of [1,2,3]) assert.equal(bedFootprintRegister(items,{imgW:frame.imgW*scale,imgH:frame.imgH*scale,mPerPx:frame.mPerPx/scale},'earthworks'),register);
  assert.equal(bedFootprintRegister(items,frame,'structures'),register,'Structures retains the exact sheet\'s planting context at its saved footprint');
  assert.equal(bedFootprintRegister(items,{...frame,mPerPx:0},'planting'),'');
  assert.equal(JSON.stringify(items),frozen);
  assert.match(buildLockedIllustrationPrompt('Planting','precision_atlas','Vegetable Bed ×2','','photo',register),/BED FOOTPRINTS/);
  assert.match(buildFinishedSheetPolishPrompt('Planting','precision_atlas',undefined,undefined,register),/BED FOOTPRINTS/);
});

test('the Phasing map-only upload never asks the model to reserve a nonexistent schedule panel', () => {
  const painted=buildPhasingRestylePrompt('precision_atlas');
  assert.match(painted,/MAP COLUMN/);
  assert.match(painted,/schedule panel is not in this image/);
  assert.match(painted,/no reserved legend or schedule area/);
  assert.match(painted,/Every bed keeps its outer corners/);
  assert.doesNotMatch(painted,/BLANK RIGHT-HAND PANEL|reserved for the schedule text|plain cream background/);
  assert.match(buildPhasingRestylePrompt('photo_plan'),/PHOTOGRAPHIC FINISH/);
});
