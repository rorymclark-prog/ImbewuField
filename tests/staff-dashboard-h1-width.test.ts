import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// code-13/code-14: AppHeader's title is a small <span>, not a heading, and several of the
// staff dashboards had no visible <h1> of their own and no max-width at all on desktop (cards
// running edge to edge at 1280px). This guards the fix on the pages this track owns.

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

test('/ngo and /funder each have a real, properly-sized h1 on their default (cohort) tab', () => {
  for (const [file, label] of [
    ['app/ngo/page.tsx', 'Organisation dashboard'],
    ['app/funder/page.tsx', 'Funder dashboard'],
  ] as const) {
    const src = read(file);
    assert.match(src, /<h1 className="t-h1 font-display[^"]*"/, `${file} is missing a real t-h1 heading`);
    assert.match(src, new RegExp(label), `${file} lost its "${label}" heading text`);
  }
});

test('/mentor and /surveys use the shared responsive .t-h1 class (24/26/30px), not a fixed phone size', () => {
  for (const file of ['app/mentor/page.tsx', 'app/surveys/page.tsx'] as const) {
    const src = read(file);
    assert.match(src, /<h1 className="t-h1 font-display"/, `${file}'s h1 no longer uses the shared t-h1 class`);
  }
});

test('/mentor and /surveys cap their main content at a real desktop width instead of running edge to edge', () => {
  for (const file of ['app/mentor/page.tsx', 'app/surveys/page.tsx'] as const) {
    const src = read(file);
    assert.match(src, /import workspace from '@\/components\/layout\/Workspace\.module\.css'/, `${file} no longer imports the shared Workspace module`);
    assert.match(src, /\$\{workspace\.workspace\}/, `${file}'s <main> lost the workspace.workspace max-width class`);
  }
});
