/**
 * The exchange screens used to paint the app's paper-and-ink palette as literal hex, which meant
 * the board stayed lit-paper bright under dark mode while every screen around it followed the
 * theme. These now point at the same theme tokens /prices and /records paint with (see
 * app/globals.css) — declared per theme column, so a surface, border or piece of text here moves
 * with the theme instead of sitting still under it. Collected here so the exchange components
 * agree without copy-pasting var() strings.
 */
export const EX = {
  /** Page background. */
  bg: 'var(--color-canvas)',
  /** Card / panel surface. */
  card: 'var(--color-surface)',
  /** Hairline between surfaces, and form-control borders. */
  border: 'var(--color-border)',
  inputBorder: 'var(--color-border)',
  /** Primary text. */
  ink: 'var(--color-ink)',
  /** Secondary text. */
  muted: 'var(--color-muted-strong)',
  /** Tertiary text, captions, metadata. */
  faint: 'var(--color-muted)',
  /** Brand green — offers, primary actions. */
  green: 'var(--color-forest-800)',
  /** Blue — wants. Same blue the community board uses for its "want" kind. */
  blue: 'var(--color-water)',
  /** Amber FILL — free / swap, and the sample-data chip background. Ochre is a fill, never text
   *  (see CLAUDE.md); use `amberText` for the same colour family set as `color`. */
  amber: 'var(--color-ochre)',
  /** Amber as TEXT — the ochre-safe reading colour, not the fill above. */
  amberText: 'var(--color-harvest)',
  /** Destructive. */
  red: 'var(--danger)',
} as const;

/** Offers read green, wants read blue — the same mapping the shipped board uses. */
export const KIND_COLOR = { offer: EX.green, want: EX.blue } as const;
export const KIND_LABEL = { offer: 'Offering', want: 'Wanted' } as const;

export const CATEGORY_LABEL = {
  seed: 'Seed',
  seedlings: 'Seedlings',
  produce: 'Produce',
  tools: 'Tools',
  labour: 'Labour',
  other: 'Other',
} as const;

export const ZU_KIND_LABEL = { offer: 'Okunikezwayo', want: 'Okufunwayo' } as const;
export const ZU_CATEGORY_LABEL = {
  seed: 'Imbewu', seedlings: 'Izithombo', produce: 'Umkhiqizo', tools: 'Amathuluzi', labour: 'Umsebenzi', other: 'Okunye',
} as const;
export const ZU_PRICE_MODE_LABEL = {
  zar: 'Intengo ngamaRandi', swap: 'Ukushintshisana', free: 'Mahhala', ask: 'Cela isipho sentengo',
} as const;

export function exchangeText(lang: string, english: string, isiZulu: string): string {
  return lang === 'zu' ? isiZulu : english;
}

export const MONTH_LABEL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;
export const ZU_MONTH_LABEL = [
  'uJanuwari', 'uFebruwari', 'uMashi', 'u-Ephreli', 'uMeyi', 'uJuni',
  'uJulayi', 'u-Agasti', 'uSepthemba', 'u-Okthoba', 'uNovemba', 'uDisemba',
] as const;
