import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const glossy = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../components/design/DesignGlossy.module.css', import.meta.url), 'utf8');
const page = readFileSync(new URL('../app/design/page.tsx', import.meta.url), 'utf8');

test('Glossy owns the whole studio width instead of inheriting the drawing rails', () => {
  assert.match(page, /canvasState && canvasState\.step !== 'glossy'/,
    'the drawing wizard must not stay mounted beside Preview & Export');
  assert.match(page, /marginLeft: isPhone \|\| canvasState\?\.step === 'glossy' \? 0 : desktopPanelLayout\.elements \+ 24/,
    'the drawing map must keep a gutter matching the farmer-adjusted Elements dock');
  assert.match(page, /marginRight: isPhone \|\| canvasState\?\.step === 'glossy' \? 0 : desktopPanelLayout\.layers \+ 24/,
    'the drawing map must keep a gutter matching the farmer-adjusted Layers dock');
});

test('the live Glossy component, not the prototype route, owns all three preview rails', () => {
  assert.match(glossy, /className=\{compact \? undefined : styles\.settingsRail\}/);
  assert.match(glossy, /className=\{compact \? undefined : styles\.mapStage\}/);
  assert.match(glossy, /className=\{styles\.savedRail\}/);
  assert.match(css, /grid-template-columns:\s*minmax\(250px, 300px\) minmax\(0, 1fr\) minmax\(250px, 300px\)/);
  assert.doesNotMatch(glossy, />Preview &amp; Export</,
    'new farmer-facing workspace text must remain attached to the active app language');
});

test('Preview map chooses a starting sheet without reviving the retired compact workspace', () => {
  assert.match(glossy, /const compact = false;/);
  assert.doesNotMatch(glossy, /const compact = initialFilter != null/,
    'a starting filter is navigation state, not permission to swap the entire Glossy UI');
});

