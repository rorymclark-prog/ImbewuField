'use client';

import { useState, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import type { LocationData } from '@/lib/types';
import { useLanguage } from '@/lib/i18n';
import { paidApiHeaders } from '@/lib/api-client-auth';
import { useLocalAdviceContext } from '@/lib/use-local-advice-context';
import { requestLocalAdvice, localAdviceHoldMessage, localAdviceUnavailableMessage, LOCAL_ADVICE_SITE_HOLD, LOCAL_ADVICE_BASIS } from '@/lib/local-advice-client';

interface Props { locationData: LocationData | null }

function renderMarkdown(text: string) {
  const sections = text.split(/(?=^## )/m).filter(Boolean);
  if (!sections.length) return <p className="text-xs font-display" style={{ color: 'var(--text-primary)' }}>{text}</p>;

  return (
    <div className="space-y-5">
      {sections.map((section, i) => {
        const lines = section.split('\n');
        const heading = lines[0].replace(/^## /, '');
        const body = lines.slice(1).join('\n').trim();

        return (
          <div key={i}>
            <h3 className="font-display font-semibold text-sm mb-2 pb-2 flex items-center gap-2"
                style={{ color: 'var(--gold)', borderBottom: '1px solid var(--border)' }}>
              {heading}
            </h3>
            <div className="space-y-1.5">
              {body.split('\n').map((line, j) => {
                if (!line.trim()) return null;
                if (line.startsWith('- ') || line.startsWith('• ')) {
                  return (
                    <div key={j} className="flex gap-2 text-xs font-display leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                      <span className="flex-shrink-0 mt-0.5 text-xs" style={{ color: 'var(--color-forest-800)' }}>-</span>
                      <span>{line.replace(/^[-•]\s*/, '')}</span>
                    </div>
                  );
                }
                if (line.match(/^\d+\./)) {
                  return (
                    <div key={j} className="flex gap-2 text-xs font-display leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                      <span className="flex-shrink-0 w-4 text-right" style={{ color: 'var(--gold)' }}>{line.match(/^\d+/)?.[0]}.</span>
                      <span>{line.replace(/^\d+\.\s*/, '')}</span>
                    </div>
                  );
                }
                return (
                  <p key={j} className="text-xs font-display leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                    {line.replace(/\*\*/g, '')}
                  </p>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function InsightsPanel({ locationData }: Props) {
  const { t } = useLanguage();
  const [storedInsights, setInsights] = useState('');
  const [resultKey, setResultKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const context = useLocalAdviceContext(locationData, locationData);
  const contextKey = context.snapshot?.key ?? null;
  const contextRef = useRef(context); contextRef.current = context;
  const version = useRef(0);
  const insights = resultKey === contextKey ? storedInsights : '';
  useEffect(() => {
    ++version.current; abortRef.current?.abort();
    setInsights(''); setError(''); setLoading(false);
    return () => { ++version.current; abortRef.current?.abort(); };
  }, [contextKey]);

  async function generate() {
    const snapshot = contextRef.current.snapshot;
    if (!locationData || !snapshot) { setError(LOCAL_ADVICE_SITE_HOLD); return; }
    const captured = ++version.current;
    const current = () => captured === version.current && contextRef.current.isCurrent(snapshot);
    abortRef.current?.abort();
    const controller = new AbortController(); abortRef.current = controller;
    setInsights(''); setError(''); setResultKey(snapshot.key); setLoading(true);
    const result = await requestLocalAdvice({ snapshot, isCurrent: current, signal: controller.signal,
      headers: paidApiHeaders, fetcher: init => fetch('/api/ai-insights', init), body: { locationData } });
    if (!current()) return;
    if (result.status === 'ready') setInsights(result.text);
    else if (result.status === 'held') setError(localAdviceHoldMessage(result));
    else if (result.status === 'unavailable') setError(localAdviceUnavailableMessage(result));
    else if (result.status === 'error') setError(t('insightsGenerateError'));
    setLoading(false);
  }

  if (!locationData) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-center">
        <p className="text-xs font-display" style={{ color: 'var(--text-secondary)' }}>{t('insightsSelectLocation')}</p>
      </div>
    );
  }

  return (
    <div>
      <p lang="en" className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
        {context.snapshot ? LOCAL_ADVICE_BASIS : LOCAL_ADVICE_SITE_HOLD}
      </p>
      {/* Generate button */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-secondary)' }}>
            {t('insightsReportTitle')}
          </div>
          {!insights && !loading && (
            <div className="text-xs font-display" style={{ color: 'var(--text-secondary)' }}>
              {t('insightsReportSubtitle')}
            </div>
          )}
        </div>
        <button
          onClick={generate}
          disabled={loading || !context.snapshot}
          className="px-4 py-2 rounded-xl text-xs font-display font-semibold transition-all duration-200 flex items-center gap-1.5"
          style={
            loading
              ? { background: 'rgba(226,216,196,0.70)', color: 'var(--text-secondary)', cursor: 'wait', border: '1px solid var(--border)' }
              : {
                  background: 'rgba(31,77,43,0.14)',
                  border: '1px solid rgba(31,77,43,0.28)',
                  color: 'var(--color-forest-700)',
                  boxShadow: '0 0 16px rgba(31,77,43,0.10)',
                }
          }
        >
          {loading ? (
            <><Loader2 size={14} className="animate-spin" /> {t('insightsAnalysing')}</>
          ) : insights ? (
            <>↺ {t('buttonRegenerate')}</>
          ) : (
            <>{t('insightsAnalyseSite')}</>
          )}
        </button>
      </div>

      {error && (
        <div
          className="text-xs px-3 py-2 rounded-lg mb-3"
          style={{ background: 'rgba(212,110,66,0.1)', border: '1px solid rgba(212,110,66,0.3)', color: 'var(--gold)' }}
        >
          {error}
        </div>
      )}

      {/* Empty prompt */}
      {!insights && !loading && (
        <div
          className="rounded-xl p-5 text-center"
          style={{ background: 'rgba(31,77,43,0.04)', border: '1px dashed rgba(31,77,43,0.20)' }}
        >
          <p className="text-xs font-display" style={{ color: 'var(--text-secondary)' }}>
            {t('insightsEmptyPrompt')}
          </p>
        </div>
      )}

      {/* Loading shimmer */}
      {loading && !insights && (
        <div className="space-y-2.5 animate-pulse">
          {[70, 100, 85, 60, 95, 75, 50].map((w, i) => (
            <div key={i} className="h-3 rounded" style={{ width: `${w}%`, background: 'rgba(226,216,196,0.70)', animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      )}

      {/* Insights output */}
      {insights && (
        <div>
          {renderMarkdown(insights)}
          {loading && (
            <span className="inline-block w-1.5 h-3.5 rounded-sm animate-pulse ml-0.5" style={{ background: '#2D6B3C' }} />
          )}
        </div>
      )}
    </div>
  );
}
