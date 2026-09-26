/** Keep an exact English source alongside an isiZulu screen-reader label. */
export function accessibleSourceLabel(lang: string, localized: string, english: string): string {
  return lang === 'zu' && localized !== english ? `${localized} — ${english}` : localized;
}
