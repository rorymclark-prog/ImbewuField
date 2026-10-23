// bug-13: the login page's `from` deep-link target (e.g. ?from=/farmer?panel=Water) must stay
// inside this app. `fromParam.startsWith('/')` alone let `//evil.com` through — browsers resolve
// a leading `//` as protocol-relative, so router.push('//evil.com') sent a signed-in user
// straight off this app right after they authenticated. A leading backslash is rejected too:
// some browsers normalise `/\evil.com` the same way as `//evil.com` when resolving a URL.
export function safeLoginRedirect(fromParam: string | null | undefined): string | null {
  if (!fromParam) return null;
  if (!fromParam.startsWith('/') || fromParam.startsWith('//') || fromParam.includes('\\')) {
    return null;
  }
  return fromParam;
}
