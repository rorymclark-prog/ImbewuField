import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareFieldVisitDraft, fieldVisitDraftHasPhotos } from '../lib/field-visit-draft';
import type { FieldVisit } from '../lib/field-teams';

const ready = { open: true, photosReady: true, photosBusy: false, captureBusy: false, saving: false, readOnly: false };
const photo = { image: 'data:image/png;base64,c2VlZGxpbmc=', caption: 'Existing seedlings' };
const visit: FieldVisit = { id: 'mentor_visit', mentorId: 'mentor', farmerId: 'farmer', date: '2026-09-09', notes: 'Saved observations', photoCount: 1, photos: [photo] };

test('loading or failed visit photos cannot become an empty-photo draft', () => {
  const listed = { ...visit, photos: [] };
  assert.equal(prepareFieldVisitDraft(listed, { ...ready, photosReady: false, photosBusy: true }), null);
  assert.equal(prepareFieldVisitDraft(listed, { ...ready, photosReady: false }), null);
  assert.equal(prepareFieldVisitDraft(visit, { ...ready, captureBusy: true }), null);
  assert.equal(fieldVisitDraftHasPhotos(listed), false, 'a previously incomplete draft must keep submission disabled');
});

test('a completed photo load survives draft storage and deliberate removal remains possible', () => {
  const restored = structuredClone(prepareFieldVisitDraft(visit, ready)!);
  assert.deepEqual(restored.photos, [photo]);
  assert.equal(fieldVisitDraftHasPhotos(restored), true);
  const intentionallyRemoved = prepareFieldVisitDraft({ ...visit, photos: [] }, ready)!;
  assert.equal(intentionallyRemoved.photoCount, 0);
  assert.equal(fieldVisitDraftHasPhotos(intentionallyRemoved), true);
});

test('the visit form carries evidence readiness into saving and restoring drafts', () => {
  const source = readFileSync(new URL('../components/FieldTeams.tsx', import.meta.url), 'utf8');
  assert.match(source, /prepareFieldVisitDraft\(visit,\{open:visitOpen,photosReady,photosBusy,captureBusy,saving:busy,readOnly:readOnlyVisit\}\)/);
  assert.match(source, /const complete=fieldVisitDraftHasPhotos\(value\);[\s\S]*?setPhotosReady\(complete\)/);
});
