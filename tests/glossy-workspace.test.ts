import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const glossy = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../components/design/DesignGlossy.module.css', import.meta.url), 'utf8');
const page = readFileSync(new URL('../app/design/page.tsx', import.meta.url), 'utf8');

test('Glossy owns the whole studio width instead of inheriting the drawing rails', () => {
  assert.match(page, /canvasState && canvasState\.step !== 'glossy'/,
    'the drawing wizard must not stay mounted beside Preview & Export');
  assert.match(page, /marginLeft: isPhone \|\| canvasState\?\.step === 'glossy' \? 0 : 232/);
  assert.match(page, /marginRight: isPhone \|\| canvasState\?\.step === 'glossy' \? 0 : 328/);
});

test('the live Glossy component, not the prototype route, owns all three preview rails', () => {
  assert.match(glossy, /className=\{compact \? undefined : styles\.settingsRail\}/);
  assert.match(glossy, /className=\{compact \? undefined : styles\.mapStage\}/);
  assert.match(glossy, /className=\{styles\.savedRail\}/);
  assert.match(css, /grid-template-columns:\s*minmax\(250px, 300px\) minmax\(0, 1fr\) minmax\(250px, 300px\)/);
  assert.doesNotMatch(glossy, />Preview &amp; Export</,
    'new farmer-facing workspace text must remain attached to the active app language');
});

test('saved-map rail stays thumbnail-only and the centre loads at most one full image', () => {
  const railStart = glossy.indexOf('<aside className={styles.savedRail}');
  const modalStart = glossy.indexOf('{/* ── Saved-maps gallery', railStart);
  assert.ok(railStart > 0 && modalStart > railStart, 'saved-map rail boundaries moved');
  const rail = glossy.slice(railStart, modalStart);

  assert.match(rail, /<img src=\{item\.thumb\}/,
    'the list must render its small thumbnails, not decode every full saved sheet');
  assert.doesNotMatch(rail, /item\.image \?\?/,
    'a full-image fallback in every rail row recreates the iPhone memory crash');
  assert.match(glossy, /const railPreviewImage = galleryViewItem\s*\? \(galleryViewImage \?\? galleryViewItem\.image/,
    'the selected row should be the only saved sheet promoted to the centre preview');
});

test('saved-map preview downloads the selected durable image and clears when settings change', () => {
  assert.match(glossy, /link\.href = stageResultImage/);
  assert.match(glossy, /onClick=\{handleStageDownload\}/);
  assert.match(glossy, /galleryViewItem\.resultKind === 'exact'[\s\S]*?t\('designGlossyExactCanvas'\)/,
    'the export summary must describe the saved sheet being previewed, not stale style controls');
  assert.match(glossy, /\[producerStyle, selectedNo, underlay\]/,
    'an old saved image must not impersonate newly selected controls');
});

test('a completed free Exact map no longer keeps saying it is building', () => {
  const exactStart = glossy.indexOf('const renderDesignMap = useCallback');
  const exactEnd = glossy.indexOf('// Deterministic Implementation', exactStart);
  assert.ok(exactStart > 0 && exactEnd > exactStart, 'exact renderer boundaries moved');
  assert.match(glossy.slice(exactStart, exactEnd), /else if \(!hybridAfterExactRef\.current\)[\s\S]*?setNotice\(null\)/,
    'the success path must clear its progress line unless it is advancing into paid Hybrid');
});

test('desktop, tablet and phone each have an explicit responsive layout', () => {
  assert.match(css, /@media \(max-width: 900px\)/,
    'landscape tablets should keep all three rails beside one another like the approved reference');
  const phoneCss = css.slice(css.indexOf('@media (max-width: 760px)'));
  assert.ok(phoneCss.length > 0, 'the phone breakpoint is missing');
  assert.match(phoneCss, /\.workspace \{[\s\S]*?display: flex;[\s\S]*?flex-direction: column;/,
    'phone layout must become a scrollable single column rather than crush three rails together');
});
