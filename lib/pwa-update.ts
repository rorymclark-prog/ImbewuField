/** A build change is actionable only when both the loaded and latest deployment are known. */
export function isDifferentBuild(loadedSha: string | null, latestSha: string | null): boolean {
  return Boolean(loadedSha && latestSha && loadedSha !== latestSha);
}
