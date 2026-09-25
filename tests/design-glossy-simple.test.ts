import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// swarm/w4-glossy-simple: Design Studio step 09 "Glossy" (Preview & Export) in Simple. Source-text
// guard style, same as tests/design-simple-mode.test.ts: DesignGlossy is not a pure function of
// exported data, so this reads the real shipped file and asserts the wiring a farmer would hit.

const GLOSSY = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');

test('DesignGlossy computes simple from useAppLevel(), called unconditionally', () => {
  assert.match(GLOSSY, /from '@\/lib\/app-level'/, 'DesignGlossy must import useAppLevel');
  assert.match(
    GLOSSY,
    /const \{ t \} = useLanguage\(\);\n\s*const simple = useAppLevel\(\) === 'simple';/,
    'useAppLevel must be called unconditionally at the top of the component, before any other hook',
  );
});

test('Simple hides the header context strip and the saved-maps icon button, keeps Export & Share', () => {
  assert.match(
    GLOSSY,
    /\{!simple && \(\s*\n\s*<div className=\{styles\.contextStrip\}/,
    'the context strip must not render in Simple',
  );
  assert.match(
    GLOSSY,
    /\{!simple && \(\s*\n\s*<button\s*\n\s*type="button"\s*\n\s*className=\{styles\.iconButton\}/,
    'the header saved-maps icon button must not render in Simple',
  );
  assert.match(
    GLOSSY,
    /<Upload size=\{16\} \/> \{t\('designGlossyExportShare'\)\}/,
    'the header Export & Share button must still exist for every mode',
  );
});

test('Simple hides Underlay, the Quality chooser and Plant labels', () => {
  assert.match(
    GLOSSY,
    /\{!simple && \(\s*\n\s*<>\s*\n\s*<WorkflowHeading number=\{2\} title="Underlay" \/>/,
    'the Underlay heading + pills must not render in Simple',
  );
  assert.match(GLOSSY, /Quality\s*\n\s*<\/span>/, 'the Quality chooser label must still exist for All tools');
  assert.match(
    GLOSSY,
    /\{sheetHasPlantCodes && !simple && \(\s*\n\s*<>\s*\n\s*<WorkflowHeading number=\{3\} title="Plant labels" \/>/,
    'the Plant labels heading + pills must not render in Simple',
  );
});

test('Simple hides the style-pack picker and "More style packs"', () => {
  assert.match(
    GLOSSY,
    /\{aiLayerMode && !simple && \(\s*\n\s*<>\s*\n\s*<WorkflowHeading number=\{4\} title=\{t\('designGlossyStyle'\)\} \/>/,
    'the Style heading + style cards must not render in Simple',
  );
  assert.match(GLOSSY, /\{t\('designGlossyMoreStyles'\)\}/, '"More style packs" must still exist for All tools');
});

test('Simple hides the paid AI finish buttons, the AI engine/quality controls and "More options"', () => {
  assert.match(
    GLOSSY,
    /\{!simple && \(\s*\n\s*<>\s*\n\s*\{aiRenderOn && selectedSheet && <WorkflowHeading number=\{5\}/,
    'the Engine & Quality heading must require !simple',
  );
  assert.match(
    GLOSSY,
    /\{aiRenderOn && selectedSheet && enginePicker\}\s*\n\s*\{aiRenderOn && selectedSheet && qualityPicker\}/,
    'the engine and quality pickers must both live inside the !simple wrapper',
  );
  assert.match(
    GLOSSY,
    /\{!simple && \(\s*\n\s*<>\s*\n\s*\{aiRenderOn && \(<button\s*\n\s*type="button"\s*\n\s*onClick=\{\(\) => runLockedPolishFlow\('hybrid'\)\}/,
    'the AI Polished button must not render in Simple',
  );
  assert.match(
    GLOSSY,
    /\{aiRenderOn && fullTreatmentVisible && \(\s*\n\s*<button\s*\n\s*type="button"\s*\n\s*onClick=\{\(\) => runLockedPolishFlow\('full'\)\}/,
    'the Full Treatment button must live inside the same !simple wrapper as AI Polished',
  );
  assert.match(
    GLOSSY,
    /\{!compact && !simple && \(\s*\n\s*<div style=\{\{ order: 3,/,
    '"More options" (Style all sheets / generate-all) must not render in Simple',
  );
});

test('Simple hides the "About your map" disclosure and the engine/analysis footnotes', () => {
  assert.match(
    GLOSSY,
    /\{selectedSheet && !simple && \(\s*\n\s*<details[\s\S]{0,350}designGlossyHowFinishesWork/,
    'the "About your map" (How finishes work) disclosure must not render in Simple',
  );
  assert.match(
    GLOSSY,
    /\{!simple && \(\s*\n\s*<div style=\{\{ order: 4, fontSize: 11, opacity: 0\.6 \}\}>/,
    'the engine/analysis footnote must not render in Simple',
  );
});

test('Simple always shows this sheet — the "This sheet / All sheets" tabs do not render', () => {
  assert.match(
    GLOSSY,
    /\{!compact && !simple && \(\s*\n\s*<div className=\{styles\.stageToolbar\}>/,
    'the stage tabs toolbar must require !simple',
  );
  assert.match(
    GLOSSY,
    /\{stageScope === 'saved' && !compact && !simple \? \(/,
    'the saved-gallery stage must not show in Simple even if stageScope was left on \'saved\'',
  );
});

test('Simple hides the right rail\'s site picker and the whole Export summary, keeps the saved-maps list', () => {
  assert.match(
    GLOSSY,
    /\{!simple && \(\s*\n\s*<label className=\{styles\.sitePicker\}>/,
    'the saved-maps rail site picker must not render in Simple',
  );
  assert.match(
    GLOSSY,
    /\{!simple && \(\s*\n\s*<section className=\{styles\.railSection\}>\s*\n\s*<div className=\{styles\.railHeader\}>\s*\n\s*<h2>\{t\('designGlossyExportSummary'\)\}<\/h2>/,
    'the Export summary rail section must not render in Simple',
  );
  assert.doesNotMatch(
    GLOSSY,
    /\{!simple && \([^)]*savedRailItems\.map/,
    'the Saved maps list itself must stay visible in Simple, only its site picker and the Export summary hide',
  );
});

test('the Design Map action, sheet picker, Download and Export & Share are not gated on simple', () => {
  assert.match(GLOSSY, /onClick=\{runExactStep\}/, 'the free Design Map action (runExactStep) must exist for every mode');
  assert.match(
    GLOSSY,
    /<WorkflowHeading number=\{1\} title=\{t\('designGlossyPlanSet'\)\} \/>\s*\n\s*\{!compact \? \(\s*\n\s*<select/,
    'the sheet picker must render right after the plan-set heading in both compact and desktop, in every mode',
  );
  assert.match(GLOSSY, /onClick=\{handleStageDownload\}/, 'the Download action must exist for every mode');
});

test('the Finish heading renumbers to 2 in Simple, with no gap', () => {
  assert.match(
    GLOSSY,
    /\{selectedSheet && !simple && <WorkflowHeading number=\{aiRenderOn \? 6 : 4\} title=\{t\('designGlossyFinishHeading'\)\} \/>\}/,
    'the All-tools Finish heading numbering (5/6 or 4) must be unchanged',
  );
  assert.match(
    GLOSSY,
    /\{selectedSheet && simple && <WorkflowHeading number=\{2\} title=\{t\('designGlossyFinishHeading'\)\} \/>\}/,
    'Simple must show its own Finish heading numbered 2 (1 = sheet picker, 2 = finish), with no gap',
  );
});
