'use client';

/**
 * /network — the funder portfolio view.
 *
 * "Zoom into various gardens and beneficiaries … click on a farmer and see
 * their financials and surveys and progress." A map of every site in the
 * portfolio, a summary bar of what the portfolio adds up to, and a roster that
 * stays in step with the map.
 *
 * Composition:
 *   this file        header · summary bar · site roster · selection state
 *   NetworkMap.tsx   the map canvas, pins, legend and the farmer detail panel
 *
 * Only the Mapbox canvas is client-only (mapbox-gl needs `window`, the same
 * reason app/atlas and app/farmer dynamically import their maps). The summary
 * bar and roster deliberately server-render, so the portfolio is readable —
 * numbers, names, districts — before any map tile loads, and if the map fails
 * entirely the funder still sees the portfolio rather than a blank rectangle.
 *
 * DATA: DEMO_NETWORK only. No Firestore read happens on this route, by design
 * — see the security header in components/network/NetworkMap.tsx for what
 * would have to be true before this may show one real user's data to another.
 */

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Search, X, List, AlertTriangle } from 'lucide-react';
import BackButton from '@/components/BackButton';
import BrandLogo from '@/components/BrandLogo';
import SettingsButton from '@/components/SettingsButton';
import TabBar from '@/components/TabBar';
import {
  attentionFlags,
  filterNetwork,
  portfolioTotals,
  rollupBy,
  sortNetwork,
  type NetworkSortKey,
} from '@/lib/network';
import { DEMO_NETWORK, DEMO_NETWORK_NOTICE } from '@/lib/network-demo';
import type { GardenStatus } from '@/lib/db/types';

const NetworkMap = dynamic(() => import('@/components/network/NetworkMap'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center" style={{ background: '#E4DCC6' }}>
      <span className="font-display" style={{ fontSize: 14, color: '#5C5040' }}>
        Loading the portfolio map…
      </span>
    </div>
  ),
});

const INK = '#20190F';
const INK_SOFT = '#5C5040';
const INK_MUTED = '#8C7A62';
const LINE = '#E2D8C4';
const PAPER = '#FFFEFA';
const ATTENTION = '#C0531E';

const STATUS_COLOR: Record<GardenStatus, string> = {
  thriving: '#1F4D2B',
  establishing: '#9E5C08',
  support: '#C0531E',
};

