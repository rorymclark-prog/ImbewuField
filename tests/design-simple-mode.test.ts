import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// swarm/design-simple: /design's Simple / All tools wiring, plus the fixes bundled into the same
// track (Print/Export collapse, the DesignPrint live-preview error, i18n gaps, ochre-as-text and
// non-Lucide glyphs). Source-text guard style, same as tests/home-next-step-links.test.ts and
// tests/locked-polish-flow.test.ts: these components are not pure functions of exported data, so
// the guard reads the real shipped file and asserts the wiring a farmer would actually hit.

const PAGE = readFileSync(new URL('../app/design/page.tsx', import.meta.url), 'utf8');
const PALETTE = readFileSync(new URL('../components/design/DesignPalette.tsx', import.meta.url), 'utf8');
const ADVISOR = readFileSync(new URL('../components/design/DesignAdvisor.tsx', import.meta.url), 'utf8');
const PHOTO_IMPORT = readFileSync(new URL('../components/design/BasePhotoImport.tsx', import.meta.url), 'utf8');
const PRINT = readFileSync(new URL('../components/design/DesignPrint.tsx', import.meta.url), 'utf8');
const STEP_GUIDE = readFileSync(new URL('../components/design/StepGuide.tsx', import.meta.url), 'utf8');
const TANK_CALC = readFileSync(new URL('../components/design/TankCalculator.tsx', import.meta.url), 'utf8');
const SECTOR_SUMMARY = readFileSync(new URL('../components/design/SectorSummary.tsx', import.meta.url), 'utf8');
const SPECIES_PICKER = readFileSync(new URL('../components/design/SpeciesPicker.tsx', import.meta.url), 'utf8');
const I18N_PENDING = readFileSync(new URL('../lib/i18n-pending.ts', import.meta.url), 'utf8');
const ZU = readFileSync(new URL('../lib/locales/zu.ts', import.meta.url), 'utf8');

test('the Design Studio page reads Simple / All tools from lib/app-level.ts', () => {
  assert.match(PAGE, /from '@\/lib\/app-level'/, 'page.tsx must import useAppLevel');
  assert.match(PAGE, /const simple = useAppLevel\(\) === 'simple'/, 'page.tsx must compute a `simple` flag from useAppLevel()');
});

