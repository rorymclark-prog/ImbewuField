/*
 * ═══ FARMER EXCHANGE — sharing one listing to WhatsApp ═══════════════════════
 *
 * Matches the pattern in app/invoice/page.tsx's shareInvoice(): try
 * navigator.share first, and treat a user-cancelled share sheet (AbortError)
 * as a completed action rather than a failure — falling through to a
 * fallback there would silently copy text the farmer had just declined to
 * send. See lib/file-delivery.ts for the same AbortError reasoning applied
 * to file shares.
 *
 * A listing shares as TEXT, not a file. navigator.share({ text }) drops the
 * message straight into WhatsApp's compose box on the devices this board is
 * built for — that is the whole ask (see the WHY in the workorder), and a
 * downloaded .txt file would not do it. The clipboard fallback below is the
 * equivalent of file-delivery.ts's download fallback for a device with no
 * share sheet at all (chiefly desktop): the text still reaches the farmer,
 * ready to paste, and the button shows a visible confirmation rather than a
 * silent no-op.
 */

import { listingShareText, type Listing } from '@/lib/exchange';

export type ShareListingOutcome = 'shared' | 'dismissed' | 'copied' | 'failed';

type ShareCapableNavigator = Navigator & {
  share?: (data: ShareData) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
};

function nav(): ShareCapableNavigator | undefined {
  return typeof navigator === 'undefined' ? undefined : (navigator as ShareCapableNavigator);
}

/**
 * Builds the message and hands it to the OS share sheet, falling back to the
 * clipboard when the API is absent or genuinely rejects. Never returns
 * without doing one of: opening the share sheet, copying the text, or
 * telling the caller it could do neither — the caller decides how a
 * `'failed'` outcome is shown, but it must always be shown.
 */
export async function shareListing(listing: Listing): Promise<ShareListingOutcome> {
  const text = listingShareText(listing);
  const n = nav();

  if (n?.share) {
    try {
      await n.share({ text, title: listing.title });
      return 'shared';
    } catch (err) {
      // The farmer opened the share sheet and backed out of it — a completed
      // choice, not a failed share. Anything else (the share target refused
      // the payload, etc.) falls through to the clipboard below.
      if (err instanceof Error && err.name === 'AbortError') return 'dismissed';
    }
  }

  if (n?.clipboard?.writeText) {
    try {
      await n.clipboard.writeText(text);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
  return 'failed';
}