const DASH = '—';
function group(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
/** A null aggregate means "not readable by this viewer" — never 0. */
function statKg(n: number | null): string {
  return n === null ? DASH : `${group(n)} kg`;
}
function statZar(n: number | null): string {
  return n === null ? DASH : `R${group(n)}`;
}
function statPct(n: number | null): string {
  return n === null ? DASH : `${Math.round(n)}%`;
}

const SORTS: Array<{ key: NetworkSortKey; label: string }> = [
  { key: 'attention', label: 'Attention' },
  { key: 'name', label: 'Name' },
  { key: 'production', label: 'Harvest' },
];

export default function NetworkPage() {
  const all = DEMO_NETWORK.farmers;

  const [query, setQuery] = useState('');
  const [districts, setDistricts] = useState<string[]>([]);
  const [sort, setSort] = useState<NetworkSortKey>('attention');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);

  const allDistricts = useMemo(
    () => rollupBy(all, 'municipality').map((d) => ({ key: d.key, count: d.farmerCount })),
    [all],
  );

  const rows = useMemo(
    () =>
      filterNetwork(all, {
        query: query.trim() || undefined,
        municipalities: districts.length ? districts : undefined,
      }),
    [all, query, districts],
  );

  const sorted = useMemo(() => sortNetwork(rows, sort), [rows, sort]);
  const totals = useMemo(() => portfolioTotals(rows), [rows]);

  const toggleDistrict = (key: string) =>
    setDistricts((cur) => (cur.includes(key) ? cur.filter((d) => d !== key) : [...cur, key]));

  const select = (id: string | null) => {
    setSelectedId(id);
    if (id) setListOpen(false);
  };

  const stats: Array<{ label: string; value: string; tone?: 'attention' }> = [
    { label: 'Sites', value: String(totals.farmerCount) },
    { label: 'Under plan', value: `${totals.totalPlotHa} ha` },
    { label: 'Districts', value: String(totals.municipalityCount) },
    { label: 'Harvested', value: statKg(totals.producedKg) },
    { label: 'Farmer income', value: statZar(totals.incomeZar) },
    { label: 'Median progress', value: statPct(totals.medianProgressPct) },
    {
      label: 'Needs attention',
      value: String(totals.needsAttentionCount),
      tone: totals.needsAttentionCount > 0 ? 'attention' : undefined,
    },
  ];

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#E4DCC6' }}>
      {/* ── Header ── */}
      <header
        className="flex-shrink-0 flex items-center px-3 md:px-4 gap-2"
        style={{ height: 52, background: PAPER, borderBottom: `1px solid ${LINE}` }}
      >
        <BackButton fallback="/home" />
        <BrandLogo />
        <div className="w-px h-5" style={{ background: LINE }} />
        <span className="text-xs font-display" style={{ color: INK_SOFT }}>
          Network · funder portfolio
        </span>
        <div className="flex-1" />
        <span
          // NEVER hide this on small screens. The privacy review caught it at
          // 375px: the stat strip read "16 sites · 27 090 kg · R215 520" with
          // no sample label anywhere on the first paint, so a funder's phone
          // screenshot would carry fabricated figures as if they were programme
          // results. A disclaimer that disappears at the size people actually
          // photograph is worse than none.
          className="font-sans font-semibold"
          style={{
            fontSize: 10.5,
            color: '#9E5C08',
            background: 'rgba(158,92,8,0.10)',
            border: '1px solid rgba(158,92,8,0.30)',
            borderRadius: 999,
            padding: '3px 9px',
            marginRight: 4,
          }}
        >
          Sample portfolio
        </span>
        <SettingsButton />
      </header>

      {/* ── Summary bar ── */}
      <div
        className="flex-shrink-0"
        style={{ background: PAPER, borderBottom: `1px solid ${LINE}` }}
      >
        <div className="flex items-stretch gap-0 overflow-x-auto px-3 md:px-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex flex-col justify-center flex-shrink-0"
              style={{
                padding: '9px 16px 9px 0',
                marginRight: 16,
                borderRight: `1px solid ${LINE}`,
                minWidth: 92,
              }}
            >
              <span
                className="font-sans"
                style={{
                  fontSize: 9.5,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: INK_MUTED,
                  whiteSpace: 'nowrap',
                }}
              >
                {s.label}
              </span>
              <span
                className="font-display font-bold"
                style={{
                  fontSize: 18,
                  lineHeight: 1.15,
                  marginTop: 2,
                  color: s.tone === 'attention' ? ATTENTION : INK,
                  whiteSpace: 'nowrap',
                }}
              >
                {s.value}
              </span>
            </div>
          ))}
          <div className="flex items-center flex-shrink-0" style={{ paddingLeft: 2 }}>
            <button
              onClick={() => setListOpen((v) => !v)}
              className="lg:hidden flex items-center gap-1.5 font-display font-semibold"
              style={{
                background: 'rgba(32,25,15,0.05)',
                border: `1px solid ${LINE}`,
                borderRadius: 999,
                padding: '6px 12px',
                fontSize: 12.5,
                color: INK,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <List size={13} />
              {listOpen ? 'Hide list' : 'Site list'}
            </button>
          </div>
        </div>
        {totals.reportingCount < totals.farmerCount && (
          <p
            className="font-sans px-3 md:px-4"
            style={{ fontSize: 10.5, color: INK_MUTED, paddingBottom: 6 }}
          >
            Totals cover {totals.reportingCount} of {totals.farmerCount} sites — the
            rest are not readable by this account.
          </p>
        )}
      </div>

      {/* ── Body: roster + map ── */}
      <div className="flex-1 flex overflow-hidden relative min-h-0">
        {/* Roster — overlay sheet on mobile, left column on lg+ */}
        <aside
          className={`${
            listOpen ? 'flex absolute inset-0 z-30' : 'hidden'
          } lg:flex lg:static lg:z-auto lg:w-[304px] lg:flex-shrink-0 flex-col overflow-hidden`}
          style={{ background: '#F4EFE4', borderRight: `1px solid ${LINE}` }}
        >
          {/* Search + filters */}
          <div className="flex-shrink-0 px-3 pt-3 pb-2" style={{ borderBottom: `1px solid ${LINE}` }}>
            <div
              className="flex items-center gap-2 px-2.5"
              style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 10, height: 36 }}
            >
              <Search size={14} style={{ color: INK_MUTED, flexShrink: 0 }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Farmer, site or district…"
                aria-label="Search the portfolio"
                className="flex-1 font-sans bg-transparent outline-none"
                style={{ fontSize: 13, color: INK, border: 'none', minWidth: 0 }}
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: INK_MUTED, display: 'flex' }}
                >
                  <X size={13} />
                </button>
              )}
              <button
                onClick={() => setListOpen(false)}
                aria-label="Close site list"
                className="lg:hidden"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: INK_SOFT, display: 'flex' }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5" style={{ marginTop: 8 }}>
              {allDistricts.map((d) => {
                const on = districts.includes(d.key);
                return (
                  <button
                    key={d.key}
                    onClick={() => toggleDistrict(d.key)}
                    className="font-sans font-semibold"
                    style={{
                      fontSize: 11,
                      borderRadius: 999,
                      padding: '3.5px 9px',
                      cursor: 'pointer',
                      background: on ? '#1F4D2B' : 'rgba(32,25,15,0.05)',
                      color: on ? '#F7F2E9' : INK_SOFT,
                      border: `1px solid ${on ? '#1F4D2B' : LINE}`,
                    }}
                  >
                    {d.key} {d.count}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5" style={{ marginTop: 8 }}>
              <span className="font-sans" style={{ fontSize: 10, color: INK_MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Sort
              </span>
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSort(s.key)}
                  className="font-sans font-semibold"
                  style={{
                    fontSize: 11,
                    borderRadius: 999,
                    padding: '3px 8px',
                    cursor: 'pointer',
                    background: sort === s.key ? 'rgba(31,77,43,0.12)' : 'transparent',
                    color: sort === s.key ? '#1F4D2B' : INK_MUTED,
                    border: `1px solid ${sort === s.key ? 'rgba(31,77,43,0.35)' : LINE}`,
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Site roster — server-rendered, so the portfolio reads without the map */}
          <div className="flex-1 overflow-y-auto px-2.5 py-2" style={{ minHeight: 0 }}>
            {sorted.length === 0 && (
              <p className="font-sans" style={{ fontSize: 12.5, color: INK_MUTED, padding: '14px 8px' }}>
                No sites match that search.
              </p>
            )}
            {sorted.map((row) => {
              const { farmer, metrics } = row;
              const on = farmer.id === selectedId;
              const flags = attentionFlags(row);
              return (
                <button
                  key={farmer.id}
                  onClick={() => select(farmer.id)}
                  className="w-full text-left"
                  style={{
                    display: 'block',
                    background: on ? PAPER : 'transparent',
                    border: `1px solid ${on ? '#1F4D2B' : 'transparent'}`,
                    borderRadius: 10,
                    padding: '8px 9px',
                    marginBottom: 3,
                    cursor: 'pointer',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: '50%',
                        background: STATUS_COLOR[farmer.status],
                        flexShrink: 0,
                      }}
                    />
                    <span
                      className="font-display font-semibold"
                      style={{ fontSize: 13.5, color: INK, flex: 1, minWidth: 0 }}
                    >
                      {farmer.name}
                    </span>
                    {flags.length > 0 && (
                      <AlertTriangle size={12} style={{ color: ATTENTION, flexShrink: 0 }} />
                    )}
                  </div>
                  <div
                    className="font-sans"
                    style={{ fontSize: 11, color: INK_MUTED, marginTop: 1, paddingLeft: 17 }}
                  >
                    {farmer.siteName} · {farmer.district}
                  </div>
                  <div
                    className="font-sans"
                    style={{ fontSize: 11, color: INK_SOFT, marginTop: 2, paddingLeft: 17 }}
                  >
                    {statKg(metrics.producedKg)} · {statZar(metrics.incomeZar)} ·{' '}
                    {group(farmer.plotSizeM2)} m²
                  </div>
                </button>
              );
            })}

            <p
              className="font-sans"
              style={{
                fontSize: 10,
                color: INK_MUTED,
                lineHeight: 1.5,
                margin: '10px 8px 4px',
                paddingTop: 9,
                borderTop: `1px solid ${LINE}`,
              }}
            >
              {DEMO_NETWORK_NOTICE}
            </p>
          </div>
        </aside>

        {/* Map + farmer panel */}
        <NetworkMap rows={rows} selectedId={selectedId} onSelect={select} />
      </div>

      <TabBar />
    </div>
  );
}
