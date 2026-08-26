'use client';

/*
 * The farmer's own control over what an NGO or funder can see about them.
 *
 * This screen is the reason lib/consent.ts and the /farmer_consents rules exist. Everything
 * else in that chain is enforcement; this is where a person actually decides. Three choices
 * are deliberate:
 *
 *  • EVERYTHING STARTS OFF. There is no "share all" default and no pre-ticked box. A farmer
 *    who never opens this screen shares nothing, which is the outcome consent law expects
 *    from silence.
 *  • EACH ROW SAYS WHAT IS ACTUALLY SEEN, not a reassurance. "Your crop sales and the money
 *    you earned from them" — not "help us improve the programme".
 *  • STOPPING IS ONE BUTTON. Revocation must never be a checklist a person can half-finish,
 *    so "Stop sharing everything" is a single labelled control on this same screen rather
 *    than six toggles to find and flip.
 */

import { useEffect, useState } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { CONSENT_SCOPES, grantedScopes, hasConsent, type ConsentScope, type FarmerConsent } from '@/lib/consent';
import { getMyConsent, revokeAllMyConsent, setMyConsentScope } from '@/lib/db/queries';

export default function ConsentPanel({ orgName }: { orgName?: string | null }) {
  const [consent, setConsent] = useState<FarmerConsent | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<ConsentScope | 'all' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { getMyConsent().then((c) => { setConsent(c); setLoading(false); }).catch(() => setLoading(false)); }, []);

  async function toggle(scope: ConsentScope, next: boolean) {
    setBusy(scope); setError(null);
    try {
      setConsent(await setMyConsentScope(scope, next));
    } catch {
      // Never leave a toggle showing a state that was not saved — on this screen specifically,
      // a switch that looks on but never wrote is a person believing they shared nothing.
      setError('That did not save. Your sharing settings have not changed.');
      setConsent(await getMyConsent().catch(() => consent));
    } finally { setBusy(null); }
  }

  async function stopAll() {
    setBusy('all'); setError(null);
    try { setConsent(await revokeAllMyConsent()); }
    catch { setError('That did not save. Your sharing settings have not changed.'); }
    finally { setBusy(null); }
  }

  const on = grantedScopes(consent).length;
  const who = orgName ? `${orgName}` : 'the organisation running your programme';

  return (
    <div className="rounded-2xl px-4 py-4" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
      <div className="flex items-center gap-2">
        <ShieldCheck size={16} style={{ color: '#5C5040' }} />
        <div className="text-xs font-mono uppercase tracking-wider" style={{ color: '#8C7A62' }}>
          What you share
        </div>
      </div>

      <p className="text-sm font-display mt-2 leading-snug" style={{ color: '#5C5040' }}>
        Nothing here is shared unless you switch it on. You can change your mind at any time,
        and {who} will stop seeing it straight away.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm font-display" style={{ color: '#8C7A62' }}>
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <div className="mt-3">
            {CONSENT_SCOPES.map(({ id, label, detail }) => {
              const checked = hasConsent(consent, id);
              return (
                <label
                  key={id}
                  className="flex items-start gap-3 py-3 cursor-pointer"
                  style={{ borderTop: '1px solid #E2D8C4' }}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 flex-shrink-0"
                    checked={checked}
                    disabled={busy !== null}
                    onChange={(e) => toggle(id, e.target.checked)}
                    aria-describedby={`consent-detail-${id}`}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-display" style={{ color: '#20190F' }}>{label}</span>
                    <span id={`consent-detail-${id}`} className="block text-xs font-display mt-0.5" style={{ color: '#8C7A62' }}>
                      {detail}
                    </span>
                  </span>
                  {busy === id && <Loader2 size={14} className="animate-spin mt-0.5" style={{ color: '#8C7A62' }} />}
                </label>
              );
            })}
          </div>

          {error && (
            <div className="mt-3 rounded-lg px-3 py-2 text-xs font-display" style={{ background: '#F6E7E1', color: '#8A3B1C' }}>
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 mt-4 pt-3" style={{ borderTop: '1px solid #E2D8C4' }}>
            <span className="text-xs font-display flex-1" style={{ color: '#8C7A62' }}>
              {on === 0 ? 'You are not sharing anything.' : `You are sharing ${on} of ${CONSENT_SCOPES.length} things.`}
            </span>
            <button
              type="button"
              onClick={stopAll}
              disabled={busy !== null || on === 0}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display disabled:opacity-40"
              style={{ background: '#F6E7E1', color: '#8A3B1C', border: '1px solid #E4C9BC' }}
            >
              {busy === 'all' && <Loader2 size={12} className="animate-spin" />}
              Stop sharing everything
            </button>
          </div>
        </>
      )}
    </div>
  );
}
