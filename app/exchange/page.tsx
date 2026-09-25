import type { Metadata } from 'next';
import workspace from '@/components/layout/Workspace.module.css';
import {
  DEMO_EXCHANGE,
  filterListings,
  listingCropOptions,
  summariseExchange,
} from '@/lib/exchange';
import ExchangeBoard from '@/components/exchange/ExchangeBoard';
import { getCropArt } from '@/lib/crop-art';
import ExchangeHeader from '@/components/exchange/ExchangeHeader';
import ExchangeLede from '@/components/exchange/ExchangeLede';

/*
 * /exchange — the farmer-to-farmer trade board.
 *
 * A server component on purpose. The interactive board below is a client
 * component (it filters, sorts, and writes to this device's storage), but the
 * page states what is actually on the board — how many listings, from how many
 * farmers, which crops — in server-rendered markup, before a byte of JavaScript
 * runs. This is a PWA for farmers on cheap phones and thin signal: a page that
 * says nothing until React boots is a page that says nothing.
 *
 * Worth knowing when reading the served HTML: `AuthProvider` (lib/auth.tsx:72,
 * 285) starts with `loading = isBackendConfigured()`, and while that is true it
 * renders a spinner INSTEAD of its children. Server-side that never resolves,
 * so on any route in this app the visible HTML body is the spinner and the real
 * tree arrives in the RSC flight payload for the client to render. Which means
 * a client component's output is absent from the served response entirely —
 * only a server component's is there. Hence the lede below.
 *
 * NO AUTH GATE, DELIBERATELY. Every row on this page is either invented sample
 * data (lib/exchange.ts DEMO_LISTINGS) or something typed into this very
 * browser. No Firestore read happens, so there is nothing here to protect — and
 * gating it would only hide the sample board behind a login that proves
 * nothing. The moment a real cross-farmer read is wired, this page needs a
 * signed-in gate and the community flag, and the listings must come through a
 * server-side authorised path — see the banner in components/exchange/listing-store.ts.
 */

export const metadata: Metadata = {
  title: 'Farmer exchange — ImbewuField',
  description:
    'Trade seed, seedlings, surplus produce, tools and labour with farmers near you. Browse by crop, sort by who is closest.',
};

// Computed on the server from the sample board. `filterListings()` with no
// filter drops closed listings, so these counts describe what is actually
// tradeable. A farmer's own device-local listings cannot be counted here — the
// server has no access to them, which is precisely the point — so the wording
// says "sample board", not "the board".
const OPEN_SAMPLE_LISTINGS = filterListings(DEMO_EXCHANGE.listings);
const SAMPLE_SUMMARY = summariseExchange(OPEN_SAMPLE_LISTINGS);
const SAMPLE_TOP_CROPS = listingCropOptions(OPEN_SAMPLE_LISTINGS).slice(0, 6);

export default function ExchangePage() {
  return (
    <div className="h-[100dvh] overflow-y-auto font-sans" style={{ background: '#E4DCC6', color: '#20190F' }}>
      <ExchangeHeader />

      <main className={`${workspace.workspace} px-4 py-4 sm:px-6 sm:py-6`}>
        {/* Server-rendered lede — the page says what is on the board before any
            JavaScript runs, and keeps saying it if JavaScript never arrives. */}
        <section
          className="rounded-2xl"
          style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', padding: 16, marginBottom: 14 }}
        >
          <ExchangeLede summary={SAMPLE_SUMMARY} crops={SAMPLE_TOP_CROPS.map((crop) => ({ cropKey: crop.cropKey, name: crop.name, icon: crop.icon, art: getCropArt(crop.cropKey) ?? null }))} />
        </section>

        <ExchangeBoard />
      </main>
    </div>
  );
}
