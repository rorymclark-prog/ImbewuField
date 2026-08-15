import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  EVIDENCE_CATALOGUE,
  INDIGENOUS_EDIBLES,
  LIMA_TIPS,
  QUICK_NUMBERS,
  evidenceStorageKeyBelongsToGroup,
  isEvidenceGroupKey,
  isEvidenceStorageKey,
  isQuickNumberField,
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
        water_rain_tanks: [
          { id: 'one', type: 'photo', dataUrl: 'data:image/jpeg;base64,a', takenAt: 1 },
        ],
        water_invented: [
          { id: 'wrong', type: 'photo', dataUrl: 'data:image/jpeg;base64,b', takenAt: 2 },
        ],
      },
      quickNumbers: {},
    },
  });
  assert.equal(getGroupCount('site', 'water'), 1);
  assert.ok(getReportCompleteness('site') > 0);

  installStorage({
    site: {
      items: {
        water_invented: [
          { id: 'wrong', type: 'photo', dataUrl: 'data:image/jpeg;base64,b', takenAt: 2 },
        ],
      },
      quickNumbers: {},
    },
  });
  assert.equal(getGroupCount('site', 'water'), 0);
  assert.equal(getReportCompleteness('site'), 0);
});

test('catalogue namespace helpers accept only keys the evidence UI can produce', () => {
  for (const group of EVIDENCE_CATALOGUE) {
    assert.equal(isEvidenceGroupKey(group.key), true);
    assert.equal(isEvidenceStorageKey(`${group.key}_site_photos`), true);
    assert.equal(
      evidenceStorageKeyBelongsToGroup(`${group.key}_site_photos`, group.key),
      true,
    );
    for (const item of group.items) {
      const storageKey = `${group.key}_${item.key}`;
      assert.equal(isEvidenceStorageKey(storageKey), true);
      assert.equal(evidenceStorageKeyBelongsToGroup(storageKey, group.key), true);
      assert.ok(
        EVIDENCE_CATALOGUE
          .filter((candidate) => candidate.key !== group.key)
          .every((candidate) => !evidenceStorageKeyBelongsToGroup(storageKey, candidate.key)),
      );
    }
  }
  assert.equal(isEvidenceGroupKey('waterfall'), false);
  assert.equal(isEvidenceStorageKey('water_invented'), false);
  assert.equal(evidenceStorageKeyBelongsToGroup('water_invented', 'water'), false);
});

test('only configured non-blank quick numbers can complete a report group', () => {
  installStorage({
    site: {
      items: {},
      quickNumbers: {
        water: {
          invented_measurement: '2500',
          tank_capacity: '   ',
        },
      },
    },
  });
  assert.equal(getReportCompleteness('site'), 0);
  assert.equal(isQuickNumberField('water', 'tank_capacity'), true);
  assert.equal(isQuickNumberField('water', 'invented_measurement'), false);

  installStorage({
    site: {
      items: {},
      quickNumbers: { water: { tank_capacity: '2500' } },
    },
  });
  assert.ok(getReportCompleteness('site') > 0);
});

test('empty evidence records never count as report proof', () => {
  installStorage({
    site: {
      items: {
        water_rain_tanks: [
          { id: 'empty-photo', type: 'photo', takenAt: 1 },
          { id: 'empty-note', type: 'note', note: '', takenAt: 2 },
        ],
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
    [{
      id: String(index),
      type: 'photo',
      dataUrl: `data:image/jpeg;base64,${index}`,
      takenAt: index,
    }],
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

// FUNDING PROOF: CASP and comparable SA smallholder programmes ask for a PTO / lease / title
// deed, a certified ID, a bank confirmation letter, a water-use licence and a dam registration
// certificate. Before this group existed, the catalogue had nowhere for a farmer to put them.
test('the Land & legal group exists with the papers a funding application asks for', () => {
  const group = EVIDENCE_CATALOGUE.find((g) => g.key === 'land_legal');
  assert.ok(group, 'land_legal group is missing from the catalogue');
  assert.equal(group!.label, 'Land & legal');

  const itemKeys = group!.items.map((item) => item.key);
  for (const expected of [
    'pto_lease_title',
    'certified_id',
    'bank_confirmation',
    'water_use_licence',
    'dam_registration',
  ]) {
    assert.ok(itemKeys.includes(expected), `missing tile: ${expected}`);
  }

  // Every tile is a document capture, the same flow as water_bills / lab_result /
  // electricity_bills — not photos of the land itself.
  for (const item of group!.items) {
    assert.equal(item.docOnly, true, `${item.key} must use the docOnly capture flow`);
  }
});

// THE THING THAT MATTERS MOST: for a Permit to Occupy this app is often the only place a
// document lives. A scanned photo is shrunk down (resizeForStorage) and an uploaded PDF keeps
// only its file name — never the file (see the "store filename only (no binary)" branch in
// EvidenceSheet's handleFiles) — and both sit in this browser's localStorage alone, which can
// silently evict the oldest item under storage pressure. A farmer must not read "saved here" as
// "backed up here". This is a SOURCE test because the failure mode is a missing UI banner, not a
// function a unit test can call.
test('the Land & legal sheet warns the farmer this app is not a backup of their papers', () => {
  const src = readFileSync(join(process.cwd(), 'components', 'EvidenceSheet.tsx'), 'utf8');

  assert.ok(
    /\{group\.key === 'land_legal' && \([\s\S]{0,600}This app is not a backup/.test(src),
    'the warning is missing, or is not gated to the land_legal group by a JSX conditional',
  );
  assert.match(src, /shrunk small/i, 'the warning must say what happens to a scanned photo');
  assert.match(
    src,
    /PDF[\s\S]{0,40}keeps only its file name, not the document/i,
    'the warning must say a PDF is not actually kept, only its name',
  );
  assert.match(src, /this phone alone/i, 'the warning must say storage is device-local');
  assert.match(
    src,
    /deleted automatically/i,
    'the warning must say old items can be silently evicted',
  );

  // The warning must render ahead of the capture buttons — a farmer who has already tapped
  // "Take / scan photo" has made their choice; the truth has to land before that, not after.
  const warnIdx = src.indexOf("This app is not a backup");
  const buttonsIdx = src.indexOf('Take / scan photo');
  assert.ok(warnIdx > 0 && buttonsIdx > 0 && warnIdx < buttonsIdx, 'warning must precede capture buttons');
});
