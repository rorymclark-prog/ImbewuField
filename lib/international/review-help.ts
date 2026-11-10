/** Only pages with the shared reference-review scroll owner replace the launcher.
 * Locale worksheets already own their separate in-flow help and print layout. */
export function usesInternationalReviewHelp(pathname: string): boolean {
  return pathname === '/international' || pathname === '/international/'
    || pathname === '/international/projects' || pathname === '/international/projects/';
}
