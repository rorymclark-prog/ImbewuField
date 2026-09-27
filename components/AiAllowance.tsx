'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { paidApiHeaders } from '@/lib/api-client-auth';
import type { AiAllowance as Allowance } from '@/lib/ai-budget';

/** "AI this month" — how much of the monthly allowance is left, and when it refills. */
export default function AiAllowance({ copy }: { copy: (en: string, zu: string) => string }) {
  const [a, setA] = useState<Allowance | null>(null);
  useEffect(() => {
    let live = true;
    paidApiHeaders()
      .then((headers) => fetch('/api/ai-allowance', { headers }))
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => { if (live && body && typeof body.capEur === 'number') setA(body); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  if (!a || a.kind !== 'user') return null;
  const used = a.capEur > 0 ? Math.min(1, a.spentEur / a.capEur) : 1;
  const resets = new Date(`${a.resetsOn}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
  return (
    <div className="rounded-2xl px-4 py-4 space-y-2" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 text-sm font-display" style={{ color: 'var(--text-primary)' }}>
        <Sparkles size={14} style={{ color: 'var(--text-muted)' }} aria-hidden />
        {copy('AI this month', 'I-AI kule nyanga')}
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-2)' }}
        role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(used * 100)}
        aria-label={copy('AI allowance used', 'Isabelo se-AI esisetshenzisiwe')}>
        <div className="h-full rounded-full" style={{ width: `${used * 100}%`, background: a.capped ? 'var(--gold)' : 'var(--emerald)' }} />
      </div>
      <p className="text-xs font-sans" style={{ color: 'var(--text-secondary)' }}>
        {a.capped
          ? copy(`This month's full AI allowance is used. AI still works, on a simpler model, until ${resets}.`,
                 `Isabelo se-AI sale nyanga sesiphelile. I-AI isasebenza, ngohlobo olulula, kuze kube ngu-${resets}.`)
          : copy(`€${a.remainingEur.toFixed(2)} of €${a.capEur.toFixed(2)} left. Refills on ${resets}.`,
                 `Kusele u-€${a.remainingEur.toFixed(2)} ku-€${a.capEur.toFixed(2)}. Kugcwaliswa ngo-${resets}.`)}
      </p>
    </div>
  );
}
