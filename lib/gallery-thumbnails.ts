// Sequencing for the saved-sheet thumbnail backfill.
//
// Extracted from DesignGlossy so the ORDER can be tested. The bug it exists to prevent is not a
// wrong result — the old code produced perfectly correct thumbnails — it is a wrong *schedule*:
// a plain for-loop that fired every makeGalleryThumbnail at once, so a gallery of N sheets saved
// before thumbnails existed began N concurrent full-resolution PNG decodes on mount. At sheet
// size that is roughly 10 MB of bitmap each, plus a canvas apiece, on a phone.
//
// The comment above that loop already said "one at a time". Only the code disagreed, and no test
// could see the difference because both versions end with the same thumbnails saved.

export interface ThumbnailBackfillRow {
  id: string;
  thumb?: string;
}

export interface ThumbnailBackfillHooks<R extends ThumbnailBackfillRow> {
  /** Produce a small thumbnail for one row. Resolves undefined when it cannot. */
  make: (row: R) => Promise<string | undefined>;
  /** Called once per successfully generated thumbnail, in completion order. */
  onThumb: (row: R, thumb: string) => void;
  /** Checked before AND after every await, so an unmount stops the walk promptly. */
  isCancelled?: () => boolean;
}

/**
 * Walk `rows`, generating a thumbnail for each one that lacks it — strictly one at a time.
 *
 * Peak memory is one decode regardless of gallery size, because the next `make` is not called
 * until the previous has settled. Failure of any single row is skipped rather than thrown: a
 * gallery that cannot thumbnail one sheet must still thumbnail the rest.
 */
export async function backfillThumbnails<R extends ThumbnailBackfillRow>(
  rows: readonly R[],
  { make, onThumb, isCancelled }: ThumbnailBackfillHooks<R>,
): Promise<void> {
  for (const row of rows) {
    if (isCancelled?.()) return;
    if (row.thumb) continue;
    let thumb: string | undefined;
    try {
      thumb = await make(row);
    } catch {
      continue; // best-effort: one unreadable sheet must not stop the walk
    }
    if (isCancelled?.()) return;
    if (thumb) onThumb(row, thumb);
  }
}
