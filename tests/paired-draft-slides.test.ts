import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { englishSlideRecords, validatePairedDraft } from '../scripts/paired-draft-slides.mjs';

const source = englishSlideRecords(readFileSync('docs/narration/intro-permaculture.en.md', 'utf8'));
const completeHold = () => ({
  language: 'st', sourceLanguage: 'en', reviewStatus: 'unreviewed',
  slides: source.map((english) => ({
    n: english.n, english: structuredClone(english),
    target: { heading: { status: 'english-hold' }, body: english.body.map(() => ({ status: 'english-hold' })) },
  })),
});

test('the Sesotho pilot pairs all 22 actual English introduction slides in authored order', () => {
  assert.equal(source.length, 22);
  assert.equal(source[0].heading, 'Introduction to Permaculture');
  assert.equal(source[0].body[0], 'Before you dig anything, it helps to know how the decisions get made.');
  assert.equal(source[0].body.length, 4);
  assert.ok(source.every((slide) => slide.body.every((paragraph: string) => paragraph !== '---' && !paragraph.includes('[pause]'))));
  assert.equal(validatePairedDraft(completeHold(), source).length, 22);
});

test('a changed source sentence or heading blocks the entire paired draft', () => {
  const changed = completeHold();
  changed.slides[3].english.body[1] += ' Water every day.';
  assert.throws(() => validatePairedDraft(changed, source), /slide 4: English body differs/);
  changed.slides[3].english.body = [...source[3].body];
  changed.slides[3].english.heading = 'Different heading';
  assert.throws(() => validatePairedDraft(changed, source), /slide 4: English heading differs/);
});

test('missing, duplicate, and reordered slide records cannot be rendered', () => {
  const missing = completeHold();
  missing.slides.pop();
  assert.throws(() => validatePairedDraft(missing, source), /slide count differs/);
  const duplicated = completeHold();
  duplicated.slides[1].n = 1;
  assert.throws(() => validatePairedDraft(duplicated, source), /slide 2: missing, duplicate, or out of order/);
  assert.throws(() => englishSlideRecords('**Slide 1 — One**\nA.\n**Slide 3 — Three**\nB.'), /slide 2: found number 3/);
  assert.throws(() => englishSlideRecords('**Slide 1 — One**\nA.\n**Slide 2: Bad**\nB.'), /malformed slide heading/);
});

test('a target needs a declared unreviewed status and full draft copy or an explicit English hold', () => {
  const draft: any = completeHold();
  draft.slides[0].target.heading = { status: 'draft', text: 'Selelekela' };
  draft.slides[0].target.body[0] = { status: 'draft', text: 'Draft paragraph' };
  assert.equal(validatePairedDraft(draft, source)[0].target.body[0].status, 'draft');
  draft.slides[0].target.body[1] = {};
  assert.throws(() => validatePairedDraft(draft, source), /paragraph 2: review status is missing/);
  draft.slides[0].target.body[1] = { status: 'draft' };
  assert.throws(() => validatePairedDraft(draft, source), /paragraph 2: Sesotho draft text is missing/);
  draft.slides[0].target.body[1] = { status: 'english-hold', text: 'Hidden translation' };
  assert.throws(() => validatePairedDraft(draft, source), /must not masquerade/);
  draft.slides[0].target.body[1] = { status: 'english-hold' };
  draft.slides[0].target.body[1] = { status: 'draft', text: source[0].body[1] };
  assert.throws(() => validatePairedDraft(draft, source), /unchanged English needs an explicit hold/);
  draft.slides[0].target.body[1] = { status: 'english-hold' };
  draft.slides[0].target.body.pop();
  assert.throws(() => validatePairedDraft(draft, source), /target paragraph count differs/);
  draft.slides[0].target.body.push({ status: 'english-hold' });
  draft.reviewStatus = 'reviewed';
  assert.throws(() => validatePairedDraft(draft, source), /reviewStatus must be unreviewed/);
});

test('the opt-in command rejects stale English before creating a slide directory', () => {
  const temp = mkdtempSync(join(tmpdir(), 'imbewu-paired-check-'));
  try {
    const draft = completeHold();
    draft.slides[5].english.body[0] = 'Changed farming instruction.';
    const json = join(temp, 'draft.json');
    const output = join(temp, 'slides');
    writeFileSync(json, JSON.stringify(draft));
    const result = spawnSync(process.execPath,
      ['scripts/make-lesson-slides.mjs', 'intro-permaculture', 'st', output, '--paired-draft', json],
      { cwd: process.cwd(), encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /slide 6: English body differs/);
    assert.equal(existsSync(output), false);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('the paired layout preflights all 22 full source records without writing media', () => {
  const temp = mkdtempSync(join(tmpdir(), 'imbewu-paired-layout-'));
  try {
    const json = join(temp, 'draft.json');
    const output = join(temp, 'slides');
    writeFileSync(json, JSON.stringify(completeHold()));
    const result = spawnSync(process.execPath,
      ['scripts/make-lesson-slides.mjs', 'intro-permaculture', 'st', output,
        '--paired-draft', json, '--validate-only'],
      { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /validated 22 source-paired slides; no images written/);
    assert.equal(existsSync(output), false);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('a paired illustration override must name an existing repository image before rendering', () => {
  const temp = mkdtempSync(join(tmpdir(), 'imbewu-paired-art-'));
  try {
    const json = join(temp, 'draft.json');
    const art = join(temp, 'art.json');
    const output = join(temp, 'slides');
    writeFileSync(json, JSON.stringify(completeHold()));
    writeFileSync(art, JSON.stringify({ 10: 'docs/media/no-such-site-image.jpg' }));
    const args = ['scripts/make-lesson-slides.mjs', 'intro-permaculture', 'st', output,
      '--paired-draft', json, '--paired-art', art, '--validate-only'];
    const missing = spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8' });
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /image is missing or outside this repository/);
    assert.equal(existsSync(output), false);
    writeFileSync(art, JSON.stringify({ 10: 'docs/media/studies-illustrated-release/art/reading-landscape/landscape-walk.jpg' }));
    const present = spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(present.status, 0, present.stderr);
    assert.match(present.stdout, /validated 22 source-paired slides/);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('a long draft fails layout instead of shrinking or dropping a farming paragraph', () => {
  const temp = mkdtempSync(join(tmpdir(), 'imbewu-paired-overflow-'));
  try {
    const draft: any = completeHold();
    draft.slides[0].target.body[0] = { status: 'draft', text: 'A long draft sentence. '.repeat(120) };
    const json = join(temp, 'draft.json');
    const output = join(temp, 'slides');
    writeFileSync(json, JSON.stringify(draft));
    const result = spawnSync(process.execPath,
      ['scripts/make-lesson-slides.mjs', 'intro-permaculture', 'st', output,
        '--paired-draft', json, '--validate-only'],
      { cwd: process.cwd(), encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /slide 1 paired text needs .*phone-readable type size/);
    assert.equal(existsSync(output), false);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
