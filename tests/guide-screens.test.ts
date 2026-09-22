import assert from 'node:assert/strict';
import test from 'node:test';
import { statSync } from 'node:fs';
import { join } from 'node:path';

import { APP_GUIDES } from '@/lib/course-app-guides';
import { guidePackWithScreens, guideScreens } from '@/components/studies/guide-screens';

test('each app guide shows its own real screen and saves every shown picture at the stated size', () => {
  const firstScreens = new Set<string>();
  for (const guide of APP_GUIDES) {
    const screens = guideScreens(guide.id);
    assert.ok(screens.length > 0, `${guide.id} has no app screen`);
    assert.ok(!firstScreens.has(screens[0].src), `${guide.id} repeats a card picture`);
    firstScreens.add(screens[0].src);

    const pack = guidePackWithScreens(guide.id);
    assert.deepEqual(pack.missing, [], guide.id);
    assert.equal(new Set(pack.entries.map(item => item.url)).size, pack.entries.length, guide.id);
    for (const screen of screens) {
      const file = join(process.cwd(), 'public', screen.src);
      assert.equal(screen.bytes, statSync(file).size, `${guide.id}: ${screen.src}`);
      assert.ok(pack.entries.some(item => item.url === screen.src && item.kind === 'image'), `${guide.id}: ${screen.src} is not saved offline`);
    }
    assert.equal(pack.bytes, pack.entries.reduce((sum, item) => sum + item.bytes, 0));
  }
});
