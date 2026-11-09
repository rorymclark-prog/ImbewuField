'use client';

import { useEffect, useRef, useState } from 'react';
import {
  parseDwdMosmixCatalogSearchQuery,
  type DwdMosmixCatalogSearchResult,
} from '@/lib/international/providers/dwd-mosmix-catalog-search';
import type { DwdMosmixCatalogProvenance, DwdMosmixLiveCatalogSearchResult } from '@/lib/international/providers/dwd-mosmix-http';
import type { DwdMosmixCatalogStation } from '@/lib/international/providers/dwd-mosmix-catalog';

type DisplayResult = (DwdMosmixCatalogSearchResult & { readonly provenance?: Readonly<DwdMosmixCatalogProvenance> })
  | DwdMosmixLiveCatalogSearchResult;

export interface DwdStationCatalogSearchProps {
  readonly searchCatalog: (query: string) => Promise<DisplayResult>;
  readonly onSelectStation: (stationId: string) => void;
}

type View =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'result'; readonly result: DisplayResult }
  | { readonly status: 'error' };

type SearchFailure = Extract<DisplayResult, { status: 'failed' }>;
const failureCopy: Record<SearchFailure['reason'], string> = {
  'invalid-query': 'This search accepts ASCII station names and IDs only (up to 64 characters).',
  'invalid-byte-input': 'The station catalogue contained invalid byte data.',
  'invalid-catalog': 'The station catalogue format could not be verified.',
  'unsupported-profile': 'The station catalogue profile is not supported.',
  'unsupported-station-id': 'The station catalogue contained an unsupported station ID format.',
  'ambiguous-catalog': 'The station catalogue contained duplicate station entries.',
  'software-bound': 'The station catalogue or search exceeded software memory boundaries.',
  'invalid-options': 'The catalogue reference check could not start.',
  timeout: 'The catalogue request timed out. No replacement results were supplied.',
  'network-error': 'The catalogue reference could not be reached.',
  'rate-limited': 'DWD limited this request. Try later; there is no automatic retry.',
  'http-error': 'DWD returned an error. No replacement results were supplied.',
  'malformed-response': 'The catalogue response could not be verified.',
  'response-too-large': 'The catalogue was too large for this check.',
};

/**
 * Public reference search component for DWD MOSMIX station catalogue.
 *
 * Why:
 * 1. Mounting this component never triggers a search request.
 * 2. Starts with a blank query input and an explicit "Search catalogue" button.
 * 3. Validates query using parseDwdMosmixCatalogSearchQuery; uncoerced normalized ASCII query is sent.
 * 4. Invalid query displays a helpful explanation that the profile accepts ASCII station names/IDs (max 64 chars).
 * 5. Uses a strictly monotonic prop-owner identity token (ownerIdentity) advanced on prop changes and cleanup/setup.
 * 6. Captures ownerIdentity and both prop callbacks once per render outside all event handlers.
 * 7. On observed prop change, publishes the same fresh idle object to both ref and state to keep new handlers live.
 * 8. Lifecycle cleanup invalidates prior work; effect setup refreshes idle state and sets mounted flag without requests.
 * 9. Confirms result.query matches the exact captured query; wrong-query results are held as static error.
 * 10. Displays returned match count versus totalMatches, catalogStationCount, and catalogWithheldNameCount.
 * 11. Explains that withheld/unknown names were withheld because their source encoding has not been verified.
 * 12. Distinguishes no-matches from failed requests, and clarifies that no-match does not mean no station exists.
 * 13. Clarifies this is name/ID text search only, not nearest station, country match, or farm suitability.
 * 14. Each match row has an explicit "Use station {stationId}" button; user must press it explicitly.
 * 15. Selection calls the captured onSelectStation callback once and performs no forecast fetch or farm attachment.
 */
