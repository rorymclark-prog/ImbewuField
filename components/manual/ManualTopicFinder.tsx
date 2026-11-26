'use client';

import Link from 'next/link';
import { ArrowRight, Play, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ManualLang, ManualUi } from '@/lib/manual';
import { prepareManualSearch, searchManual } from '@/lib/manual-search';
import styles from './ManualTopicFinder.module.css';

const PAGE_SIZE = 6;
const QUERY_LIMIT = 160;
type SearchView = { query: string; visible: number };

function readView(): SearchView {
  const query = new URLSearchParams(window.location.search).get('q') ?? '';
  const saved = window.history.state?.manualFinderVisible;
  return {
    query: query.slice(0, QUERY_LIMIT),
    visible: Number.isSafeInteger(saved) && saved >= PAGE_SIZE ? saved : PAGE_SIZE,
  };
}

function rememberView(view: SearchView, lang: ManualLang) {
  const url = new URL(window.location.href);
  if (url.pathname.replace(/\/$/, '') !== `/manual/${lang}`) return;
  const query = view.query.trim();
  if ((url.searchParams.get('q') ?? '') === query &&
      (window.history.state?.manualFinderVisible ?? PAGE_SIZE) === view.visible) return;
  if (query) url.searchParams.set('q', query);
  else url.searchParams.delete('q');
  window.history.replaceState({ ...window.history.state, manualFinderVisible: view.visible }, '', url);
}

export default function ManualTopicFinder({ lang, ui }: { lang: ManualLang; ui: ManualUi }) {
  const [view, setView] = useState<SearchView>({ query: '', visible: PAGE_SIZE });
  const [sections, setSections] = useState<ReturnType<typeof prepareManualSearch> | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const nextFocus = useRef<number | null>(null);
  const query = view.query.trim();
  const needsIndex = Boolean(query) && sections === null;

  useEffect(() => {
    const restore = () => setView(readView());
    restore();
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => rememberView(view, lang), 250);
    return () => window.clearTimeout(timer);
  }, [view, lang]);

  useEffect(() => {
    if (!needsIndex) return;
    const controller = new AbortController();
    async function loadIndex() {
      setFailed(false);
      try {
        const response = await fetch(`/manual/${lang}/topics.json`, {
          signal: controller.signal,
          referrerPolicy: 'no-referrer',
        });
        if (!response.ok) throw new Error('Index unavailable');
        const index = await response.json();
        if (!Array.isArray(index)) throw new Error('Invalid manual index');
        if (!controller.signal.aborted) setSections(prepareManualSearch(index));
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    }
    void loadIndex();
    return () => controller.abort();
  }, [needsIndex, lang, attempt]);

  const results = useMemo(() => query && sections ? searchManual(sections, query) : [], [query, sections]);

  useEffect(() => {
    const position = nextFocus.current;
    if (position === null) return;
    nextFocus.current = null;
    list.current?.children[position]?.querySelector('a')?.focus();
  }, [view.visible]);

  let status = '';
  if (query) {
    if (failed) status = ui.searchFailed;
    else if (sections === null) status = ui.searching;
    else status = results.length ? ui.resultCount.replace('{n}', String(results.length)) : ui.noMatches;
  }

  return (
    <section id="manual-topic-finder" role="search" aria-labelledby="manual-topic-title" className={styles.finder}>
      <h2 id="manual-topic-title" className="font-display">
        <label htmlFor="manual-topic-input">{ui.findTopic}</label>
      </h2>
      <form className={styles.field} onSubmit={event => {
        event.preventDefault();
        list.current?.querySelector('a')?.focus();
      }}>
        <Search size={19} aria-hidden="true" />
        <input ref={input} id="manual-topic-input" type="search" enterKeyHint="search" autoComplete="off"
          value={view.query} maxLength={QUERY_LIMIT} placeholder={ui.searchHint}
          onChange={event => setView({ query: event.target.value, visible: PAGE_SIZE })} />
        {view.query && <button type="button" className={styles.clear} aria-label={ui.clearSearch} onClick={() => {
          setView({ query: '', visible: PAGE_SIZE });
          input.current?.focus();
        }}><X size={18} aria-hidden="true" /></button>}
      </form>

      <p className={styles.status} role="status" aria-atomic="true">{status}</p>
      {query && failed && <button type="button" className={styles.action} onClick={() => {
        setFailed(false);
        setAttempt(attempt + 1);
      }}>{ui.retrySearch}</button>}
      {results.length > 0 && (
        <ol ref={list} className={styles.results}>
          {results.slice(0, view.visible).map(({ section, excerpt }) => (
            <li key={`${section.slug}/${section.anchor}`}>
              <Link href={`/manual/${lang}/${section.slug}#${section.anchor}`} prefetch={false}
                onClick={() => rememberView(view, lang)} className={styles.result}>
                <span className={styles.context}>
                  {section.kind === 'film' && <><span className={styles.film}><Play size={13} aria-hidden="true" />{ui.film}</span>{' · '}</>}
                  {ui.chapter} {Number.parseInt(section.slug, 10)}
                  {section.title !== section.chapter && <> · <span lang={section.lang}>{section.chapter}</span></>}
                </span>
                <strong lang={section.titleLang ?? section.lang} className="font-display">{section.title}</strong>
                {excerpt && <span lang={section.lang} className={styles.excerpt}>{excerpt}</span>}
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ol>
      )}
      {results.length > view.visible && <button type="button" className={styles.action} onClick={() => {
        nextFocus.current = view.visible;
        setView({ ...view, visible: view.visible + PAGE_SIZE });
      }}>{ui.showMore}</button>}
    </section>
  );
}
