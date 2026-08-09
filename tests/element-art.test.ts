import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';

import { ELEMENT_CATALOG } from '@/lib/design-elements';

const ART_ROOT = join(process.cwd(), 'public', 'element-art');

function withArt() {
  return ELEMENT_CATALOG.filter((element) => typeof element.art === 'string' && element.art !== '');
}

test('every art path a catalogue element declares actually exists', () => {
  const declared = withArt();
  assert.ok(declared.length > 0, 'the catalogue must exercise the picker-art path');
  for (const element of declared) {
    assert.ok(
      element.art!.startsWith('/element-art/'),
      `${element.id} points outside the picker-art root: ${element.art}`,
    );
    assert.ok(
      existsSync(join(process.cwd(), 'public', element.art!.replace(/^\//, ''))),
      `${element.id} declares ${element.art} but no such file ships — the picker would render a broken image where the emoji used to be`,
    );
  }
});

// Picker art sits on the tray's own background and, unlike the emoji it replaces, is a bitmap.
// A flattened export brings its matte with it and shows up as a grey tile behind the tree. This
// is the same defect that shipped the avocado canopy as a checkerboard square (PR #68/#70), so
// it is checked here too rather than trusted.
test('picker art is cut out, not a flattened tile', () => {
  for (const element of withArt()) {
    const file = join(process.cwd(), 'public', element.art!.replace(/^\//, ''));
    const { width, height, data } = PNG.sync.read(readFileSync(file));
    const alphaAt = (x: number, y: number) => data[(y * width + x) * 4 + 3];
    for (const [x, y] of [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]]) {
      assert.equal(alphaAt(x, y), 0, `${element.id} art has an opaque corner at (${x},${y})`);
    }
    let transparent = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] === 0) transparent += 1;
    assert.ok(
      transparent / (width * height) > 0.15,
      `${element.id} art is almost entirely opaque — that is a matte, not a cut-out tree`,
    );
  }
});

test('no picker art ships without an element pointing at it', () => {
  const used = new Set(withArt().map((element) => element.art!.split('/').pop()));
  const shipped = readdirSync(ART_ROOT).filter((name) => name.endsWith('.png'));
  assert.deepEqual(
    shipped.sort(),
    [...used].sort(),
    'unreferenced picker art costs every farmer download weight while showing them nothing',
  );
});
