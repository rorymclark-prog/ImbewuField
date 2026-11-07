/** Keep an exact English source alongside an isiZulu, isiXhosa or Afrikaans screen-reader label. */
export function accessibleSourceLabel(lang: string, localized: string, english: string): string {
  return (lang === 'zu' || lang === 'xh' || lang === 'af') && localized !== english ? `${localized} — ${english}` : localized;
}
