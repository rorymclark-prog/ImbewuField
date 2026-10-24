import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { XH_DECK_RELEASE_ROWS } from '../lib/course-deck-release-bindings-xh-data.ts';

// isiXhosa Studies slide cards (24 Oct 2026): 240 new files under public/course-decks/<module>/xh-silent/.
// Older media layers inventory every course media file, so this layer accounts for exactly these
// new cards: each must be a card the isiXhosa release declares, byte-exact to its recorded digest,
// and every declared card must exist. Older layers then see the listing without them. Nothing older
// is changed by this layer; tests/xh-deck-release.test.ts checks the release itself.
const root = fileURLToPath(new URL('../', import.meta.url));
const sha = (v: Uint8Array) => createHash('sha256').update(v).digest('hex');
const XH_CARD = /^public\/course-decks\/[a-z0-9-]+\/xh-silent\//;
const declared = new Map(XH_DECK_RELEASE_ROWS.flatMap(row => row.slides.map(slide =>
  ['public' + slide.imageUrl, { bytes: slide.imageBytes, sha256: slide.imageSha256 }] as const)));

let lastSuccessfulSignature = '';
/** The media listing as it was before the isiXhosa cards, after proving the cards are exactly the release's. */
export function xhDeckListingBefore(paths: readonly string[]): string[] {
  const cards = paths.filter(path => XH_CARD.test(path)).sort();
  assert.deepEqual(cards, [...declared.keys()].sort(), 'isiXhosa card folders hold exactly the declared release cards');
  const signature = cards.map(path => {
    const s = statSync(resolve(root, path), { bigint: true });
    return [path, s.dev, s.ino, s.size, s.mtimeNs, s.ctimeNs].join(':');
  }).join('|');
  if (signature !== lastSuccessfulSignature) {
    for (const path of cards) {
      const bytes = readFileSync(resolve(root, path));
      const row = declared.get(path)!;
      assert.equal(bytes.length, row.bytes, path + ': declared isiXhosa card size');
      assert.equal(sha(bytes), row.sha256, path + ': declared isiXhosa card digest');
    }
    lastSuccessfulSignature = signature;
  }
  return paths.filter(path => !XH_CARD.test(path));
}
