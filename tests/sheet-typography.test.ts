import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Rory kept saying the typography looked wrong and could not say why. The answer was that a single
// sheet was set in several families at once — the title in Georgia, the legend in a condensed
// stack, and everything else in bare `system-ui` or `sans-serif`. Two of those had been lifted into
// constants and thirty-odd sites stayed hardcoded, so the sheet was typographically inconsistent
// with itself and no one edit could fix it.
//
// That is this codebase's recurring defect: several places independently answering one question and
// drifting apart. Centralising is only half a fix — without a guard the next hurried `ctx.font =
// '14px sans-serif'` re-opens it, invisibly, because a stray family looks completely ordinary in a
// diff and renders fine on the machine of whoever wrote it.
//
// So this reads the source. It is not a unit test of behaviour — DesignGlossy is a 10k-line canvas
// component that cannot be meaningfully imported here — it is a structural assertion that the
// typeface system has exactly one home.

const SOURCE = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');

/** Every `ctx.font = …` assignment, with its line number for a useful failure message. */
function fontAssignments(): { line: number; text: string }[] {
  return SOURCE.split('\n')
    .map((text, i) => ({ line: i + 1, text }))
    .filter((l) => /ctx\.font\s*=/.test(l.text));
}

test('every font on a sheet names a declared constant, never a literal family', () => {
  // A literal family is any of these words appearing in the assignment itself. Inside the four
  // constants they are expected; anywhere else they are a new hardcoded site.
  const LITERAL_FAMILY = /(sans-serif|serif|monospace|Georgia|Arial|Helvetica|system-ui)/;
  const DECLARED = /(SHEET_TITLE_FONT|SHEET_BODY_FONT|SHEET_GLYPH_FONT|REFERENCE_LABEL_FONT)/;

  const offenders = fontAssignments().filter((l) => LITERAL_FAMILY.test(l.text) && !DECLARED.test(l.text));

  assert.deepEqual(
    offenders.map((o) => `${o.line}: ${o.text.trim()}`),
    [],
    'hardcoded font family — use SHEET_TITLE_FONT / SHEET_BODY_FONT / SHEET_GLYPH_FONT / REFERENCE_LABEL_FONT',
  );
});

test('the sheet is set in two faces, and the glyph entry is deliberately a third', () => {
  const decl = (name: string) => SOURCE.match(new RegExp(`^const ${name} = (.+);$`, 'm'))?.[1];

  assert.equal(decl('SHEET_TITLE_FONT'), "'Georgia, serif'");
  assert.equal(decl('SHEET_BODY_FONT'), decl('REFERENCE_LABEL_FONT'), 'body and map labels are one face');
  assert.ok(decl('SHEET_BODY_FONT')?.includes('Condensed'), 'sheet lettering is condensed — it competes with the drawing');

  // Icon and emoji glyphs must NOT move to a condensed text face: it is not guaranteed to contain
  // those codepoints, and canvas falls back silently at a different metric, so a symbol that looked
  // centred jumps. Kept generic on purpose — this asserts the intent so nobody "tidies" it.
  assert.equal(decl('SHEET_GLYPH_FONT'), "'sans-serif'");
});

test('title fonts keep the shorthand shape the scrim measures them by', () => {
  // drawTitleBlockScrim sizes the backing panel by regex-extracting the number before "px" —
  // NOT parseInt, which would read the WEIGHT (800) and inflate the scrim ~23x. That regex only
  // works while the strings stay "<weight> <size>px <family>". Swapping the family is safe; losing
  // the shape is not, and the failure would be a giant dark panel over a farmer's plan.
  const SIZE_BEFORE_PX = /(\d+(?:\.\d+)?)px/;

  const titleUses = SOURCE.split('\n').filter((l) => /SHEET_TITLE_FONT/.test(l) && /px/.test(l));
  // This was `>= 4` — a usage COUNT, not a rule, and it failed the moment sheet 08's cream-panel
  // header moved off Georgia to match 01-07. That was the right fix: line 7490 and line 6881 draw
  // the same thing (the sheet title in the cream legend panel) in two different faces, so one sheet
  // of a printed set arrived in another typeface, with Georgia's oldstyle figures rendering the
  // number as "o8". The on-map title blocks keep the serif deliberately.
  //
  // What this test protects is the SHAPE of the shorthand, so drawTitleBlockScrim's regex keeps
  // finding the size. That holds however many places use the face — so assert it is still live
  // rather than pinning how many uses there are.
  assert.ok(titleUses.length > 0, 'the title face is orphaned — either use it or delete it');

  for (const line of titleUses) {
    assert.match(line, /\$\{[^}]*\}px \$\{SHEET_TITLE_FONT\}|\d+px \$\{SHEET_TITLE_FONT\}/);
  }

  // And the measuring regex itself still finds a size in a rendered example.
  assert.equal('800 34px Georgia, serif'.match(SIZE_BEFORE_PX)?.[1], '34');
});

test('the phasing schedule sizes its type from its own column, not the changing map or sheet width', () => {
  const start = SOURCE.indexOf('const fsHeader =');
  const end = SOURCE.indexOf('// Word-wrap to a pixel width', start);
  assert.ok(start >= 0 && end > start, 'phasing type-size block exists');
  const block = SOURCE.slice(start, end);

  assert.match(block, /fsHeader = Math\.round\(lgW \*/);
  assert.match(block, /fsSection = Math\.round\(lgW \*/);
  assert.match(block, /fsBody = Math\.round\(lgW \*/);
  assert.match(block, /titleFont = .*Math\.round\(lgW \*/);
  assert.doesNotMatch(block, /Math\.round\((?:W|mapW) \*/);
});

test('a phasing week baseline clears the chip by the week font ascent', () => {
  const start = SOURCE.indexOf('// Advance below BOTH the chip');
  const end = SOURCE.indexOf('// Week range.', start);
  assert.ok(start >= 0 && end > start, 'phasing chip-clearance block exists');
  const block = SOURCE.slice(start, end);

  // The rule is about glyph geometry, not today's font size: the baseline must include the actual
  // ascent of the font that will be painted. A line-height fraction can pass while caps overlap.
  assert.match(block, /ctx\.measureText\(phase\.weekRange\)\.actualBoundingBoxAscent/);
  assert.match(block, /chipTop \+ chipS \+ weekAscent \+ weekTopGap/);
  assert.doesNotMatch(block, /lineH \* 0\.35/);
});
