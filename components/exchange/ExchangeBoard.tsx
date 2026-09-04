'use client';

import workspace from '@/components/layout/Workspace.module.css';

/*
 * ═══ FARMER EXCHANGE — the board ═════════════════════════════════════════════
 *
 * Farmers finding each other and trading seed, seedlings, surplus produce,
 * tools and labour. Every selector here comes from lib/exchange.ts; this file
 * holds no trade logic of its own, only the screen.
 *
 * WHERE THE DATA COMES FROM, AND WHY THAT IS THE WHOLE SECURITY STORY:
 *
 *   • The board rows are DEMO_LISTINGS — invented listings attributed to the
 *     sample farmer network in lib/network-demo.ts. They touch no backend.
 *   • Plus whatever THIS browser has posted (components/exchange/listing-store).
 *
 * There is no third source, and adding one is not a small change. A listing on
 * a real exchange is a copy its author chose to publish; it is never a live read
 * of another farmer's ledger. Nothing on this screen may query production_logs,
 * sales_logs, expense_logs or invoices for a uid other than the viewer's own —
 * under the deployed Firestore rules such a read is either denied (a broken
 * board) or, for a same-org peer, SUCCEEDS and hands one farmer another
 * farmer's income. See the banner in lib/exchange.ts for the full list of what
 * would have to be true before this runs on live data; none of it is deployable
 * from this checkout, which is why v1 is demo + device-local by construction.
 *
 * The viewer's own site coordinate (lib/saved-places.ts) is precise and is used
 * here only to compute distances in the browser. It is never attached to a
 * listing — listing-store.ts coarsens at the write boundary.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, CircleAlert, Info, Plus, Search, Users, X } from 'lucide-react';
import {
  DEMO_EXCHANGE,
  DEMO_LISTINGS,
  filterListings,
  LISTING_CATEGORIES,
  listingCropOptions,
  searchListings,
  summariseExchange,
  type LatLon,
  type Listing,
  type ListingCategory,
  type ListingKind,
  type ListingSort,
} from '@/lib/exchange';
import { loadPlaces, resolveMainSite } from '@/lib/saved-places';
import ExchangeGuide from './ExchangeGuide';
import ListingCard from './ListingCard';
import NewListingForm from './NewListingForm';
import {
  deleteLocalListing,
  isLocalListing,
  loadLocalListings,
  LOCAL_LISTINGS_EVENT,
  setLocalListingStatus,
} from './listing-store';
import { CATEGORY_LABEL, EX } from './theme';
import { getCropArt } from '@/lib/crop-art';

const SORT_LABEL: Record<ListingSort, string> = {
  newest: 'Newest first',
  nearest: 'Nearest first',
  price_low: 'Cheapest first',
  price_high: 'Highest price first',
  crop: 'By crop',
  quantity: 'Biggest quantity first',
};

const WITHIN_OPTIONS = [
  { value: '', label: 'Any distance' },
  { value: '10', label: 'Within 10 km' },
  { value: '25', label: 'Within 25 km' },
  { value: '50', label: 'Within 50 km' },
  { value: '100', label: 'Within 100 km' },
];

/**
 * Where the viewer is standing. "Nearest first" is meaningless without one, and
 * a farmer who has not yet saved a site — or a funder walking the demo on a
 * laptop — has none. So the towns already represented on the board double as
 * selectable vantage points: pick one and the whole board re-sorts around it.
 */
interface Viewpoint {
  id: string;
  label: string;
  origin: LatLon | null;
}

const NO_VIEWPOINT: Viewpoint = { id: 'none', label: 'Not set', origin: null };

