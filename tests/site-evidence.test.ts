import test from 'node:test';
import assert from 'node:assert/strict';

const KEY = 'imbewu_evidence_v1';

class MemoryStorage {
  readonly rows = new Map<string, string>();
  failWrites = false;
  getItem(key: string): string | null { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('quota exceeded');
    this.rows.set(key, value);
  }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { localStorage: storage },
});
const evidence = await import('../lib/site-evidence.ts');

function reset(): void {
  storage.rows.clear();
  storage.failWrites = false;
}

test('malformed persisted sites, keys and rows are filtered into a safe store', () => {
  reset();
  storage.setItem(KEY, JSON.stringify({
    site: {
      items: {
        water_tank: [
          { id: 'good', type: 'photo', dataUrl: 'data:image/jpeg;base64,a', takenAt: 1 },
          { id: 'bad-time', type: 'photo', dataUrl: 'x', takenAt: null },
          { id: 'bad-type', type: 'video', dataUrl: 'x', takenAt: 2 },
          { id: 'empty-photo', type: 'photo', takenAt: 3 },
        ],
        constructor: [{ id: 'unsafe', type: 'note', note: 'x', takenAt: 4 }],
      },
      quickNumbers: { water: { capacity: '2500', constructor: 'unsafe' } },
    },
    broken: 'not a site',
  }));

  assert.deepEqual(evidence.getEvidenceItems('site', 'water_tank').map((item) => item.id), ['good']);
  assert.deepEqual(evidence.getQuickNumbers('site', 'water'), { capacity: '2500' });
  assert.deepEqual(evidence.getSiteEvidence('broken'), {});
  assert.equal(evidence.getTotalEvidenceCount('site'), 1);
});

test('unsafe keys and invalid payloads are rejected without touching storage', () => {
  reset();
  const before = storage.getItem(KEY);
  const photo = { type: 'photo' as const, dataUrl: 'data:image/jpeg;base64,a' };

  assert.equal(evidence.addEvidenceItem('__proto__', 'water_tank', photo), false);
  assert.equal(evidence.addEvidenceItem('site', 'constructor', photo), false);
  assert.equal(evidence.addEvidenceItem('site', 'water_tank', { type: 'photo' }), false);
  assert.equal(evidence.setQuickNumber('site', '__proto__', 'capacity', '2500'), false);
  assert.equal(storage.getItem(KEY), before);
});

test('per-key retention is bounded and drops the oldest item rather than insertion position', () => {
  reset();
  for (let index = 0; index < 12; index += 1) {
    assert.equal(evidence.addEvidenceItem('site', 'water_tank', {
      type: 'note',
      note: `note-${index}`,
    }), true);
  }

  const items = evidence.getEvidenceItems('site', 'water_tank');
  assert.ok(items.length > 0 && items.length < 12);
  assert.equal(items.at(-1)?.note, 'note-11');
  assert.ok(items.every((item) => Number.isFinite(item.takenAt)));
});

test('the documented global item limit is enforced across many keys', () => {
  reset();
  for (let index = 0; index < 70; index += 1) {
    assert.equal(evidence.addEvidenceItem('site', `group_${index}`, {
      type: 'note',
      note: `note-${index}`,
    }), true);
  }

  const count = evidence.getTotalEvidenceCount('site');
  assert.ok(count > 0 && count < 70, 'total evidence must remain globally bounded');
  assert.equal(evidence.getEvidenceItems('site', 'group_69')[0]?.note, 'note-69');
});

test('an item larger than the whole budget fails without evicting older evidence', () => {
  reset();
  assert.equal(evidence.addEvidenceItem('site', 'soil_note', {
    type: 'note',
    note: 'keep me',
  }), true);
  const before = storage.getItem(KEY);

  assert.equal(evidence.addEvidenceItem('site', 'site_photo', {
    type: 'photo',
    dataUrl: `data:image/jpeg;base64,${'a'.repeat(2_200_000)}`,
  }), false);
  assert.equal(storage.getItem(KEY), before);
  assert.equal(evidence.getEvidenceItems('site', 'soil_note')[0]?.note, 'keep me');
});

test('quota failure reports false and preserves persisted truth', () => {
  reset();
  assert.equal(evidence.addEvidenceItem('site', 'soil_note', {
    type: 'note',
    note: 'existing',
  }), true);
  const before = storage.getItem(KEY);
  storage.failWrites = true;

  assert.equal(evidence.addEvidenceItem('site', 'soil_note', {
    type: 'note',
    note: 'not saved',
  }), false);
  assert.equal(storage.getItem(KEY), before);

  storage.failWrites = false;
});

test('remove and quick-number summaries reflect only persisted changes', () => {
  reset();
  assert.equal(evidence.setQuickNumber('site', 'water', 'capacity', '2500'), true);
  assert.equal(evidence.getReportCompleteness('site') > 0, true);
  assert.deepEqual(evidence.getQuickNumbers('site', 'water'), { capacity: '2500' });

  assert.equal(evidence.addEvidenceItem('site', 'water_tank', {
    type: 'note',
    note: 'tank checked',
  }), true);
  const [item] = evidence.getEvidenceItems('site', 'water_tank');
  assert.equal(evidence.removeEvidenceItem('site', 'water_tank', 'missing'), false);
  assert.equal(evidence.removeEvidenceItem('site', 'water_tank', item.id), true);
  assert.equal(evidence.getGroupCount('site', 'water'), 0);
  assert.equal(evidence.getReportCompleteness('site') > 0, true, 'quick number still covers water');
});
