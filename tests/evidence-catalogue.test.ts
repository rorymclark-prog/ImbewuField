import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EVIDENCE_CATALOGUE,
  INDIGENOUS_EDIBLES,
  LIMA_TIPS,
  QUICK_NUMBERS,
} from '../lib/evidence-catalogue.ts';
import {
  getGroupCount,
  getReportCompleteness,
} from '../lib/site-evidence.ts';

class MemoryStorage {
  rows = new Map<string, string>();
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { this.rows.set(String(key), String(value)); }
  removeItem(key: string) { this.rows.delete(key); }
}

function installStorage(store: unknown) {
  const local = new MemoryStorage();
  local.setItem('imbewu_evidence_v1', JSON.stringify(store));
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: local });
  return local;
}

test('group and item storage namespaces are unique and prefix-safe', () => {
  const groupKeys = EVIDENCE_CATALOGUE.map((group) => group.key);
  assert.equal(new Set(groupKeys).size, groupKeys.length);
  for (const key of groupKeys) {
    assert.match(key, /^[a-z][a-z0-9_]*$/);
    assert.ok(!groupKeys.some((other) => other !== key && other.startsWith(`${key}_`)));
  }

  const storageKeys = EVIDENCE_CATALOGUE.flatMap((group) =>
    group.items.map((item) => `${group.key}_${item.key}`));
  assert.equal(new Set(storageKeys).size, storageKeys.length);
});

test('every evidence tile has complete presentation data and valid flags', () => {
  for (const group of EVIDENCE_CATALOGUE) {
    assert.ok(group.label.trim());
    for (const color of [group.color, group.bg, group.iconBg]) {
      assert.match(color, /^#[0-9A-F]{6}$/i);
    }
    assert.ok(group.items.length > 0);
    const itemKeys = group.items.map((item) => item.key);
    assert.equal(new Set(itemKeys).size, itemKeys.length);
    for (const item of group.items) {
      assert.ok(item.label.trim());
      assert.match(item.key, /^[a-z][a-z0-9_]*$/);
      if (item.docOnly !== undefined) assert.equal(typeof item.docOnly, 'boolean');
      if (item.invasive !== undefined) assert.equal(typeof item.invasive, 'boolean');
      if (item.mentorOnly !== undefined) assert.equal(typeof item.mentorOnly, 'boolean');
    }
  }
});

test('quick numbers belong to real groups and have unique complete fields', () => {
  const groupKeys = new Set(EVIDENCE_CATALOGUE.map((group) => group.key));
  for (const [groupKey, fields] of Object.entries(QUICK_NUMBERS)) {
    assert.ok(groupKeys.has(groupKey), groupKey);
    assert.equal(new Set(fields.map((field) => field.key)).size, fields.length);
    for (const field of fields) {
      assert.ok(field.key.trim());
      assert.ok(field.label.trim());
      assert.ok(field.unit.trim());
    }
  }
});

test('every group has honest coaching that asks for notes or entered measurements', () => {
  for (const group of EVIDENCE_CATALOGUE) {
    const tip = LIMA_TIPS[group.key];
    assert.ok(tip?.trim(), group.key);
    assert.doesNotMatch(
      tip,
      /\bI(?:'ll| will) (?:read|extract|identify|ID|design)\b|automatically/i,
      group.key,
    );
  }
  assert.match(LIMA_TIPS.water, /enter/i);
  assert.match(LIMA_TIPS.energy, /enter/i);
  assert.match(LIMA_TIPS.trees, /mentor.*confirm/i);
});

test('group counts require the exact catalogue namespace, not a lookalike prefix', () => {
  installStorage({
    site: {
      items: {
        water_tanks: [{ id: 'one', type: 'photo', takenAt: 1 }],
        waterfall_photo: [{ id: 'wrong', type: 'photo', takenAt: 2 }],
      },
      quickNumbers: {},
    },
  });
  assert.equal(getGroupCount('site', 'water'), 1);
  assert.ok(getReportCompleteness('site') > 0);

  installStorage({
    site: {
      items: {
        waterfall_photo: [{ id: 'wrong', type: 'photo', takenAt: 2 }],
      },
      quickNumbers: {},
    },
  });
  assert.equal(getGroupCount('site', 'water'), 0);
  assert.equal(getReportCompleteness('site'), 0);
});

test('each catalogue group can contribute evidence completeness exactly once', () => {
  const items = Object.fromEntries(EVIDENCE_CATALOGUE.map((group, index) => [
    `${group.key}_${group.items[0].key}`,
    [{ id: String(index), type: 'photo', takenAt: index }],
  ]));
  installStorage({ site: { items, quickNumbers: {} } });
  assert.equal(getReportCompleteness('site'), 100);
});

test('indigenous reference entries are uniquely identified and complete', () => {
  assert.equal(
    new Set(INDIGENOUS_EDIBLES.map((entry) => entry.name.toLowerCase())).size,
    INDIGENOUS_EDIBLES.length,
  );
  assert.equal(
    new Set(INDIGENOUS_EDIBLES.map((entry) => entry.sci.toLowerCase())).size,
    INDIGENOUS_EDIBLES.length,
  );
  for (const entry of INDIGENOUS_EDIBLES) {
    assert.ok(entry.name.trim());
    assert.match(entry.sci, /^[A-Z][a-z]+ [a-z][a-z-]+$/);
    assert.ok(entry.desc.trim());
    assert.equal(typeof entry.protected, 'boolean');
  }
});
