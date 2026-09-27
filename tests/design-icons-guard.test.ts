import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// swarm/w5-design-icons — guards the emoji-out-of-the-UI sweep this track did across the Design
// Studio (components/design/DesignPalette.tsx, DesignCanvas.tsx, DesignWizard.tsx) and the
// facilitator print page's screen-only layer checkboxes. See tests/no-emoji-icons.test.ts for the
// app-wide sweep and its RATCHET — this file is narrower and pins the specific lines this track
// touched so a future edit cannot quietly reintroduce an emoji icon there.
//
// Same detection rule as tests/no-emoji-icons.test.ts, duplicated rather than imported (that file
// exports nothing) — see its own comment for why the ranges are pinned rather than
// \p{Extended_Pictographic}: that Unicode property disagrees with itself across Node's shipped
// Unicode versions (22 vs 24), so a runtime-derived class gives a different verdict per machine.
const EMOJI_RANGES: [number, number][] = [
  [0x2600, 0x27bf],
  [0x2b00, 0x2bff],
  [0x1f000, 0x1faff],
];

function isIconGlyph(ch: string): boolean {
  const cp = ch.codePointAt(0);
  if (cp === undefined) return false;
  return EMOJI_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi);
}

const EMOJI = { test: (s: string) => [...s].some(isIconGlyph) };

/** `src` with comments and template literals blanked, keeping line numbers stable. */
function iconPositionsOnly(src: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, ' ');
  return src
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:])\/\/[^\n]*/g, blank)
    .replace(/`[^`]*`/g, blank);
}

function emojiLines(path: string, allowLines: Set<number> = new Set()): string[] {
  const code = iconPositionsOnly(readFileSync(path, 'utf8'));
  const out: string[] = [];
  code.split('\n').forEach((text, i) => {
    if (allowLines.has(i + 1)) return;
    if (!EMOJI.test(text)) return;
    const glyphs = [...text].filter(isIconGlyph).join('');
    out.push(`${path}:${i + 1}  ${glyphs}  ${text.trim().slice(0, 70)}`);
  });
  return out;
}

test('DesignPalette.tsx and DesignWizard.tsx render no emoji as UI icons', () => {
  const offences = [
    ...emojiLines('components/design/DesignPalette.tsx'),
    ...emojiLines('components/design/DesignWizard.tsx'),
  ];
  assert.deepEqual(
    offences, [],
    `${offences.length} emoji found where a Lucide icon belongs (CLAUDE.md is Lucide-only):\n${offences.join('\n')}`,
  );
});

test('DesignCanvas.tsx renders no emoji as interactive UI-chrome icons', () => {
  // The one line this track deliberately left: the adopted-AI-layer name pill drawn directly onto
  // the canvas (a de-collided label pill, the same family as every other placed-item label pill
  // rendered a few lines above it) — map-canvas content, not a toolbar/dialog control, so it is
  // out of this track's "Lucide only" scope the same way DesignGlossy.tsx's printed-sheet glyphs
  // are. If this line's own wording changes, update the allow-list rather than the assertion.
  const src = readFileSync('components/design/DesignCanvas.tsx', 'utf8');
  const allowLineNo = src.split('\n').findIndex((l) => l.includes("adopted ? `✓ ${layer.name}`")) + 1;
  assert.ok(allowLineNo > 0, 'the allowed adopted-layer-pill line has moved or been rewritten — update this test\'s allow-list');
  const offences = emojiLines('components/design/DesignCanvas.tsx', new Set([allowLineNo]));
  assert.deepEqual(
    offences, [],
    `${offences.length} emoji found where a Lucide icon belongs (CLAUDE.md is Lucide-only):\n${offences.join('\n')}`,
  );
});

test('the facilitator print page\'s screen-only layer checkboxes use Lucide, not emoji', () => {
  // The rest of app/facilitator/print/page.tsx (CATALOG/LINES/SECTOR_LABELS and the boqRows/
  // existingRows built from them) is intentionally left alone — tests/facilitator-print-fixes.
  // test.ts already records that those are the printed map's own legend/key and keep their emoji
  // on purpose. This test only pins the print-toolbar's per-layer page checkboxes, which are
  // hidden at print time (`.print-toolbar { display: none }` under @media print) and are pure
  // on-screen chrome.
  const src = readFileSync('app/facilitator/print/page.tsx', 'utf8');
  const toolbarStart = src.indexOf('className="print-toolbar"');
  const toolbarEnd = src.indexOf('{fullOn && (');
  assert.ok(toolbarStart > 0 && toolbarEnd > toolbarStart, 'could not find the print-toolbar block in app/facilitator/print/page.tsx');
  const toolbar = src.slice(toolbarStart, toolbarEnd);
  assert.match(toolbar, /LAYER_ICON\[lid\]/, 'the per-layer page checkbox row must render its icon through the Lucide LAYER_ICON lookup');
  assert.ok(!EMOJI.test(iconPositionsOnly(toolbar)), 'an emoji icon has crept back into the print-toolbar');
});
