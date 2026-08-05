/**
 * The exchange screens reuse the app's existing paper-and-ink palette verbatim
 * (see app/community/page.tsx, app/funder/page.tsx) rather than introducing a
 * second visual language for one feature. Collected here so the four exchange
 * components agree without copy-pasting hex codes.
 */
export const EX = {
  /** Page background — the app's warm paper. */
  bg: '#E4DCC6',
  /** Card / panel surface. */
  card: '#FFFEFA',
  /** Hairline between surfaces. */
  border: '#E2D8C4',
  /** Form-control border — a shade stronger than a card hairline. */
  inputBorder: '#D8CBB2',
  /** Primary text. */
  ink: '#20190F',
  /** Secondary text. */
  muted: '#5C5040',
  /** Tertiary text, captions, metadata. */
  faint: '#8C7A62',
  /** Brand green — offers, primary actions. */
  green: '#1F4D2B',
  /** Blue — wants. Same blue the community board uses for its "want" kind. */
  blue: '#235E86',
  /** Amber — free / swap, and the sample-data chip. */
  amber: '#C07A1E',
  /** Destructive. */
  red: '#8B2020',
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

export const MONTH_LABEL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;