test('the left rail reads as one numbered Preview & Export workflow', () => {
  assert.match(glossy, /className=\{styles\.controlsBackdrop\}/);
  for (let number = 1; number <= 6; number += 1) {
    assert.match(glossy, new RegExp(`WorkflowHeading number=\\{${number}\\}`));
  }
  assert.match(css, /\.controlsBackdrop \{[\s\S]*?grid-row: 2 \/ span 2;/,
    'settings and finish controls should sit on one visual panel rather than swapped cards');
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

test('saved maps can switch sites without retargeting the open design or a paid render', () => {
  const railStart = glossy.indexOf('<aside className={styles.savedRail}');
  const modalStart = glossy.indexOf('{/* ── Saved-maps gallery', railStart);
  const rail = glossy.slice(railStart, modalStart);

  assert.match(rail, /<select[\s\S]*?value=\{gallerySiteId\}[\s\S]*?gallerySiteOptions\.map/,
    'the live Saved maps rail needs a direct site selector');
  assert.match(glossy, /loadSheetMetas\(gallerySiteId\)/,
    'changing the selector must load the chosen site, not keep showing the open design');
  assert.match(glossy, /clearSheets\(gallerySiteId\)/,
    'Manage → Clear must apply to the site named by the gallery selector');
  assert.match(glossy, /sheetExportFileName\(\s*gallerySiteName,/,
    'downloads from another site must carry that site name, not the open design name');
  assert.match(glossy, /saveSheet\(\{ \.\.\.item, siteId: state\.siteId/,
    'rendered sheets must remain attached to the open design, never the browsed gallery site');
  assert.doesNotMatch(glossy, /saveSheet\(\{ \.\.\.item, siteId: gallerySiteId/,
    'browsing another site must not retarget a paid render');
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
  assert.match(phoneCss, /\.workspace \{[\s\S]*?position: absolute;[\s\S]*?height: 100%;[\s\S]*?overflow-y: auto;/,
    'the phone column must own a bounded scrollport because the global page body cannot scroll');
  assert.doesNotMatch(phoneCss, /\.workspace \{[\s\S]*?overflow: visible;/,
    'visible overflow puts the map and export actions below the locked page viewport');
});

test('map-toolbar chrome only shows controls that explain or change the preview', () => {
  const toolbarStart = glossy.indexOf('<div className={styles.stageToolbar}>');
  const toolbarEnd = glossy.indexOf('</div>', toolbarStart);
  assert.ok(toolbarStart > 0 && toolbarEnd > toolbarStart, 'preview toolbar boundaries moved');
  const toolbar = glossy.slice(toolbarStart, toolbarEnd);
  assert.match(toolbar, /designGlossyPreviewScope/);
  assert.doesNotMatch(toolbar, /stageChip|SeasonalSun|<Wind|<Sun/,
    'static weather pills look like site analysis controls but carry no site data or action');
});

test('a long settings rail cannot stretch the sheet preview into a black screen', () => {
  const stageStart = css.indexOf('.mapStage {');
  const stageEnd = css.indexOf('\n}', stageStart);
  assert.ok(stageStart >= 0 && stageEnd > stageStart, 'map stage rule moved');
  assert.match(css.slice(stageStart, stageEnd), /align-self:\s*start;/,
    'the centre stage must size to its sheet instead of stretching to the taller settings rail');

  const frameStart = css.indexOf('.resultImageFrame {');
  const frameEnd = css.indexOf('\n}', frameStart);
  assert.ok(frameStart >= 0 && frameEnd > frameStart, 'result image frame rule moved');
  assert.match(css.slice(frameStart, frameEnd), /background:\s*#fbf6ec;/i,
    'any contain-fit remainder should read as sheet paper, never a black panel');
});

test('the centre sheet opens full screen and has three simple ways back', () => {
  const previewStart = glossy.indexOf('className={styles.stagePreviewButton}');
  assert.ok(previewStart > 0, 'the centre sheet should be an obvious full-screen trigger');
  assert.match(glossy.slice(previewStart, previewStart + 700), /onClick=\{\(\) => setGalleryZoomOpen\(true\)\}/);
  assert.match(glossy, /galleryZoomOpen && stageResultImage/,
    'both newly rendered and saved centre sheets should use the full-screen viewer');
  assert.match(glossy, /createPortal\(\([\s\S]*?document\.body\)/,
    'phone layouts must mount the viewer at the page root so a sheet container cannot clip it');
  assert.match(glossy, /aria-modal="true"/);
  assert.match(glossy, /if \(event\.key === 'Escape'\) setGalleryZoomOpen\(false\)/,
    'Escape should close the full-screen sheet');
  assert.match(glossy, /onClick=\{\(\) => setGalleryZoomOpen\(false\)\}[\s\S]*?designGlossyCloseFullScreen/,
    'the backdrop and visible close button should both leave full screen');
});

test('the full-screen sheet itself minimises, with a visible non-blocking cue', () => {
  const viewerStart = glossy.indexOf('{galleryZoomOpen && stageResultImage');
  const viewer = glossy.slice(viewerStart);
  assert.ok(viewerStart > 0, 'full-screen viewer boundaries moved');
  assert.match(viewer, /<img[\s\S]*?onClick=\{\(\) => setGalleryZoomOpen\(false\)\}[\s\S]*?cursor: 'zoom-out'/,
    'the map image must minimise the viewer instead of swallowing the backdrop click');
  assert.match(viewer, /designGlossyClickMapToMinimise/,
    'the full-screen viewer should explain the direct map action without blocking the image');
});

test('finish choices appear before advanced options and their longer explanation', () => {
  const actionsStart = glossy.indexOf('className={compact ? undefined : styles.actionsRail}');
  const savedRailStart = glossy.indexOf('<aside className={styles.savedRail}', actionsStart);
  assert.ok(actionsStart > 0 && savedRailStart > actionsStart, 'action rail boundaries moved');
  const actions = glossy.slice(actionsStart, savedRailStart);
  const finish = actions.indexOf("t('designGlossyFinishHeading')");
  const explanation = actions.indexOf("t('designGlossyHowFinishesWork')");
  const more = actions.indexOf("t('designGlossyMoreOptions')");

  assert.ok(finish >= 0 && explanation > finish && more >= 0,
    'finish controls and their collapsed explanation must remain in the primary action rail');
  assert.match(actions, /WorkflowHeading number=\{5\}[\s\S]*?enginePicker[\s\S]*?qualityPicker[\s\S]*?WorkflowHeading number=\{6\}[\s\S]*?designGlossyFinishHeading/,
    'engine and quality are step 5; the paid/free finish decision follows as step 6');
  assert.match(actions, /order: 1,[\s\S]*?WorkflowHeading number=\{6\}[\s\S]*?order: 2,[\s\S]*?designGlossyHowFinishesWork/,
    'the numbered finish choice and its disclosure must lead the action rail');
  assert.match(actions, /order: 3,[\s\S]*?designGlossyMoreOptions/,
    'advanced controls must visually follow the primary finish controls');
  assert.doesNotMatch(actions.slice(0, finish), /designGlossyFinishHelp/,
    'the long finish explanation must stay collapsed until after the finish choice');
});
