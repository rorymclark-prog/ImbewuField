'use client';

import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import { listingShareText, type Listing } from '@/lib/exchange';
import { shareListing } from './share';
import { EX } from './theme';

/**
 * The Share action on a listing card and on the new-listing confirmation —
 * the ONE thing that gets a device-local listing (see listing-store.ts) in
 * front of another farmer, since there is no server-side board yet. Formats
 * the listing that is already on screen and hands it to the OS share sheet;
 * see share.ts for the navigator.share → clipboard fallback.
 *
 * `'failed'` (no share sheet AND no clipboard — an old browser, or a
 * permission denial) shows the message inline instead of doing nothing: the
 * farmer can still select it and copy it by hand. That state is rare but not
 * hypothetical, and a Share button that can go silent is worse than none.
 */
export default function ShareListingButton({
  listing,
  label = 'Share listing',
}: {
  listing: Listing;
  label?: string;
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function handleShare() {
    const outcome = await shareListing(listing);
    if (outcome === 'copied') {
      setState('copied');
      setTimeout(() => setState('idle'), 2500);
    } else if (outcome === 'failed') {
      setState('failed');
    } else {
      // 'shared': the OS share sheet took over and already gave its own
      // confirmation. 'dismissed': the farmer backed out — leave it.
      setState('idle');
    }
  }

  return (
    <div>
      <button
        onClick={() => void handleShare()}
        aria-label={`${label} (WhatsApp, SMS…)`}
        className="flex items-center gap-1.5 font-sans font-semibold rounded-lg"
        style={{
          fontSize: 12,
          padding: '6px 12px',
          background: '#25D366',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {state === 'copied' ? <Check size={11.5} strokeWidth={2} /> : <Share2 size={11.5} strokeWidth={1.9} />}
        {state === 'copied' ? 'Copied — paste it into WhatsApp' : label}
      </button>
      {state === 'failed' && (
        <div
          className="rounded-lg"
          style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(226,216,196,0.5)', border: `1px solid ${EX.border}` }}
        >
          <p className="font-sans" style={{ fontSize: 11.5, color: EX.faint, margin: '0 0 6px', lineHeight: 1.45 }}>
            Could not share on this device. Copy this yourself and send it:
          </p>
          <textarea
            readOnly
            value={listingShareText(listing)}
            rows={5}
            aria-label="Listing details to copy"
            onFocus={(e) => e.currentTarget.select()}
            className="w-full font-sans rounded-lg px-2.5 py-2"
            style={{ fontSize: 12, background: '#fff', border: `1px solid ${EX.inputBorder}`, color: EX.ink, resize: 'none' }}
          />
        </div>
      )}
    </div>
  );
}
