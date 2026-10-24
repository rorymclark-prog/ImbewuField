import { inlineTemplate, inlineText } from '@/lib/xh-inline';
import { priceLabel, type Listing } from '@/lib/exchange';

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
  /** Unselected chip / segment-control pill — a translucent surface, not a literal paper
   *  hex, so it reads as a dark pill in dark mode instead of staying lit-paper bright. */
  chip: 'color-mix(in srgb, var(--color-surface) 80%, transparent)',
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
  /** Solid fills that carry `--on-forest` text: dark in every theme (the themed forest token turns
   *  leaf-green in dark, which left pale text on a pale fill). Same value as earth light's forest. */
  fill: '#1E4D33',
  fillInk: '#20190F',
  fillBlue: '#235E86',
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
  return inlineText(lang, english, isiZulu);
}

export const MONTH_LABEL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;
export const ZU_MONTH_LABEL = [
  'uJanuwari', 'uFebruwari', 'uMashi', 'u-Ephreli', 'uMeyi', 'uJuni',
  'uJulayi', 'u-Agasti', 'uSepthemba', 'u-Okthoba', 'uNovemba', 'uDisemba',
] as const;

/**
 * The English price line for a listing, in isiXhosa when the reader is on xh. The Rand amount and
 * its unit ("R6/kg") are numbers and units, so they stay; the words around them come from the
 * drafts. Any other language gets `priceLabel` exactly as before.
 */
export function xhPriceLabel(lang: string, listing: Pick<Listing, 'price'>): string {
  const english = priceLabel(listing);
  if (lang !== 'xh') return english;
  const p = listing.price;
  switch (p.type) {
    case 'free': return inlineText(lang, 'Free');
    case 'ask': return inlineText(lang, 'Make an offer');
    case 'swap': return inlineTemplate(lang, 'Swap — {wants}', null, { wants: p.wants });
    case 'zar':
      return p.per === 'lot'
        ? inlineTemplate(lang, '{amount} for the lot', null, { amount: english.replace(/ for the lot$/, '') })
        : english;
  }
}

/** The month name as isiXhosa wants it after "ngo": the draft is "uJanuwari", the sentence needs "Januwari". */
export function xhMonthStem(lang: string, month: string): string {
  return lang === 'xh' ? inlineText(lang, month).replace(/^u/, '') : month;
}
