/** Keep an exact English source alongside an isiZulu or isiXhosa screen-reader label. */
export function accessibleSourceLabel(lang: string, localized: string, english: string): string {
  return (lang === 'zu' || lang === 'xh') && localized !== english ? `${localized} — ${english}` : localized;
}
