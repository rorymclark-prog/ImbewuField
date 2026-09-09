import type { FieldVisit } from './field-teams';

export function prepareFieldVisitDraft(visit: FieldVisit, state: { open: boolean; photosReady: boolean; photosBusy: boolean; captureBusy: boolean; saving: boolean; readOnly: boolean }): FieldVisit | null {
  // A visit list carries a photo count but no image bytes. Persisting it while
  // those bytes are loading would turn a later draft restore into a photo deletion.
  if (!state.open || !state.photosReady || state.photosBusy || state.captureBusy || state.saving || state.readOnly) return null;
  const photos = visit.photos ?? [];
  // Once the photo editor is ready, a shorter array can be an intentional removal.
  return { ...visit, photos, photoCount: photos.length };
}

export function fieldVisitDraftHasPhotos(visit: FieldVisit): boolean {
  return Array.isArray(visit.photos) && (visit.photoCount ?? visit.photos.length) === visit.photos.length;
}
