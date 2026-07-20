// What changed in the build the farmer is about to refresh into.
//
// The update banner used to say only "New version available" — which tells you a number changed,
// not whether it is worth interrupting your work for, and gives you nothing to check afterwards.
// (Rory: "when you refresh i want the changes listed underneath the refresh button and in brief".)
//
// RULES FOR WRITING THESE. One line per change, in the farmer's language, describing what is
// different ON THEIR SCREEN — never the mechanism. "Zone maps now follow the zones you drew", not
// "buildZoneOverlay is composited on the model-chrome path". Newest build at the top, and keep the
// list to the last few builds: this is a "should I refresh, and what do I look at" note, not a
// changelog. Anything longer belongs in the repo's docs.
export interface ReleaseNote {
  /** Short human date — no clock time; the farmer only needs the ordering. */
  when: string;
  changes: string[];
}

/** Shown newest-first under the Refresh button. The banner renders at most MAX_SHOWN lines total. */
export const RELEASE_NOTES: ReleaseNote[] = [
  {
    when: 'Latest',
    changes: [
      'Water plans now show the beds and basins your irrigation runs to',
      'Driveways stay driveways instead of being repainted as lawn',
      'Site and Sector sheets can now be AI-styled, not just exact',
      'Zone maps follow the zones you actually drew',
      'Your rendered maps are saved on this device and survive closing the app',
      'Fixed the phantom hedge along the fence, and the driveway merging into the house',
      'Beds, banana circles and tree basins moved to the Planting sheet where they belong',
    ],
  },
];

/** Never let the banner become a wall of text over the map. */
export const MAX_SHOWN = 5;

/** The lines to render, flattened and capped. Kept pure so it is testable without a DOM. */
export function visibleNotes(notes: ReleaseNote[] = RELEASE_NOTES, max = MAX_SHOWN): string[] {
  return notes.flatMap((n) => n.changes).slice(0, max);
}
