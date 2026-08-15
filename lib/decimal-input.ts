/**
 * Parses a decimal number the way a farmer actually types it into a text field,
 * accepting a comma as the decimal separator as well as a point — "12,5" and
 * "12.5" both read as 12.5.
 *
 * This exists because a native `<input type="number">` is the wrong control for
 * this: on a comma-decimal Android keyboard (common across South African
 * locales), typing the comma either gets silently dropped from the field — so
 * "12,5" lands in the DOM as "125" — or the whole value reports back as "" per
 * the HTML number-input spec, which does not recognise a comma as valid. Either
 * way the farmer sees no error and the field holds a value they never typed.
 * The fix used across this app is a plain `type="text" inputMode="decimal"`
 * input with the value parsed by hand through this function — see
 * components/design/BasePhotoImport.tsx for the first place this was found.
 *
 * Returns NaN for anything that still isn't a number afterwards, exactly like
 * parseFloat.
 */
export function parseDecimalInput(raw: string): number {
  return parseFloat(raw.trim().replace(',', '.'));
}
