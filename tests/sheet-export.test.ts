import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SHEET_EXPORT_PROFILES,
  imageMimeType,
  isMultiSheetFormat,
  sheetExportFileName,
  sheetSetFileName,
} from '../lib/sheet-export.ts';

test('quality steps are ordered and preserve the sheet aspect', () => {
  const { high, medium, low } = SHEET_EXPORT_PROFILES;
  assert.equal(high.scale, 1, 'high is the full render — a printed sheet must not be resampled');
  assert.ok(medium.scale < high.scale && low.scale < medium.scale, 'steps must actually step down');
  assert.ok(low.scale > 0);
  // One scale for both axes, so the A-series proportion the sheets are composed at survives every
  // quality step. A per-axis scale here would quietly un-square the paper.
  for (const profile of Object.values(SHEET_EXPORT_PROFILES)) {
    assert.ok(profile.jpegQuality > 0 && profile.jpegQuality <= 1);
    assert.ok(profile.label.length > 0 && profile.hint.length > 0, 'every step explains itself');
  }
});

test('only PDF carries a whole set in one file', () => {
  assert.equal(isMultiSheetFormat('pdf'), true);
  assert.equal(isMultiSheetFormat('jpeg'), false);
  assert.equal(isMultiSheetFormat('png'), false);
});

test('file names are safe, findable, and ordered when a set is exported', () => {
  assert.equal(sheetExportFileName('Ubhejane Crèche', 'Water map', 'jpeg'), 'ubhejane-creche-water-map.jpg');
  assert.equal(sheetExportFileName('Ubhejane Crèche', 'Water map', 'png', 3), 'ubhejane-creche-04-water-map.png');
  // A lone download is not numbered; a set is, so it sorts in render order rather than
  // alphabetically by sheet name.
  assert.ok(!sheetExportFileName('Site', 'Zones', 'jpeg').includes('01-'));
  assert.ok(sheetExportFileName('Site', 'Zones', 'jpeg', 0).includes('01-'));

  // Nothing that could escape a directory or break a phone's file browser survives the slug.
  const nasty = sheetExportFileName('../../etc/passwd', 'a/b\\c:*?"<>|', 'jpeg');
  assert.ok(!/[/\\:*?"<>|]/.test(nasty), `unsafe characters survived: ${nasty}`);
  assert.match(nasty, /^[a-z0-9.-]+$/);

  // An unnamed site still produces a usable name rather than a leading dash or an empty stem.
  assert.equal(sheetExportFileName(undefined, 'Zones', 'jpeg'), 'site-zones.jpg');
  assert.equal(sheetExportFileName('!!!', '???', 'jpeg'), 'site-sheet.jpg');
  assert.equal(sheetSetFileName(undefined, 9), 'site-plan-9-sheets.pdf');
});

test('image mime types match the chosen format', () => {
  assert.equal(imageMimeType('png'), 'image/png');
  assert.equal(imageMimeType('jpeg'), 'image/jpeg');
});