function areaViewpoints(listings: Listing[]): Viewpoint[] {
  const seen = new Map<string, Viewpoint>();
  for (const l of listings) {
    if (l.lat === null || l.lon === null || l.areaText === '') continue;
    if (seen.has(l.areaText)) continue;
    seen.set(l.areaText, {
      id: `area:${l.areaText}`,
      label: l.areaText,
      origin: { lat: l.lat, lon: l.lon },
    });
  }
  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function ExchangeBoard() {
  // Empty on the server and on the first client render, so hydration matches;
  // the effect below fills it in. The demo listings are a module constant, so
  // the board is never blank — it renders complete in the server HTML.
  const [localListings, setLocalListings] = useState<Listing[]>([]);
  const [mySite, setMySite] = useState<{ name: string; lat: number; lon: number } | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);

  const [kind, setKind] = useState<ListingKind | 'all'>('all');
  const [categories, setCategories] = useState<ListingCategory[]>([]);
  const [cropKeys, setCropKeys] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ListingSort>('newest');
  const [withinKm, setWithinKm] = useState('');
  const [includeClosed, setIncludeClosed] = useState(false);
  const [viewpointId, setViewpointId] = useState('none');
  const [showForm, setShowForm] = useState(false);
  const [showGuide, setShowGuide] = useState(true);

  const refreshLocal = useCallback(() => setLocalListings(loadLocalListings()), []);

  useEffect(() => {
    setNowMs(Date.now());
    refreshLocal();
    // The farmer's own saved site. This coordinate is precise and stays in the
    // browser: it feeds haversine only. Wrapped because a farmer with no saved
    // place is the normal first-run case, not an error.
    try {
      const site = resolveMainSite(loadPlaces());
      if (site) {
        setMySite({ name: site.name, lat: site.lat, lon: site.lon });
        setViewpointId('my-site');
      }
    } catch {
      /* no saved places — the town picker below still gives a vantage point */
    }
    window.addEventListener(LOCAL_LISTINGS_EVENT, refreshLocal);
    return () => window.removeEventListener(LOCAL_LISTINGS_EVENT, refreshLocal);
  }, [refreshLocal]);

  const allListings = useMemo(() => [...localListings, ...DEMO_LISTINGS], [localListings]);

  const viewpoints = useMemo(() => {
    const mine: Viewpoint[] = mySite
      ? [{ id: 'my-site', label: `My site — ${mySite.name}`, origin: { lat: mySite.lat, lon: mySite.lon } }]
      : [];
    return [...mine, ...areaViewpoints(allListings)];
  }, [mySite, allListings]);

  const viewpoint = viewpoints.find((v) => v.id === viewpointId) ?? NO_VIEWPOINT;
  const origin = viewpoint.origin;

  const summary = useMemo(() => summariseExchange(filterListings(allListings)), [allListings]);
  const cropOptions = useMemo(() => listingCropOptions(filterListings(allListings)), [allListings]);

  const rows = useMemo(
    () =>
      searchListings(allListings, {
        filter: {
          kind: kind === 'all' ? undefined : kind,
          categories: categories.length > 0 ? categories : undefined,
          cropKeys: cropKeys.length > 0 ? cropKeys : undefined,
          query: query.trim() === '' ? undefined : query,
          within: origin && withinKm !== '' ? { origin, km: Number(withinKm) } : undefined,
          includeClosed,
        },
        sort,
        origin,
      }),
    [allListings, kind, categories, cropKeys, query, origin, withinKm, includeClosed, sort],
  );

  const filtersActive =
    kind !== 'all' || categories.length > 0 || cropKeys.length > 0 || query.trim() !== '' || withinKm !== '';

  function clearFilters() {
    setKind('all');
    setCategories([]);
    setCropKeys([]);
    setQuery('');
    setWithinKm('');
  }

  const boardEmpty = allListings.length === 0;
  const guideVisible = showGuide && localListings.length === 0 && !showForm && !boardEmpty;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Sample-data notice. DEMO_EXCHANGE.notice is the module's own words —
          rendered rather than paraphrased so the disclosure cannot drift. */}
      <div
        className="flex items-start gap-2 rounded-xl"
        style={{ background: 'rgba(192,122,30,0.1)', border: '1px solid rgba(192,122,30,0.28)', padding: '10px 12px' }}
      >
        <CircleAlert size={14} strokeWidth={2} style={{ color: EX.amber, marginTop: 1, flexShrink: 0 }} />
        <p className="font-sans" style={{ fontSize: 11.5, color: '#8A5A15', lineHeight: 1.5, margin: 0 }}>
          {DEMO_EXCHANGE.notice} Anything you post is saved on this device only.
        </p>
      </div>

      {/* Counts */}
      <div className="flex items-center gap-4 flex-wrap">
        <Stat value={summary.total} label={summary.total === 1 ? 'listing' : 'listings'} />
        <Stat value={summary.offers} label="offering" />
        <Stat value={summary.wants} label="wanted" />
        <Stat value={summary.cropCount} label="crops" />
        <Stat value={summary.farmerCount} label="farmers" icon />
      </div>

      {/* Search + post */}
      <div className="flex gap-2">
        <div style={{ position: 'relative', flex: 1 }}>
          <Search
            size={15}
            strokeWidth={1.9}
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: EX.faint }}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search crop, town or farmer"
            aria-label="Search listings"
            className="rounded-xl font-sans"
            style={{
              width: '100%',
              padding: '10px 12px 10px 34px',
              fontSize: 13.5,
              background: '#fff',
              border: `1px solid ${EX.inputBorder}`,
              color: EX.ink,
              outline: 'none',
            }}
          />
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setShowGuide(false); }}
          className="flex items-center gap-1.5 font-display font-semibold rounded-xl"
          style={{
            background: showForm ? 'transparent' : EX.green,
            color: showForm ? EX.muted : '#F7F2E9',
            border: showForm ? `1px solid ${EX.inputBorder}` : 'none',
            cursor: 'pointer',
            padding: '10px 14px',
            fontSize: 13,
            whiteSpace: 'nowrap',
          }}
        >
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? 'Close' : 'Post'}
        </button>
      </div>

      {showForm && (
        <NewListingForm
          mySite={mySite}
          onPosted={(listings) => { setLocalListings(listings); setShowForm(false); setSort('newest'); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {guideVisible && <ExchangeGuide variant="intro" onPost={() => { setShowForm(true); setShowGuide(false); }} />}

      {/* Offering / wanted */}
      <div className="flex gap-1.5">
        {([['all', 'Everything'], ['offer', 'Offering'], ['want', 'Wanted']] as const).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setKind(value)}
            className="font-sans font-semibold"
            style={{
              flex: 1,
              padding: '8px 6px',
              borderRadius: 10,
              fontSize: 12.5,
              cursor: 'pointer',
              background: kind === value ? EX.ink : 'rgba(255,254,250,0.7)',
              color: kind === value ? '#F7F2E9' : EX.muted,
              border: `1px solid ${kind === value ? EX.ink : EX.border}`,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Category chips */}
      <ChipRow label="Category">
        {LISTING_CATEGORIES.map((c) => {
          const count = summary.byCategory[c];
          const on = categories.includes(c);
          return (
            <Chip key={c} on={on} disabled={count === 0} onClick={() => setCategories((v) => toggle(v, c))}>
              {CATEGORY_LABEL[c]} <span style={{ opacity: 0.65 }}>{count}</span>
            </Chip>
          );
        })}
      </ChipRow>

      {/* Crop chips — only crops actually on the board, so no dead filters */}
      {cropOptions.length > 0 && (
        <ChipRow label="Crop">
          {cropOptions.map((c) => (
            <Chip
              key={c.cropKey}
              on={cropKeys.includes(c.cropKey)}
              onClick={() => setCropKeys((v) => toggle(v, c.cropKey))}
            >
              {getCropArt(c.cropKey) ? (
                <img src={getCropArt(c.cropKey)} alt="" aria-hidden style={{ width: 13, height: 13, objectFit: 'contain', verticalAlign: '-2px' }} />
              ) : (
                c.icon
              )}{' '}
              {c.name} <span style={{ opacity: 0.65 }}>{c.count}</span>
            </Chip>
          ))}
        </ChipRow>
      )}

      {/* Sort + vantage point */}
      <div
        className="rounded-xl"
        style={{ background: EX.card, border: `1px solid ${EX.border}`, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <ArrowUpDown size={13} strokeWidth={1.9} style={{ color: EX.faint }} />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as ListingSort)}
            aria-label="Sort listings"
            className="rounded-lg px-2 py-1.5 font-sans font-semibold"
            style={{ fontSize: 12.5, background: '#fff', border: `1px solid ${EX.inputBorder}`, color: EX.ink }}
          >
            {(Object.keys(SORT_LABEL) as ListingSort[]).map((s) => (
              <option key={s} value={s}>{SORT_LABEL[s]}</option>
            ))}
          </select>

          <span className="font-sans" style={{ fontSize: 12, color: EX.faint }}>viewing from</span>
          <select
            value={viewpointId}
            onChange={(e) => setViewpointId(e.target.value)}
            aria-label="Where you are viewing from"
            className="rounded-lg px-2 py-1.5 font-sans font-semibold"
            style={{ fontSize: 12.5, background: '#fff', border: `1px solid ${EX.inputBorder}`, color: EX.ink }}
          >
            <option value="none">nowhere in particular</option>
            {viewpoints.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>

          {origin && (
            <select
              value={withinKm}
              onChange={(e) => setWithinKm(e.target.value)}
              aria-label="Distance limit"
              className="rounded-lg px-2 py-1.5 font-sans font-semibold"
              style={{ fontSize: 12.5, background: '#fff', border: `1px solid ${EX.inputBorder}`, color: EX.ink }}
            >
              {WITHIN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
        </div>

        {/* Without a vantage point there is no distance to show, and the cards
            correctly show none. Say why, rather than leaving a farmer to wonder
            where the "how far away" the page promised went. */}
        {!origin && (
          <p
            className="font-sans"
            style={{ fontSize: 11.5, color: sort === 'nearest' ? EX.amber : EX.faint, margin: 0, lineHeight: 1.45 }}
          >
            {sort === 'nearest'
              ? 'Sorting by distance needs a starting point — choose a town above, or save your site on the map.'
              : 'Choose where you are viewing from to see how far away each listing is.'}
          </p>
        )}

        <label className="flex items-center gap-2" style={{ cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={includeClosed}
            onChange={(e) => setIncludeClosed(e.target.checked)}
            style={{ accentColor: EX.green, width: 14, height: 14 }}
          />
          <span className="font-sans" style={{ fontSize: 12, color: EX.muted }}>Show listings already done</span>
        </label>
      </div>

      {/* The board */}
      {boardEmpty ? (
        <ExchangeGuide variant="board-empty" onPost={() => { setShowForm(true); setShowGuide(false); }} />
      ) : rows.length === 0 ? (
        <div
          className="rounded-2xl text-center"
          style={{ background: EX.card, border: `1px solid ${EX.border}`, padding: '32px 20px' }}
        >
          <Search size={22} strokeWidth={1.6} style={{ color: EX.faint, margin: '0 auto 10px' }} />
          <p className="font-display font-semibold" style={{ fontSize: 14.5, color: EX.ink, margin: '0 0 4px' }}>
            Nothing matches that
          </p>
          <p className="font-sans" style={{ fontSize: 12.5, color: EX.faint, margin: '0 0 14px', lineHeight: 1.5 }}>
            {summary.total} {summary.total === 1 ? 'listing is' : 'listings are'} on the board — try a
            wider distance, or clear the filters.
          </p>
          {filtersActive && (
            <button
              onClick={clearFilters}
              className="font-sans font-semibold rounded-xl"
              style={{
                padding: '8px 16px',
                fontSize: 12.5,
                background: 'rgba(31,77,43,0.08)',
                color: EX.green,
                border: '1px solid rgba(31,77,43,0.2)',
                cursor: 'pointer',
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <span className="font-sans" style={{ fontSize: 12, color: EX.faint }}>
              Showing {rows.length} of {summary.total}
            </span>
            <div style={{ flex: 1 }} />
            {filtersActive && (
              <button
                onClick={clearFilters}
                className="font-sans font-semibold"
                style={{ fontSize: 12, background: 'transparent', border: 'none', color: EX.green, cursor: 'pointer', padding: 0 }}
              >
                Clear filters
              </button>
            )}
          </div>
          <div className={workspace.cards}>
            {rows.map((row) => (
              <ListingCard
                key={row.listing.id}
                row={row}
                nowMs={nowMs}
                mine={isLocalListing(row.listing)}
                hasOrigin={origin !== null}
                onClose={(id) => setLocalListings(setLocalListingStatus(id, 'closed'))}
                onDelete={(id) => setLocalListings(deleteLocalListing(id))}
              />
            ))}
          </div>
        </>
      )}

      {/* Scope. Stated once, plainly, rather than implied by absence. */}
      <div
        className="rounded-2xl"
        style={{ background: 'rgba(255,254,250,0.6)', border: `1px dashed ${EX.inputBorder}`, padding: 16 }}
      >
        <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
          <Info size={14} strokeWidth={1.9} style={{ color: EX.faint }} />
          <h2 className="font-display font-semibold" style={{ fontSize: 13.5, color: EX.ink, margin: 0 }}>
            What this preview does not do
          </h2>
        </div>
        <ul
          className="font-sans"
          style={{ fontSize: 12, color: EX.faint, lineHeight: 1.65, margin: 0, paddingLeft: 18 }}
        >
          <li><strong style={{ fontWeight: 600 }}>No messaging.</strong> You cannot contact another farmer from here. Nothing on a card is a contact button, because there is nothing behind it yet.</li>
          <li><strong style={{ fontWeight: 600 }}>No payments, no escrow, no delivery.</strong> Money and collection are arranged between the two farmers, off the app.</li>
          <li><strong style={{ fontWeight: 600 }}>No ratings or reputation.</strong> There is no score behind any name on this board.</li>
          <li><strong style={{ fontWeight: 600 }}>Nothing is published.</strong> Listings you post stay on this device. Sharing them between farmers needs the community backend switched on and its security rules extended first.</li>
          <li><strong style={{ fontWeight: 600 }}>Locations are approximate.</strong> Every listing carries a point rounded to about a kilometre — a neighbourhood, never a homestead.</li>
        </ul>
      </div>
    </div>
  );
}

function Stat({ value, label, icon }: { value: number; label: string; icon?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      {icon && <Users size={12} strokeWidth={2} style={{ color: EX.faint, alignSelf: 'center' }} />}
      <span className="font-display font-bold" style={{ fontSize: 17, color: EX.ink }}>{value}</span>
      <span className="font-sans" style={{ fontSize: 12, color: EX.faint }}>{label}</span>
    </div>
  );
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="font-sans uppercase"
        style={{ fontSize: 10, letterSpacing: '0.12em', color: EX.faint, marginBottom: 6 }}
      >
        {label}
      </div>
      <div className="flex gap-1.5 flex-wrap">{children}</div>
    </div>
  );
}

function Chip({
  on,
  disabled,
  onClick,
  children,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className="font-sans font-semibold"
      style={{
        padding: '6px 11px',
        borderRadius: 100,
        fontSize: 12,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        background: on ? EX.green : 'rgba(255,254,250,0.75)',
        color: on ? '#F7F2E9' : EX.muted,
        border: `1px solid ${on ? EX.green : EX.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}
