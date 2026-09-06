import type { Metadata } from 'next';
import workspace from '@/components/layout/Workspace.module.css';
import Link from 'next/link';
import {
  DEMO_EXCHANGE,
  filterListings,
  listingCropOptions,
  summariseExchange,
} from '@/lib/exchange';
import ExchangeBoard from '@/components/exchange/ExchangeBoard';
import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';
import { getCropArt } from '@/lib/crop-art';

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
      <header
        className="flex items-center gap-3 px-4"
        style={{ height: 56, borderBottom: '1px solid #E2D8C4', background: '#FFFEFA' }}
      >
        <MenuButton /><BackButton fallback="/home" />
        <Link
          href="/home"
          aria-label="Back"
          style={{ display: 'flex', alignItems: 'center', color: '#5C5040', textDecoration: 'none' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <span aria-hidden="true" style={{ fontSize: 17 }}>🤝</span>
        <div style={{ minWidth: 0 }}>
          <h1 className="font-display font-bold" style={{ fontSize: 15.5, color: '#20190F', margin: 0, lineHeight: 1.2 }}>
            Farmer exchange
          </h1>
          <p className="font-sans" style={{ fontSize: 11.5, color: '#8C7A62', margin: 0, lineHeight: 1.3 }}>
            Seed, seedlings, surplus and tools — between farmers
          </p>
        </div>
        <div style={{ flex: 1 }} />
        <span
          className="font-mono hidden sm:block"
          style={{
            fontSize: 10.5,
            padding: '2px 8px',
            borderRadius: 100,
            background: 'rgba(192,122,30,0.12)',
            border: '1px solid rgba(192,122,30,0.3)',
            color: '#C07A1E',
            whiteSpace: 'nowrap',
          }}
        >
          preview · sample data
        </span>
      </header>

      <main className={`${workspace.workspace} px-4 py-4 sm:px-6 sm:py-6`}>
        {/* Server-rendered lede — the page says what is on the board before any
            JavaScript runs, and keeps saying it if JavaScript never arrives. */}
        <section
          className="rounded-2xl"
          style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', padding: 16, marginBottom: 14 }}
        >
          <p className="font-sans" style={{ fontSize: 13.5, color: '#5C5040', lineHeight: 1.6, margin: 0 }}>
            Farmers trading with farmers — seed, seedlings, surplus produce, tools and work-share.
            The sample board is carrying{' '}
            <strong style={{ color: '#20190F', fontWeight: 600 }}>
              {SAMPLE_SUMMARY.total} open {SAMPLE_SUMMARY.total === 1 ? 'listing' : 'listings'}
            </strong>{' '}
            from{' '}
            <strong style={{ color: '#20190F', fontWeight: 600 }}>
              {SAMPLE_SUMMARY.farmerCount} farmers
            </strong>{' '}
            across {SAMPLE_SUMMARY.cropCount} crops — {SAMPLE_SUMMARY.offers} offering,{' '}
            {SAMPLE_SUMMARY.wants} wanted.
          </p>
          {SAMPLE_TOP_CROPS.length > 0 && (
            <p className="font-sans" style={{ fontSize: 12.5, color: '#8C7A62', lineHeight: 1.6, margin: '8px 0 0' }}>
              Most traded right now:{' '}
              {SAMPLE_TOP_CROPS.map((crop, i) => (
                <span key={crop.cropKey} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  {i > 0 && ' · '}
                  {getCropArt(crop.cropKey) ? (
                    <img className="produce-art" src={getCropArt(crop.cropKey)} alt="" aria-hidden style={{ width: 14, height: 14, objectFit: 'contain' }} />
                  ) : (
                    <span>{crop.icon}</span>
                  )}{' '}
                  {crop.name}
                </span>
              ))}
            </p>
          )}
        </section>

        <ExchangeBoard />
      </main>
    </div>
  );
}
