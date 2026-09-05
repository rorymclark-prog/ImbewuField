/*
 * THE CLIENT EDGE OF THE AUTHORISED PORTFOLIO READ.
 *
 * `components/network/*` was written against DEMO_NETWORK and its security header listed four
 * preconditions that had to be true before it could be pointed at real farmers. They now are, and
 * this hook is the join: it calls /api/network/orgs to learn what the caller may see, then
 * /api/network/farmers for the chosen org, and hands back rows of exactly the type the demo
 * constant produced — so the map, the list and the detail panel are unchanged by the switch.
 *
 * SAMPLE MODE IS A STATE, NOT A FALLBACK. When there is no signed-in caller or no backend, this
 * returns the demo portfolio with `isDemo: true` and the caller is expected to render
 * DEMO_NETWORK_NOTICE beside it. What it must never do is fall back to demo data on an ERROR:
 * a failed authorised read means we do not know what this funder may see, and showing invented
 * farmers at that moment is worse than showing nothing, because the numbers look like a real
 * portfolio. On error the rows are empty and `error` is set. This is the same discipline
 * NgoDashboard already applies to a rules denial.
 *
 * WHY THE ORG LIST COMES FROM THE SERVER: the entitled set is an authorisation output. Deriving
 * it on the client — "my org, plus whatever grants I can read" — would be a second, weaker copy
 * of a decision lib/network-access.ts already makes, and the two would eventually disagree.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { paidApiHeaders } from '@/lib/api-client-auth';
import { isSampleMode } from '@/lib/sample-mode';
import { isBackendConfigured } from '@/lib/firebase/init';
import { DEMO_COHORT_MONTHLY, DEMO_NETWORK } from '@/lib/network-demo';
import { emptyCohortSeries, type CohortSeries } from '@/lib/cohort-series';
import type { NetworkFarmerSummary, NetworkOrgOption } from '@/lib/network';

/* The shape a failed or not-yet-arrived read hands the dashboard. Never the demo series: the same
   rule as the rows — an unknown portfolio must not be dressed as a sample one. */
const NO_SERIES = emptyCohortSeries('The month-by-month totals have not been loaded for this organisation.');

export interface NetworkPortfolio {
  /** Rows for the map/list. Demo rows in sample mode, authorised rows otherwise, [] on error. */
  rows: NetworkFarmerSummary[];
  /**
   * The cohort's month-by-month kilograms and rands, built server-side under the same consent
   * projection as the rows (see app/api/network/farmers/route.ts). Not derivable on the client —
   * `rows` carries totals only — so on any failure this is an empty, unrenderable series rather
   * than a guess.
   */
  monthly: CohortSeries;
  /** Orgs this caller may ask about. Empty in sample mode. */
  orgs: NetworkOrgOption[];
  orgId: string | null;
  setOrgId: (id: string) => void;
  /** True when the rows are invented. The caller MUST label them when this is true. */
  isDemo: boolean;
  loading: boolean;
  /** Set when an authorised read failed. Rows are empty; do not substitute demo data. */
  error: string | null;
  /**
   * Farmers in this org who are enrolled but have consented to nothing, and so are not rows.
   * Surfaced so a short list reads as a consent outcome rather than as a small programme.
   */
  withheldForConsent: number;
  reload: () => void;
}

export function useNetworkPortfolio(signedIn: boolean): NetworkPortfolio {
  const [sample, setSample] = useState<boolean | null>(null);
  useEffect(() => { setSample(isSampleMode()); }, [signedIn]);
  // A signed-in owner exploring sample roles must never read a live portfolio.
  const live = isBackendConfigured() && signedIn && sample === false;

  const [orgs, setOrgs] = useState<NetworkOrgOption[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [rows, setRows] = useState<NetworkFarmerSummary[]>([]);
  const [monthly, setMonthly] = useState<CohortSeries>(NO_SERIES);
  const [withheldForConsent, setWithheld] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  // ── which orgs may this caller see ──
  useEffect(() => {
    if (!live) { setOrgs([]); setOrgId(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch('/api/network/orgs', { headers: await paidApiHeaders() });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) { setError(body.error ?? 'Could not load your portfolio.'); setOrgs([]); return; }
        const list: NetworkOrgOption[] = body.orgs ?? [];
        setOrgs(list);
        // Pick the first org so a single-org NGO never has to choose. A funder or admin with
        // several gets a picker, but still lands on data rather than on an empty prompt.
        setOrgId((cur) => (cur && list.some((o) => o.id === cur) ? cur : list[0]?.id ?? null));
        if (list.length === 0) setError('No organisation is linked to this account yet.');
      } catch {
        if (!cancelled) { setError('Could not reach the portfolio service.'); setOrgs([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [live, nonce]);

  // ── farmers for the chosen org ──
  useEffect(() => {
    if (!live || !orgId) { setRows([]); setWithheld(0); setMonthly(NO_SERIES); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/network/farmers?org_id=${encodeURIComponent(orgId)}`, {
          headers: await paidApiHeaders(),
        });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          // Empty, never demo: see the header. An unknown portfolio must not be dressed as one.
          setError(body.error ?? 'Could not load farmers for this organisation.');
          setRows([]); setWithheld(0); setMonthly(NO_SERIES);
          return;
        }
        setRows(body.farmers ?? []);
        setWithheld(body.withheldForConsent ?? 0);
        // An older deployment of the route has no `monthly`. That is a missing series, not an
        // empty programme, so it stays unrenderable and the card says why instead of drawing zero.
        setMonthly(body.monthly ?? NO_SERIES);
      } catch {
        if (!cancelled) { setError('Could not reach the portfolio service.'); setRows([]); setWithheld(0); setMonthly(NO_SERIES); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [live, orgId, nonce]);

  if (!live) {
    return {
      rows: DEMO_NETWORK.farmers, monthly: DEMO_COHORT_MONTHLY, orgs: [], orgId: null, setOrgId: () => {},
      isDemo: true, loading: false, error: null, withheldForConsent: 0, reload,
    };
  }

  return { rows, monthly, orgs, orgId, setOrgId, isDemo: false, loading, error, withheldForConsent, reload };
}