export default function DwdStationCatalogSearch({
  searchCatalog,
  onSelectStation,
}: DwdStationCatalogSearchProps) {
  const [queryInput, setQueryInput] = useState<string>('');
  const [view, setView] = useState<View>({ status: 'idle' });

  const currentView = useRef(view);
  currentView.current = view;

  const currentQueryInput = useRef(queryInput);
  currentQueryInput.current = queryInput;

  const mounted = useRef(true);
  const pending = useRef(false);
  const generation = useRef(0);
  const ownerIdentity = useRef(1);

  const currentSearchCatalog = useRef(searchCatalog);
  currentSearchCatalog.current = searchCatalog;

  const currentOnSelectStation = useRef(onSelectStation);
  currentOnSelectStation.current = onSelectStation;

  const observedProps = useRef({ searchCatalog, onSelectStation });

  if (
    observedProps.current.searchCatalog !== searchCatalog ||
    observedProps.current.onSelectStation !== onSelectStation
  ) {
    observedProps.current = { searchCatalog, onSelectStation };
    ownerIdentity.current++;
    generation.current++;
    pending.current = false;
    const freshIdle: View = { status: 'idle' };
    currentView.current = freshIdle;
    setView(freshIdle);
  }

  // Capture owner identity and callback references once per render outside all handlers
  const capturedOwner = ownerIdentity.current;
  const capturedSearchCatalog = searchCatalog;
  const capturedOnSelectStation = onSelectStation;

  useEffect(() => {
    mounted.current = true;
    generation.current++;
    pending.current = false;
    const freshIdle: View = { status: 'idle' };
    currentView.current = freshIdle;
    setView(freshIdle);

    return () => {
      mounted.current = false;
      ownerIdentity.current++;
      generation.current++;
      pending.current = false;
    };
  }, []);

  function publish(next: View) {
    currentView.current = next;
    setView(next);
  }

  function handleInputChange(value: string) {
    if (
      !mounted.current ||
      pending.current ||
      capturedOwner !== ownerIdentity.current ||
      currentSearchCatalog.current !== capturedSearchCatalog ||
      currentOnSelectStation.current !== capturedOnSelectStation ||
      currentView.current !== view ||
      currentQueryInput.current !== queryInput
    ) {
      return;
    }
    currentQueryInput.current = value;
    setQueryInput(value);
    generation.current++;
    publish({ status: 'idle' });
  }

  async function handleSearch() {
    if (
      !mounted.current ||
      pending.current ||
      capturedOwner !== ownerIdentity.current ||
      currentSearchCatalog.current !== capturedSearchCatalog ||
      currentOnSelectStation.current !== capturedOnSelectStation ||
      currentView.current !== view ||
      currentQueryInput.current !== queryInput
    ) {
      return;
    }

    const uncoercedQuery = queryInput;
    const sanitizedQuery = parseDwdMosmixCatalogSearchQuery(uncoercedQuery);
    if (sanitizedQuery === null) {
      publish({
        status: 'result',
        result: Object.freeze({
          status: 'failed',
          reason: 'invalid-query',
        }),
      });
      return;
    }

    const turn = ++generation.current;
    pending.current = true;
    publish({ status: 'loading' });

    try {
      const searchResult = await capturedSearchCatalog(sanitizedQuery);
      if (
        mounted.current &&
        capturedOwner === ownerIdentity.current &&
        currentSearchCatalog.current === capturedSearchCatalog &&
        currentOnSelectStation.current === capturedOnSelectStation &&
        generation.current === turn &&
        currentQueryInput.current === uncoercedQuery
      ) {
        if (searchResult.status === 'matches' || searchResult.status === 'no-matches') {
          if (searchResult.query !== sanitizedQuery) {
            publish({ status: 'error' });
            return;
          }
        }
        publish({ status: 'result', result: searchResult });
      }
    } catch {
      if (
        mounted.current &&
        capturedOwner === ownerIdentity.current &&
        currentSearchCatalog.current === capturedSearchCatalog &&
        currentOnSelectStation.current === capturedOnSelectStation &&
        generation.current === turn
      ) {
        publish({ status: 'error' });
      }
    } finally {
      if (capturedOwner === ownerIdentity.current && generation.current === turn) {
        pending.current = false;
      }
    }
  }

  function handleSelect(station: DwdMosmixCatalogStation) {
    if (
      !mounted.current ||
      pending.current ||
      capturedOwner !== ownerIdentity.current ||
      currentOnSelectStation.current !== capturedOnSelectStation ||
      currentSearchCatalog.current !== capturedSearchCatalog ||
      currentView.current !== view ||
      currentQueryInput.current !== queryInput
    ) {
      return;
    }
    capturedOnSelectStation(station.stationId);
  }

  const result = view.status === 'result' ? view.result : null;
  const failure = result?.status === 'failed' ? result : null;
  const matchesResult =
    result && (result.status === 'matches' || result.status === 'no-matches') ? result : null;

  return (
    <section
      lang="en"
      aria-label="DWD station catalogue search"
      className="min-w-0 space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-1)] p-4 [overflow-wrap:anywhere]"
    >
      <h2 className="font-display text-lg font-semibold">Search public station catalogue</h2>
      <p>
        Search official DWD MOSMIX station names and IDs. This is name and ID text search only,
        not nearest station calculation, country suitability, or farm advice. No relationship with
        any reviewed country is inferred.
      </p>

      <div className="space-y-2">
        <label htmlFor="dwd-catalog-search-input" className="block text-sm font-semibold">
          Station name or ID
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="dwd-catalog-search-input"
            type="text"
            value={queryInput}
            disabled={view.status === 'loading'}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Station name or ID (ASCII)"
            className="min-h-11 min-w-[12rem] rounded-lg border border-[var(--border)] bg-[var(--bg-0)] px-3 py-2 text-sm disabled:opacity-50"
          />
          <button
            type="button"
            disabled={view.status === 'loading'}
            onClick={() => void handleSearch()}
            className="min-h-11 max-w-full whitespace-normal rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {view.status === 'loading' ? 'Searching catalogue…' : 'Search catalogue'}
          </button>
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          Accepts up to 64 printable ASCII characters. Edge spaces are trimmed.
        </p>
      </div>

      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-busy={view.status === 'loading'}
        className="space-y-3"
      >
        {view.status === 'idle' && <p>No catalogue search has been requested.</p>}
        {view.status === 'loading' && <p>Searching public station catalogue… No automatic retry.</p>}
        {view.status === 'error' && (
          <p>
            The catalogue search could not be completed. No replacement results were supplied. You
            may search again explicitly.
          </p>
        )}

        {failure && (
          <div className="space-y-2 rounded-xl border border-[var(--border)] p-3 text-sm">
            <p className="font-semibold text-[var(--text-danger)]">
              {failureCopy[failure.reason] ?? 'The catalogue search could not be completed.'}
            </p>
            <p>No automatic retry.</p>
          </div>
        )}

        {matchesResult && (
          <div className="min-w-0 space-y-3">
            <div className="rounded-xl border border-[var(--border)] p-3 text-sm">
              <h3 className="font-semibold">
                {matchesResult.status === 'matches'
                  ? `Found ${matchesResult.totalMatches} ${
                      matchesResult.totalMatches === 1 ? 'matching station' : 'matching stations'
                    }`
                  : 'No matching stations found'}
              </h3>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Query: &ldquo;{matchesResult.query}&rdquo; · Total catalogue stations:{' '}
                {matchesResult.catalogStationCount} · Withheld non-ASCII names:{' '}
                {matchesResult.catalogWithheldNameCount}
              </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Retrieved at (UTC): {matchesResult.provenance?.fetchedAt ?? 'Unknown'}
                </p>
              {matchesResult.status === 'no-matches' && (
                <p className="mt-2 text-xs">
                  A no-match result means no station in the catalogue matched this text query. It
                  does not mean no relevant station exists.
                </p>
              )}
              {matchesResult.catalogWithheldNameCount > 0 && (
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Stations with unverified non-ASCII character encodings have their names listed as
                  &ldquo;Unknown&rdquo; to avoid guessing incorrect letters, but remain selectable by
                  canonical station ID.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <h4 className="font-semibold">Matching Stations</h4>
                <p className="text-xs text-[var(--text-muted)]">
                  Showing {matchesResult.matches.length} of {matchesResult.totalMatches}{' '}
                  {matchesResult.totalMatches === 1 ? 'match' : 'matches'}
                </p>
              </div>

              {matchesResult.matches.length > 0 && (
                <ol className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                  {matchesResult.matches.map((station) => (
                    <li
                      key={station.stationId}
                      className="min-w-0 space-y-2 rounded-xl border border-[var(--border)] p-3 text-sm"
                    >
                      <dl className="space-y-1 text-xs">
                        <div>
                          <dt className="inline font-semibold">Station ID: </dt>
                          <dd className="inline font-mono">{station.stationId}</dd>
                        </div>
                        <div>
                          <dt className="inline font-semibold">Name: </dt>
                          <dd className="inline">{station.name ?? 'Unknown'}</dd>
                        </div>
                      </dl>
                      <div>
                        <button
                          type="button"
                          disabled={view.status === 'loading'}
                          onClick={() => handleSelect(station)}
                          className="min-h-11 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium hover:bg-[var(--bg-2)] disabled:opacity-50"
                        >
                          Use station {station.stationId}
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </div>

      <footer className="border-t border-[var(--border)] pt-3 text-xs text-[var(--text-muted)]">
        <p>
          Source: Deutscher Wetterdienst (DWD), MOSMIX. Selected reference metadata extracted and
          displayed by ImbewuField. This software is not endorsed by DWD.
        </p>
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          <a
            className="inline-flex min-h-11 items-center underline"
            href="https://www.dwd.de/DE/leistungen/met_verfahren_mosmix/mosmix.html"
            target="_blank"
            rel="noreferrer"
          >
            DWD MOSMIX Overview
          </a>
          <a
            className="inline-flex min-h-11 items-center underline"
            href="https://www.dwd.de/copyright"
            target="_blank"
            rel="noreferrer"
          >
            DWD Copyright &amp; Terms
          </a>
          <a
            className="inline-flex min-h-11 items-center underline"
            href="https://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="noreferrer"
          >
            Data licence: CC BY 4.0
          </a>
        </p>
      </footer>
    </section>
  );
}
