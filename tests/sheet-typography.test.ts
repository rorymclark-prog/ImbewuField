import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { calculateSheetLegendPlacement, calculateStyleSheetSize, paperSheetCanvas } from '../lib/reference-presentation.ts';

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

  // THIS TEST USED TO ASSERT THE OPPOSITE, and the reversal is the point.
  //
  // It required a Georgia title over a CONDENSED body, on the reasoning that condensed lettering
  // competes less with the drawing. In the hand it did the opposite: a legend is read at arm's
  // length, on paper, by someone checking a count, and most machines lack Avenir Next Condensed so
  // the real fallback was Arial Narrow — the least legible face in the stack doing the most
  // important job on the sheet. Meanwhile the serif title over a narrow sans made the panel read
  // as two documents stacked. Rory said so on every sheet he looked at, finally: "big text, change
  // fonts, for the love of god, once and for all, across all sheets."
  //
  // So the rule now is ONE NORMAL-WIDTH FAMILY at several weights, which is how a drawing set is
  // actually set. Asserted as intent, not as a string, so the stack can be tuned without the test
  // becoming a change-detector — but a return to condensed, or a second family, fails here.
  assert.equal(decl('SHEET_TITLE_FONT'), decl('SHEET_BODY_FONT'), 'a drawing set is one family, not two');
  assert.equal(decl('SHEET_BODY_FONT'), decl('REFERENCE_LABEL_FONT'), 'body and map labels are one face');
  const family = SOURCE.match(/^const SHEET_SANS = (.+);$/m)?.[1] ?? '';
  assert.ok(family.length > 0, 'the sheet family is gone — every face here resolves through SHEET_SANS');
  assert.doesNotMatch(family, /Condensed|Narrow/, 'sheet lettering must be normal width — it is read at arm\'s length on paper');
  assert.doesNotMatch(family, /https?:|url\(/, 'no webfont: a face that fails to load offline changes the shape of a printed sheet');

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

  // The column now shares spare width between larger type and fewer wrapped lines. Its type
  // scale still comes from the panel placement; the map/sheet width must never own these sizes.
  assert.match(SOURCE, /typeW: placement\.typeWidth/);
  assert.match(block, /fsHeader = Math\.round\(typeW \*/);
  assert.match(block, /fsSection = Math\.round\(typeW \*/);
  assert.match(block, /fsBody = Math\.round\(typeW \*/);
  assert.match(block, /titleFont = .*Math\.round\(typeW \*/);
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

test('sector labels sit directly on the photograph with a dark halo, never an opaque chip', () => {
  const labelStart = SOURCE.indexOf('const labelAt =');
  const directStart = SOURCE.indexOf('const directLabelAt =', labelStart);
  const directFlushStart = SOURCE.indexOf('const flushDirectLabels =', directStart);
  const paletteStart = SOURCE.indexOf('// Regional-assumption palette', directFlushStart);

  assert.ok(labelStart >= 0 && directStart > labelStart, 'legacy sector label painter exists');
  assert.ok(directFlushStart > directStart && paletteStart > directFlushStart, 'composed sector label painter exists');

  const legacyPainter = SOURCE.slice(labelStart, directStart);
  const composedPainter = SOURCE.slice(directFlushStart, paletteStart);

  for (const [name, painter] of [
    ['legacy', legacyPainter],
    ['composed', composedPainter],
  ] as const) {
    const strokeAt = painter.indexOf('strokeText(');
    const fillAt = painter.indexOf('fillText(');
    assert.ok(strokeAt >= 0, `${name} sector labels draw a halo`);
    assert.ok(fillAt > strokeAt, `${name} sector labels paint coloured text over the halo`);
    assert.doesNotMatch(
      painter,
      /(?:fill|stroke)(?:Rect|RoundRect)|roundRect\(/,
      `${name} sector labels must not punch an opaque chip through the aerial`,
    );
  }

  assert.match(composedPainter, /lineJoin = 'round'/, 'wide composed-label halos keep soft corners');
});

test('sector provenance keeps its complete wording in a padded hairline box at the shared reading size', () => {
  const sectorStart = SOURCE.indexOf('async function composeSectorSheet(');
  const sectorEnd = SOURCE.indexOf('// The exact sheet is composeSectorSheet', sectorStart);
  assert.ok(sectorStart >= 0 && sectorEnd > sectorStart, 'sector sheet composer exists');
  const sectorComposer = SOURCE.slice(sectorStart, sectorEnd);

  assert.match(sectorComposer, /footerHeading: 'NOTES & PROVENANCE'/);
  assert.match(sectorComposer, /footerText: analysis\.noteText/);
  assert.match(sectorComposer, /footerBox: true/);

  const footerStart = SOURCE.indexOf('const footerFs =');
  const footerEnd = SOURCE.indexOf('// ── Scale bar', footerStart);
  assert.ok(footerStart >= 0 && footerEnd > footerStart, 'style-sheet footer painter exists');
  const footerPainter = SOURCE.slice(footerStart, footerEnd);

  // The earlier assertion pinned the smaller private floor. The public Sector export made its
  // required evidence note too small to read; it now shares the other sheets' footer scale.
  assert.match(footerPainter, /footerFs = legendFooterFontSize\(typeW\)/);
  assert.match(footerPainter, /footerBoxPad = options\.footerBox \? Math\.max\(6,/);
  assert.match(footerPainter, /footerTextX = lx \+ footerBoxPad/);
  assert.match(footerPainter, /ctx\.lineWidth = 1;\s+roundRectPath\(/);
  assert.doesNotMatch(sectorComposer, /analysis\.noteText\.(?:slice|replace|split|substring)/);
});

// A paint refactor must preserve the physical distance even when the sheet has side gutters.
// Execute the real painter without importing the browser-only component.
const painterTree = ts.createSourceFile('DesignGlossy.tsx', SOURCE, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function actualPainter(name: string, dependencies: Record<string, unknown> = {}): (...args: unknown[]) => unknown {
  let declaration: ts.FunctionDeclaration | undefined;
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) declaration = node;
    ts.forEachChild(node, visit);
  }
  visit(painterTree);
  assert.ok(declaration, `${name} is the shared paint authority`);
  const javascript = ts.transpileModule(declaration.getText(painterTree), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  return new Function('SHEET_BODY_FONT', ...Object.keys(dependencies), `${javascript}; return ${name};`)(
    'Public Sans', ...Object.values(dependencies),
  );
}

type PaintEvent = { kind: string; x?: number; y?: number; text?: string; ink?: string; alpha?: number };
function recordingContext() {
  const events: PaintEvent[] = [];
  const saved: Array<{ globalAlpha: number }> = [];
  const context = {
    globalAlpha: 0.2, lineWidth: 1, lineCap: 'butt', lineJoin: 'miter',
    strokeStyle: '#000000', fillStyle: '#000000', font: '', textBaseline: '', textAlign: '',
    save() { saved.push({ globalAlpha: this.globalAlpha }); },
    restore() { Object.assign(this, saved.pop()); },
    beginPath() {}, closePath() {}, arc() {},
    moveTo(x: number, y: number) { events.push({ kind: 'move', x, y }); },
    lineTo(x: number, y: number) { events.push({ kind: 'line', x, y }); },
    stroke() { events.push({ kind: 'stroke', ink: this.strokeStyle, alpha: this.globalAlpha }); },
    fill() { events.push({ kind: 'fill', ink: this.fillStyle, alpha: this.globalAlpha }); },
    strokeText(text: string, x: number, y: number) { events.push({ kind: 'text-outline', text, x, y, ink: this.strokeStyle, alpha: this.globalAlpha }); },
    fillText(text: string, x: number, y: number) { events.push({ kind: 'text', text, x, y, ink: this.fillStyle, alpha: this.globalAlpha }); },
  };
  return { context, events };
}

function contrastOnPaper(ink: string): number {
  assert.match(ink, /^#[\da-f]{6}$/i, 'measurement marks use opaque print ink');
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const a = luminance(ink), b = luminance('#FBF6EC');
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test('a readable scale bar still measures the stated metres when a sheet adds side gutters', () => {
  const paint = actualPainter('drawBlueprintScaleBar');
  for (const pixelsPerMetre of [0.5, 1, 5, 11, 32]) {
    const widths: number[] = [];
    for (const gutter of [0, 160, 320]) {
      const { context, events } = recordingContext();
      paint(context, 1200, 900, 30, 25, pixelsPerMetre, { x: gutter + 30, y: 850 });
      const start = events.find(event => event.kind === 'move')!;
      const end = events.find(event => event.kind === 'line')!;
      const label = events.find(event => event.kind === 'text')!;
      assert.match(label.text!, /^\d+ m$/);
      assert.equal(start.x, gutter + 30);
      assert.equal(end.y, start.y);
      const width = end.x! - start.x!;
      widths.push(width);
      assert.equal(width, Number(label.text!.split(' ')[0]) * pixelsPerMetre);
      assert.ok(width <= 1200 * 0.18, 'sheet furniture must not inflate the map scale');
      assert.ok(contrastOnPaper(label.ink!) >= 7, 'the metre label must remain readable on cream paper');
      assert.equal(label.alpha, 1, 'an earlier translucent map layer must not fade the ruler');
      assert.equal(context.globalAlpha, 0.2, 'the painter restores the surrounding drawing state');
    }
    assert.equal(new Set(widths).size, 1, 'gutters change the ruler position, never its metre width');
  }
});

test('the shared north marker stays inside the map and uses legible ink on paper', () => {
  const needle = actualPainter('drawImplNorthArrow');
  const paint = actualPainter('drawSheetNorthArrow', { drawImplNorthArrow: needle });
  for (const [width, height] of [[1200, 900], [2400, 1800], [1800, 2400]]) {
    for (const gutter of [0, 320]) {
      const { context, events } = recordingContext();
      paint(context, gutter, width, height);
      const label = events.find(event => event.kind === 'text')!;
      const tip = events.find(event => event.kind === 'move')!;
      const ends = events.filter(event => event.kind === 'line');
      assert.equal(label.text, 'N');
      assert.ok(label.x! > gutter && label.x! < gutter + width);
      assert.ok(label.y! > 0 && label.y! < height);
      assert.ok(ends.every(end => end.y! > tip.y!), 'the needle points up in the north-up frame');
      assert.ok(contrastOnPaper(label.ink!) >= 7);
      assert.equal(label.alpha, 1);
    }
  }
});


test('the compact masterplan prints its key at the same physical size without rescaling measured ground', () => {
  for (const [mapWidth, mapHeight] of [[2200, 2400], [2600, 1900], [1500, 2200]]) {
    const full = calculateStyleSheetSize(mapWidth, mapHeight);
    const compact = calculateSheetLegendPlacement(full, { includeLabelGutters: false });
    const outputs: string[] = [];
    for (const width of [full.W, compact.W]) {
      const placements: unknown[][] = [];
      const canvas = { width: 0, height: 0, getContext: () => ({
        fillStyle: '', fillRect() {}, drawImage(...args: unknown[]) { placements.push(args); },
      }) };
      const pad = actualPainter('padToPaperSheet', {
        paperSheetCanvas, document: { createElement: () => canvas }, releaseCanvas: () => {},
        drainCanvasToDataUrl: (result: { width: number; height: number }) => JSON.stringify({ width: result.width, height: result.height }),
      });
      const original = { width, height: mapHeight };
      const output = pad(original, full.W);
      assert.equal(typeof output, 'string');
      outputs.push(output as string);
      if (placements.length) {
        assert.equal(placements[0][0], original, 'the finished map is copied directly');
        assert.equal(placements[0].length, 3, 'paper padding must never scale or crop the map');
      }
    }
    assert.equal(outputs[0], outputs[1], 'same paper envelope prevents PDF enlargement of only sheet 08');
  }
  const composer = SOURCE.slice(SOURCE.indexOf('async function composeStyleSheet('), SOURCE.indexOf('// extendProtectMaskToStyleSheet lived here.'));
  assert.match(composer, /padToPaperSheet\(canvas, sheetSize\.W\)/, 'the composer supplies the common full-set envelope');
});
