import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('w23-03: report figures use the display face and never break mid-number', () => {
  const css = read('components/ProgrammeReport.module.css');
  assert.match(css, /\.metric strong\{[^}]*font-family:var\(--font-display\)[^}]*white-space:nowrap\}/);
  assert.match(css, /\.metric strong\{font-size:clamp\(19px,5\.6vw,25px\)\}/);
});

test('w23-04: the isiZulu draft note in both report layouts is styled, not a bare line', () => {
  const composer = read('components/ReportComposer.tsx');
  assert.doesNotMatch(composer, /<p role="note">Lezi izihloko/);
  assert.match(composer, /<p role="note" className=\{visualStyles\.draftNote\}>Lezi izihloko/);
  assert.match(composer, /<p role="note" className=\{reportStyles\.draftNote\}>Lezi izihloko/);
  assert.match(read('components/ProgrammeReport.module.css'), /\.draftNote\{margin:0;padding:10px 20px/);
  assert.match(read('components/report/VisualReport.module.css'), /\.draftNote \{ margin: 0 0 16px;/);
});

test('w23-05: report partners take their own line on a phone', () => {
  assert.match(read('components/ProgrammeReport.module.css'), /\.partner\{min-width:200px\}/);
});