test('Simple hides the workspace-layout picker and the desktop panel-width resize handles', () => {
  assert.match(
    PAGE,
    /!isPhone && !simple && canvasState\?\.step !== 'glossy' && \(\s*<div\s*\n\s*role="group"\s*\n\s*aria-label=\{tr\('Workspace layout'/,
    'the Dock/Float/Tray workspace-layout picker must not render in Simple',
  );
  assert.match(
    PAGE,
    /onDesktopPanelWidthChange=\{simple \? undefined : setDesktopPanelWidth\}/,
    'Simple must not hand DesignPalette a panel-width setter (that is what disables the resize handles)',
  );
  // DesignPalette must actually honour the missing setter by not rendering a drag handle at all —
  // a caller with no way to resize the panel must not still show a grip that does nothing.
  assert.match(
    PALETTE,
    /workspaceMode !== 'tray' && onDesktopPanelWidthChange && \(/,
    'the Layers-panel resize handle must require onDesktopPanelWidthChange, not just render disabled',
  );
});

test('Simple has no chrome collapse ladder and no per-section dismiss buttons', () => {
  assert.match(
    PAGE,
    /const effectiveTopStop: TopStop = simple \? 'full' : topStop/,
    'Simple must force the top chrome to its one fixed (full) stop',
  );
  assert.match(
    PAGE,
    /const effectiveBottomStop: BottomStop = simple \? 'full' : bottomStop/,
    'Simple must force the bottom chrome to its one fixed (full) stop',
  );
  assert.match(PAGE, /\{!simple && \(\s*<span style=\{\{ marginLeft: 'auto' \}\}>/, 'the top ChromeHandle ladder must not render in Simple');
  assert.match(PAGE, /\{!simple && <SectionClose onClick=\{\(\) => hideSection\('droneTools'\)\}/, 'the photo-controls per-section dismiss must not render in Simple');
  assert.match(PAGE, /\{!simple && <SectionClose onClick=\{\(\) => hideSection\('shortcuts'\)\}/, 'the skip-ahead per-section dismiss must not render in Simple');
  assert.match(PAGE, /onHide=\{simple \? undefined : \(\) => hideSection\('stepGuide'\)\}/, 'StepGuide must lose its dismiss × in Simple');
});

test('Simple has no layer-visibility matrix and no multi-select / Tidy / Snap / Clean up', () => {
  assert.match(PALETTE, /simple\?: boolean/, 'DesignPalette must accept a simple prop');
  assert.match(
    PALETTE,
    /\{!simple && \(\s*<div style=\{\{ position: 'relative', flexShrink: 0, display: desktopAside && !isPhone \? 'contents' : undefined \}\}>/,
    'the Layers button + its docked/floating panel must not render at all in Simple',
  );
  assert.match(
    PALETTE,
    /!simple && \(\(desktopAside && !isPhone\) \|\| \(layersOpen && layersAnchor\)\)/,
    'the Layers panel open-condition must also require !simple',
  );
  assert.match(PALETTE, /\{!simple && \(\s*<button\s*\n\s*type="button"\s*\n\s*aria-label=\{toolGlyph\(t\('designPaletteTidy'\)\)/, 'the Tidy button must not render in Simple');
  assert.match(PALETTE, /\{!simple && \(\s*<button\s*\n\s*type="button"\s*\n\s*aria-label=\{toolGlyph\(t\('designPaletteSnap'\)\)/, 'the Snap button must not render in Simple');
  assert.match(PALETTE, /\{!simple && \(\s*<button\s*\n\s*type="button"\s*\n\s*aria-label=\{toolGlyph\(t\('designPaletteCleanup'\)\)/, 'the Clean up (align & distribute) button must not render in Simple');
  assert.match(PAGE, /onToggleAdditive=\{simple \? undefined : \(\) => setMultiSelectMode/, 'the multi-select toggle must not be offered to DesignCanvas in Simple');
});

test('Simple shows a curated element-palette starter set with a Show all escape hatch', () => {
  assert.match(
    PALETTE,
    /const SIMPLE_STARTER_ELEMENT_IDS = new Set\(\['jojo_1000', 'tap_point', 'raised_bed', 'veg_bed', 'tree_other', 'chicken_coop'\]\)/,
    'the curated starter set must exist and cover a tank, tap, bed, tree and chicken coop',
  );
  assert.match(
    PALETTE,
    /const displayedCatalog = simple && !showAllElementsEffective \? simpleStarterCatalog : orderedCatalog/,
    'Simple must render the curated subset, not the full catalogue, until Show all is tapped',
  );
  assert.match(PALETTE, /\{displayedCatalog\.map\(\(def\) => \{/, 'the chip strip must actually render the curated/all switch, not the raw catalogue');
  assert.match(PALETTE, /onClick=\{\(\) => setShowAllElements\(true\)\}/, 'a Show all control must exist to reach the full catalogue');
  assert.match(PALETTE, /useEffect\(\(\) => \{ setShowAllElements\(false\); \}, \[step\]\)/, 'Show all must reset on the next step, not persist as a hidden preference');
});

test('Simple\'s DesignAdvisor shows only the single top tip, no "more" expansion or AI feed', () => {
  assert.match(ADVISOR, /simple\?: boolean/, 'DesignAdvisor must accept a simple prop');
  assert.match(ADVISOR, /if \(simple\) return null;/, 'with no local advice, Simple must not offer the raw Ask Lima AI pill');
  assert.match(ADVISOR, /\{!simple && <AskAiButton/, 'the Ask Lima AI button must not render in Simple');
  assert.match(ADVISOR, /\{!simple && \(\s*<div style=\{\{ display: 'flex', gap: 6, flexWrap: 'wrap' \}\}>/, 'the "N more" expansion row must not render in Simple');
  assert.match(ADVISOR, /\{!simple && expanded && \(rest\.length > 0 \|\| aiSuggestions\.length > 0\) && \(/, 'the expanded extra-tips panel must not render in Simple');
  assert.match(PAGE, /<DesignAdvisorLazy[\s\S]{0,200}simple=\{simple\}/, 'page.tsx must thread simple into DesignAdvisor');
});

test('Simple\'s photo importer keeps one guided line-it-up flow and drops the fine sliders', () => {
  assert.match(PHOTO_IMPORT, /simple\?: boolean/, 'BasePhotoImport must accept a simple prop');
  // The label was English ("See through") when this was written; #572 moved it to the translated
  // designPhotoOpacityLabel key. Either spelling is the same slider.
  assert.match(PHOTO_IMPORT, /\{!simple && \(\n\s*<label[\s\S]{0,220}(See through<\/span>|designPhotoOpacityLabel)/, 'the opacity ("See through") slider must not render in Simple');
  assert.match(PHOTO_IMPORT, /\{!simple && \(\n\s*<label[\s\S]{0,220}designPhotoZoomSize/, 'the zoom/size slider must not render in Simple');
  assert.match(PHOTO_IMPORT, /\{!simple && \(\n\s*<input\n\s*type="range"\n\s*min=\{0\}\n\s*max=\{359\}/, 'the fine 1°-step rotation slider must not render in Simple');
  assert.match(PHOTO_IMPORT, /<RotateCcw size=\{16\} \/>/, 'the coarse ±90° rotate-left button must still exist in every mode');
  assert.match(PHOTO_IMPORT, /<RotateCw size=\{16\} \/>/, 'the coarse ±90° rotate-right button must still exist in every mode');
  assert.match(PAGE, /<BasePhotoImportLazy[\s\S]{0,2200}simple=\{simple\}/, 'page.tsx must thread simple into BasePhotoImport');
});

test('Print / Export collapses to Save my plan (+ Share) in Simple; the per-sheet controls stay in All tools', () => {
  assert.match(PRINT, /from '@\/lib\/app-level'/, 'DesignPrint must import useAppLevel');
  assert.match(PRINT, /const simple = useAppLevel\(\) === 'simple'/, 'DesignPrint must compute simple from useAppLevel()');
  assert.match(
    PRINT,
    /const chosen = simple\s*\n\s*\? PRINT_LAYERS\.filter\(\(l\) => available\.has\(l\.key\)\)\s*\n\s*: PRINT_LAYERS\.filter\(\(l\) => selected\.has\(l\.key\)\)/,
    'Simple must always export whatever sheets are currently available, not a stale checklist selection',
  );
  assert.match(PRINT, /\{!simple && \(\n\s*<div>\n\s*<div style=\{\{ fontSize: 11, fontWeight: 800,[\s\S]{0,120}designPrintSheets/, 'the per-sheet checklist must not render in Simple');
  assert.match(PRINT, /designPrintPaper/, 'the paper-size control must still exist for All tools');
  assert.match(PRINT, /\{!simple && \(\n\s*<div style=\{\{ display: 'flex', flexWrap: 'wrap', gap: 20 \}\}>/, 'the paper size / orientation row must not render in Simple');
  assert.match(PRINT, /\{!simple && \(\n\s*<div>\n\s*<div style=\{\{ fontSize: 11, fontWeight: 800,[\s\S]{0,120}designPrintInclude/, 'the legend/scale-bar/north-arrow include toggles must not render in Simple');
  assert.match(PRINT, /t\('designPrintSaveSimple'\)/, 'Simple needs a single "Save my plan" label');
  assert.match(PRINT, /\{simple \? \(\s*<>/, 'Simple must render its own action-button branch');
});

test('the DesignPrint live-preview effect surfaces a real error with retry, not a silent fallback', () => {
  assert.match(PRINT, /const \[previewErr, setPreviewErr\] = useState<string \| null>\(null\)/, 'a previewErr state must exist');
  assert.match(PRINT, /const \[previewAttempt, setPreviewAttempt\] = useState\(0\)/, 'a retry counter must exist to force the effect to re-run');
  assert.doesNotMatch(
    PRINT,
    /\.catch\(\(\) => \{ if \(!cancelled\) setBusy\(null\); \}\);/,
    'the live-preview catch must no longer swallow the failure silently',
  );
  assert.match(PRINT, /setPreviewErr\(formatDesignTranslation\(t\('designPrintPreviewError'\)/, 'a render failure must set a translated, real error message');
  assert.match(PRINT, /onClick=\{\(\) => setPreviewAttempt\(\(n\) => n \+ 1\)\}/, 'a retry control must re-trigger the preview effect');
  assert.match(PRINT, /previewErr \? \(/, 'the preview panel must branch to the error UI instead of falling through to "Select a sheet"');
});

test('the printed sheet keeps its fixed English title while the on-screen chip is translated', () => {
  assert.match(PRINT, /labelKey: 'designPrintSheetBase'/, 'each PRINT_LAYERS entry must carry a labelKey for the on-screen chip');
  assert.match(PRINT, /\{l\.no\} · \{t\(l\.labelKey\)\}/, 'the sheet-picker chip must read the translated labelKey, not the fixed label');
  assert.match(PRINT, /ctx\.fillText\(`\$\{layer\.no\} — \$\{layer\.label\}`/, 'the exported sheet\'s own title block must keep painting the fixed English label');
  for (const key of [
    'designPrintSheetBase', 'designPrintSheetSector', 'designPrintSheetZones', 'designPrintSheetWater',
    'designPrintSheetEarthworks', 'designPrintSheetPlanting', 'designPrintSheetStructures',
    'designPrintSheetAll', 'designPrintSheetImplementation',
  ]) {
    assert.match(I18N_PENDING, new RegExp(`^  ${key}: ['"]`, 'm'), `${key} has no pending English source text`);
  }
});

test('the Safe Mode crash-recovery banner, its button, and the storage-full follow-up route through tr(), with isiZulu', () => {
  assert.match(PAGE, /tr\('Light mode — your design is here, without the background photo\.', '[^']+'\)/, 'the Light-mode banner must route through tr() with an isiZulu draft');
  assert.match(PAGE, /tr\('The app kept closing on this design', '[^']+'\)/, 'the crash-recovery sentence must route through tr() with an isiZulu draft');
  assert.doesNotMatch(PAGE, />\s*Try the photo again\s*</, '"Try the photo again" must not be a bare English JSX text node');
  assert.match(PAGE, /tr\('Try the photo again', '[^']+'\)/, '"Try the photo again" must route through tr() with an isiZulu draft');
  assert.match(PAGE, /tr\(\s*'Your cached glossy renders are the usual culprit[^']*',\s*\n\s*'[^']+',/, 'the storage-full follow-up sentence must route through tr() with an isiZulu draft');
});

test('SpeciesPicker\'s heading, biome caption, and honesty/frost banner are translated', () => {
  assert.match(SPECIES_PICKER, /t\('speciesPickerTitle'\)/, 'the "Plant Catalog" heading must be translated');
  assert.match(SPECIES_PICKER, /formatDesignTranslation\(t\('speciesPickerFilteredFor'\), \{ biome: siteBiomeName \}\)/, 'the biome-filter caption must be translated');
  assert.match(SPECIES_PICKER, /t\('speciesPickerBroadReach'\)/, 'the broad-reach caption must be translated');
  assert.match(SPECIES_PICKER, /t\('speciesPickerNoteLabel'\)/, 'the honesty banner\'s "Note:" label must be translated');
  assert.match(SPECIES_PICKER, /t\('speciesPickerNoteBody'\)/, 'the honesty banner\'s body must be translated');
  assert.match(SPECIES_PICKER, /t\('speciesPickerFrostNote'\)/, 'the frost banner sentence must be translated');
  for (const key of ['speciesPickerTitle', 'speciesPickerFilteredFor', 'speciesPickerBroadReach', 'speciesPickerBroadReachSection', 'speciesPickerNoteLabel', 'speciesPickerNoteBody', 'speciesPickerFrostNote']) {
    assert.match(I18N_PENDING, new RegExp(`^  ${key}: ['"]`, 'm'), `${key} has no pending English source text`);
    assert.match(ZU, new RegExp(`^  ${key}: ['"]`, 'm'), `${key} has no isiZulu draft`);
  }
});

test('BasePhotoImport\'s four hardcoded instruction strings are translated', () => {
  assert.doesNotMatch(PHOTO_IMPORT, /⠿ drag to move/, 'the drag-handle caption must not be a bare English literal with an emoji glyph');
  assert.doesNotMatch(PHOTO_IMPORT, /'📍 Tapping…' : `📍 Add scale point/, 'the scale-point button text must not be bare English literals with emoji glyphs');
  assert.doesNotMatch(PHOTO_IMPORT, />\s*↩ Undo point\s*</, 'the Undo point button must not be a bare English literal with an emoji glyph');
  assert.doesNotMatch(PHOTO_IMPORT, /✓ Keeping your existing scale/, 'the kept-scale message must not be a bare English literal with an emoji glyph');
  assert.match(PHOTO_IMPORT, /t\('designPhotoDragToMove'\)/, 'the drag-handle caption must be translated');
  assert.match(PHOTO_IMPORT, /t\('designPhotoTapping'\)/, 'the "Tapping…" state must be translated');
  assert.match(PHOTO_IMPORT, /t\('designPhotoAddScalePoint'\)/, 'the "Add scale point" label must be translated');
  assert.match(PHOTO_IMPORT, /t\('designPhotoUndoPoint'\)/, 'the Undo point button must be translated');
  assert.match(PHOTO_IMPORT, /t\('designPhotoScaleKept'\)/, 'the kept-scale message must be translated');
  for (const key of ['designPhotoDragToMove', 'designPhotoTapping', 'designPhotoAddScalePoint', 'designPhotoUndoPoint', 'designPhotoScaleKept']) {
    assert.match(I18N_PENDING, new RegExp(`^  ${key}: ['"]`, 'm'), `${key} has no pending English source text`);
    assert.match(ZU, new RegExp(`^  ${key}: ['"]`, 'm'), `${key} has no isiZulu draft`);
  }
});

test('ochre as TEXT is the dim variant, never the raw fill colour', () => {
  // BasePhotoImport.tsx and StepGuide.tsx no longer keep a local GOLD_DIM = '#7A4408' constant —
  // the Design Studio dark-mode theme-token fix (tests/design-studio-theme-tokens.test.ts) routed
  // their text/icon uses straight through the theme-aware var(--gold-dim) instead, which is the
  // same dim variant this test protects, now adapting per theme rather than staying fixed.
  // SectorSummary.tsx and TankCalculator.tsx made the same move (see
  // tests/design-studio-ochre-text.test.ts): their GOLD_DIM constant now reads
  // GOLD_DIM = 'var(--gold-dim)' instead of the literal hex, so the same regex now matches a
  // `const` declaration rather than an inline `color:` style. Only app/design/page.tsx is
  // untouched and keeps the original literal-constant pattern.
  const THEMED_GOLD_DIM = new Set([
    'components/design/BasePhotoImport.tsx',
    'components/design/StepGuide.tsx',
    'components/design/TankCalculator.tsx',
    'components/design/SectorSummary.tsx',
  ]);
  for (const [name, source] of [
    ['app/design/page.tsx', PAGE],
    ['components/design/BasePhotoImport.tsx', PHOTO_IMPORT],
    ['components/design/TankCalculator.tsx', TANK_CALC],
    ['components/design/StepGuide.tsx', STEP_GUIDE],
    ['components/design/SectorSummary.tsx', SECTOR_SUMMARY],
  ] as const) {
    if (THEMED_GOLD_DIM.has(name)) {
      assert.match(source, /(?:color:\s*|GOLD_DIM = )['"]var\(--gold-dim\)['"]/, `${name} must route ochre-as-text through var(--gold-dim)`);
    } else {
      assert.match(source, /const GOLD_DIM = '#7A4408'/, `${name} must declare the GOLD_DIM text-colour constant`);
    }
    assert.doesNotMatch(source, /color:\s*OCHRE\b/, `${name} must not use the OCHRE fill constant as a text colour`);
    assert.doesNotMatch(source, /color=\{OCHRE\}/, `${name} must not use the OCHRE fill constant as an icon colour`);
  }
  // Fills and borders keep using OCHRE — this is not a rename, only text/icon colour moved.
  assert.match(PAGE, /border: `1px solid \$\{OCHRE\}`/, 'ochre must remain usable as a border/fill colour');
});

test('the standalone glyphs called out for replacement are gone, swapped for Lucide icons', () => {
  assert.doesNotMatch(PHOTO_IMPORT, /[⠿📍↩✓]/u, 'BasePhotoImport must have no leftover ⠿ 📍 ↩ ✓ glyphs');
  assert.doesNotMatch(SPECIES_PICKER, /✕/u, 'SpeciesPicker\'s close button must not be a bare ✕ glyph');
  assert.match(SPECIES_PICKER, /<X size=\{18\} \/>/, 'SpeciesPicker\'s close button must use the Lucide X icon');
  assert.doesNotMatch(PRINT, /[☑☐]/u, 'DesignPrint must have no leftover ☑ / ☐ checkbox glyphs');
  assert.match(PRINT, /SquareCheck|Square,/, 'DesignPrint\'s checkboxes must use Lucide Square/SquareCheck icons');
});
