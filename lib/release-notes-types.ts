// Split out of lib/release-notes.ts (perf-02) so that code which only needs the tour-stop shape
// or cap — not the ~300 KB RELEASE_NOTES catalogue itself — doesn't force that catalogue into its
// bundle through a static value import. lib/release-notes.ts re-exports both so existing imports
// of them from there keep working unchanged.

export interface UpdateTourStop {
  title: string;
  where: string;
  detail: string;
  href: string;
}

// The saved update guide keeps five stops; showing more in the banner preview makes it disagree
// with the guide a farmer can actually open after refreshing.
export const MAX_TOUR_STOPS = 5;
