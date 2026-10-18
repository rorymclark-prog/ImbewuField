import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

// a11y-08 (rest): the report toolbar, saved-report rows, section pickers and the map's
// draw/edit bar were 24-30px tall. Each one now carries the 44px floor.
test('report and map action buttons keep a 44px minimum height', () => {
  const report = source('components/ReportView.tsx');
  const small = report.split('\n').filter(l => /className="[^"]*\bpy-(?:0\.5|1|1\.5)\b/.test(l) && !/min-h-11/.test(l));
  // The only remaining small-padding line is the ochre notice <div>, which is not a control.
  assert.deepEqual(small.map(l => l.trim().slice(0, 40)), ['<div className="text-xs font-sans px-2 p']);
  const map = source('components/Map.tsx');
  for (const handler of ['onClick={cancelDraw}', 'onClick={() => requestDelete(editingFeatureId)}', 'onClick={finishEditing}']) {
    const at = map.indexOf(handler);
    assert.ok(at > 0, handler);
    assert.match(map.slice(at, at + 200), /className="min-h-11 /, `${handler} lost its 44px floor`);
  }
});

test('settings switches and the profile close button grow their hit area, not their paint', () => {
  const theme = source('components/ThemePanel.tsx');
  assert.match(theme, /role="switch"[\s\S]{0,300}className="u-tap-target"[\s\S]{0,80}'--tap-inset' as string\]: '-8px 0'/);
  assert.match(theme, /width: 46, height: 28/);
  const profile = source('components/ProfileSheet.tsx');
  assert.match(profile, /aria-label=\{t\('profileClose'\)\}[\s\S]{0,120}className="u-tap-target"[\s\S]{0,80}'--tap-inset' as string\]: '-3px'/);
});

// a11y-13: one app-wide reduced-motion floor, not a list of class names.
test('reduced motion stills every animation and transition app-wide', () => {
  const css = source('app/globals.css');
  const block = css.match(/@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{([^}]*)\}/);
  assert.ok(block, 'the universal reduced-motion rule is gone');
  for (const decl of ['animation-duration: 0.01ms !important', 'animation-iteration-count: 1 !important', 'transition-duration: 0.01ms !important', 'scroll-behavior: auto !important']) {
    assert.ok(block[1].includes(decl), decl);
  }
});

// lang-12: "supervisor" / "facilitator" were retired for "mentor" (CLAUDE.md roles). Copy only —
// the Firestore field garden.facilitator keeps its name.
test('NGO dashboard and partners page say mentor, not supervisor or facilitator', () => {
  const ngo = source('components/NgoDashboard.tsx');
  assert.doesNotMatch(ngo, /logged by supervisors|· supervisor /);
  assert.match(ngo, /ui\('logged by mentors','oqoshwe abeluleki'\)/);
  assert.match(ngo, /\$\{ui\('mentor','umeluleki'\)\} \$\{garden\.facilitator\}/);
  const partners = source('app/partners/page.tsx');
  assert.doesNotMatch(partners, /Mentors and facilitators/);
});
