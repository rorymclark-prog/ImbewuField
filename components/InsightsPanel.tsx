'use client';

import { useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import type { LocationData } from '@/lib/types';

interface Props { locationData: LocationData | null }

function renderMarkdown(text: string) {
  const sections = text.split(/(?=^## )/m).filter(Boolean);
  if (!sections.length) return <p className="text-xs font-display" style={{ color: '#20190F' }}>{text}</p>;

  return (
    <div className="space-y-5">
      {sections.map((section, i) => {
        const lines = section.split('\n');
        const heading = lines[0].replace(/^## /, '');
        const body = lines.slice(1).join('\n').trim();

        return (
          <div key={i}>
            <h3 className="font-display font-semibold text-sm mb-2 pb-2 flex items-center gap-2"
                style={{ color: '#C07A1E', borderBottom: '1px solid #E2D8C4' }}>
              {heading}
            </h3>
            <div className="space-y-1.5">
              {body.split('\n').map((line, j) => {
                if (!line.trim()) return null;
                if (line.startsWith('- ') || line.startsWith('• ')) {
                  return (
                    <div key={j} className="flex gap-2 text-xs font-display leading-relaxed" style={{ color: '#20190F' }}>
                      <span className="flex-shrink-0 mt-0.5 text-xs" style={{ color: '#1F4D2B' }}>-</span>
                      <span>{line.replace(/^[-•]\s*/, '')}</span>
                    </div>
                  );
                }
                if (line.match(/^\d+\./)) {
                  return (
                    <div key={j} className="flex gap-2 text-xs font-display leading-relaxed" style={{ color: '#20190F' }}>
                      <span className="flex-shrink-0 w-4 text-right" style={{ color: '#C07A1E' }}>{line.match(/^\d+/)?.[0]}.</span>
                      <span>{line.replace(/^\d+\.\s*/, '')}</span>
                    </div>
                  );
                }
                return (
                  <p key={j} className="text-xs font-display leading-relaxed" style={{ color: '#20190F' }}>
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
  const [insights, setInsights] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  async function generate() {
    if (!locationData) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setInsights('');
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locationData),
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setInsights(text);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!locationData) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-center">
        <p className="text-xs font-display" style={{ color: '#5C5040' }}>Select a location first</p>
      </div>
    );
  }

  return (
    <div>
      {/* Generate button */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider mb-0.5" style={{ color: '#5C5040' }}>
            AI Permaculture Report
          </div>
          {!insights && !loading && (
            <div className="text-xs font-display" style={{ color: '#5C5040' }}>
              Water · Soil · Guilds · Calendar · Quick wins
            </div>
          )}
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="px-4 py-2 rounded-xl text-xs font-display font-semibold transition-all duration-200 flex items-center gap-1.5"
          style={
            loading
              ? { background: 'rgba(226,216,196,0.70)', color: '#5C5040', cursor: 'wait', border: '1px solid #E2D8C4' }
              : {
                  background: 'rgba(31,77,43,0.14)',
                  border: '1px solid rgba(31,77,43,0.28)',
                  color: '#2D6B3C',
                  boxShadow: '0 0 16px rgba(31,77,43,0.10)',
                }
          }
        >
          {loading ? (
            <><Loader2 size={14} className="animate-spin" /> Analysing…</>
          ) : insights ? (
            <>↺ Regenerate</>
          ) : (
            <>Analyse site</>
          )}
        </button>
      </div>

      {error && (
        <div
          className="text-xs font-mono px-3 py-2 rounded-lg mb-3"
          style={{ background: 'rgba(212,110,66,0.1)', border: '1px solid rgba(212,110,66,0.3)', color: '#D4922A' }}
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
          <p className="text-xs font-display" style={{ color: '#5C5040' }}>
            Uses your exact slope, rainfall timing, soil pH + OC, and biome to generate a specific site report
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
