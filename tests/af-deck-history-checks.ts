import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AF_DECK_RELEASE_ROWS } from '../lib/course-deck-release-bindings-af-data.ts';

// Afrikaans Studies slide cards (1 Nov 2026): new files under public/course-decks/<module>/af-silent/.
// Older media layers inventory every course media file, so this layer accounts for exactly these
// new cards: each must be a card the Afrikaans release declares, byte-exact to its recorded digest,
// and every declared card must exist. Older layers (the isiXhosa card layer first) then see the
// listing without them. tests/af-deck-release.test.ts checks the release itself.
const root = fileURLToPath(new URL('../', import.meta.url));
const sha = (v: Uint8Array) => createHash('sha256').update(v).digest('hex');
const AF_CARD = /^public\/course-decks\/[a-z0-9-]+\/af-silent\//;
const declared = new Map(AF_DECK_RELEASE_ROWS.flatMap(row => row.slides.map(slide =>
  ['public' + slide.imageUrl, { bytes: slide.imageBytes, sha256: slide.imageSha256 }] as const)));

let lastSuccessfulSignature = '';
/** The media listing as it was before the Afrikaans cards, after proving the cards are exactly the release's. */
export function afDeckListingBefore(paths: readonly string[]): string[] {
  const cards = paths.filter(path => AF_CARD.test(path)).sort();
  assert.deepEqual(cards, [...declared.keys()].sort(), 'Afrikaans card folders hold exactly the declared release cards');
  const signature = cards.map(path => {
    const s = statSync(resolve(root, path), { bigint: true });
    return [path, s.dev, s.ino, s.size, s.mtimeNs, s.ctimeNs].join(':');
  }).join('|');
  if (signature !== lastSuccessfulSignature) {
    for (const path of cards) {
      const bytes = readFileSync(resolve(root, path));
      const row = declared.get(path)!;
      assert.equal(bytes.length, row.bytes, path + ': declared Afrikaans card size');
      assert.equal(sha(bytes), row.sha256, path + ': declared Afrikaans card digest');
    }
    lastSuccessfulSignature = signature;
  }
  return paths.filter(path => !AF_CARD.test(path));
}

/** The same, for listings written as public URLs ('/course-decks/...') of one module's deck folder. */
export function afDeckUrlsBefore(urls: readonly string[], moduleId: string): string[] {
  const prefix = `/course-decks/${moduleId}/af-silent/`;
  const cards = urls.filter(url => url.startsWith(prefix)).sort();
  const expected = [...declared.keys()].filter(path => path.startsWith('public' + prefix)).map(path => path.slice('public'.length)).sort();
  assert.deepEqual(cards, expected, `${moduleId}: Afrikaans card folder holds exactly the declared release cards`);
  afDeckListingBefore(cards.map(url => 'public' + url).concat([...declared.keys()].filter(path => !path.startsWith('public' + prefix))));
  return urls.filter(url => !url.startsWith(prefix));
}
