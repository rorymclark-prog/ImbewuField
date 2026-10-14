/**
 * Defence-in-depth caps on AI request SHAPE, not just overall body bytes.
 *
 * guardPaidApiRequest already rejects an oversized body (MAX_API_BODY_BYTES, lib/api-auth.ts) —
 * but that check is HEADER-ONLY and fails open when content-length is missing (see the comment on
 * MAX_API_BODY_BYTES). sec-03: a single oversized guest chat or design request — a huge message, a
 * huge context array, or a huge embedded image — can still overshoot the guest's R1 allowance and
 * server memory before that header check ever sees it. These caps are checked after auth/metering
 * and before any AI call, so an oversized request is turned away rather than spent on.
 */

export const MAX_MESSAGE_CHARS = 8000;
export const MAX_CHAT_MESSAGES = 40;
/** JSON.stringify(context).length — one number that covers every array the chat context can grow,
 *  instead of enumerating production/sales/reports/milestones/etc. separately. */
export const MAX_CONTEXT_JSON_CHARS = 60_000;
export const MAX_IMAGES_PER_REQUEST = 6;
/** Same ceiling app/api/analyse-photos/route.ts already uses for one base64 image. */
export const MAX_IMAGE_B64_CHARS = 7_000_000;
/** A single free-text field (e.g. design's photoAnalysis), not a whole context object. */
export const MAX_FREE_TEXT_CHARS = 20_000;

export function tooManyMessages(count: number): boolean {
  return count > MAX_CHAT_MESSAGES;
}

export function messageTooLong(messages: { content: string }[]): boolean {
  return messages.some((m) => m.content.length > MAX_MESSAGE_CHARS);
}

export function contextTooLarge(ctx: unknown): boolean {
  if (!ctx) return false;
  try {
    return JSON.stringify(ctx).length > MAX_CONTEXT_JSON_CHARS;
  } catch {
    return true; // unserialisable context is not a shape this app accepts either
  }
}

export function imageTooLarge(image?: { data?: string }): boolean {
  return !!image?.data && image.data.length > MAX_IMAGE_B64_CHARS;
}
