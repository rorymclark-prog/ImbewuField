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

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { CONSENT_PANEL_HEADING, CONSENT_SCOPES, grantedScopes, hasConsent, type ConsentScope, type FarmerConsent } from '@/lib/consent';
import { getMyConsent, revokeAllMyConsent, setMyConsentScope } from '@/lib/db/queries';
import { accountText,fillAccountText,isAccountDraftLanguage,type AccountValues } from '@/lib/account-copy';
import { useLanguage } from '@/lib/i18n';

export default function ConsentPanel({ orgName }: { orgName?: string | null }) {
  const { lang,t } = useLanguage();
  const draft=isAccountDraftLanguage(lang);
  const text=(english:string,zulu:string,values:AccountValues={})=>accountText(lang,english,zulu,t,values);
  const paired=(english:string,zulu:string,values:AccountValues={},sourceValues=values)=><><span lang={draft?lang:'en'}>{text(english,zulu,values)}</span>{draft&&<small lang="en" style={{display:'block',fontSize:12,lineHeight:1.4}}><span lang={lang}>{t('popiaEnglishSourceLabel')}: </span>{fillAccountText(english,sourceValues)}</small>}</>;
  const [consent, setConsent] = useState<FarmerConsent | null>(null);
  const [loading, setLoading] = useState(true);
  // bug-06: a failed read used to leave `consent` null and just stop the spinner — every toggle
  // then rendered unchecked (hasConsent(null, id) is false), which reads as "sharing nothing"
  // whether or not that's true. loadError says the read itself failed, with a way to retry it,
  // instead of a farmer seeing confident-looking OFF switches that were never actually read.
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState<ConsentScope | 'all' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    return getMyConsent()
      .then((c) => { setConsent(c); setLoading(false); })
      .catch(() => { setLoadError(true); setLoading(false); });
  }, []);

  useEffect(() => { void load(); }, [load]);

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
  const whoZu = orgName ? `i-${orgName}` : 'inhlangano eqhuba uhlelo lwakho';

  const organisation=lang==='zu'?whoZu:orgName??text('the organisation running your programme','inhlangano eqhuba uhlelo lwakho');
  return (
    <div lang={lang} className="rounded-2xl px-4 py-4" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2">
        <ShieldCheck size={16} style={{ color: 'var(--text-secondary)' }} aria-hidden />
        <div className="text-xs font-sans uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {paired(CONSENT_PANEL_HEADING.label,CONSENT_PANEL_HEADING.labelZuDraft)}
        </div>
      </div>
      {draft&&<p role="note" lang={lang} className="text-xs mt-2">{t('popiaConsentDraftNotice')}</p>}
      <p className="text-sm font-display mt-3 leading-snug" style={{ color: 'var(--text-secondary)' }}>
        {paired('Nothing here is shared unless you switch it on. You can change your mind at any time, and {organisation} will stop seeing it straight away.','Akukho lutho olwabiwayo lapha ngaphandle kokuthi uyivule. Ungashintsha umqondo wakho noma nini, futhi {organisation} izoyeka ukukubona ngokushesha.',{organisation},{organisation:who})}
      </p>
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm font-display" style={{ color: 'var(--text-muted)' }}>
          <Loader2 size={14} className="animate-spin" aria-hidden /> <span>{paired('Loading…','Kusalayishwa…')}</span>
        </div>
      ) : loadError ? (
        <div role="alert" className="mt-3 rounded-lg px-3 py-3 text-sm font-display flex flex-col items-start md:flex-row md:items-center justify-between gap-3" style={{ background: '#F6E7E1', color: '#8A3B1C' }}>
          <span className="min-w-0 flex-1">{paired("Couldn't load your sharing settings. Check your connection and try again.",'Izilungiselelo zokwabelana azikwazi ukulayishwa. Hlola uxhumano lwakho bese uzama futhi.')}</span>
          <button type="button" onClick={() => void load()} aria-label={text('Retry','Zama futhi')}
            className="flex-shrink-0 font-display font-semibold text-xs"
            style={{minHeight:44,maxWidth:'100%',color:'#8A3B1C',background:'transparent',border:'none',cursor:'pointer',textDecoration:'underline'}}>
            {paired('Retry','Zama futhi')}
          </button>
        </div>
      ) : (
        <>
          <div className="mt-3">
            {CONSENT_SCOPES.map(({ id, label, detail, labelZuDraft, detailZuDraft }) => {
              const checked = hasConsent(consent, id);
              return (
                <label key={id} className="flex items-start gap-3 py-3 cursor-pointer" style={{ borderTop:'1px solid var(--border)' }}>
                  <input type="checkbox" className="mt-0.5 h-4 w-4 flex-shrink-0" checked={checked} disabled={busy !== null}
                    onChange={(e) => toggle(id,e.target.checked)} aria-label={text(label,labelZuDraft)} aria-describedby={`consent-detail-${id}`} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-display" style={{color:'var(--text-primary)'}}>{paired(label,labelZuDraft)}</span>
                    <span id={`consent-detail-${id}`} className="block text-xs font-display mt-0.5" style={{color:'var(--text-muted)'}}>{paired(detail,detailZuDraft)}</span>
                  </span>
                  {busy === id && <Loader2 size={14} className="animate-spin mt-0.5" style={{color:'var(--text-muted)'}} aria-hidden />}
                </label>
              );
            })}
          </div>
          {error && <div role="alert" className="mt-3 rounded-lg px-3 py-2 text-xs font-display" style={{background:'#F6E7E1',color:'#8A3B1C'}}>
            {paired(error,'Lokho akugcinwanga. Izilungiselelo zakho zokwabelana azishintshanga.')}
          </div>}
          <div className="flex flex-col items-start gap-2 mt-4 pt-3" style={{borderTop:'1px solid var(--border)'}}>
            <span className="text-xs font-display" style={{color:'var(--text-muted)'}}>
              {on===0?paired('You are not sharing anything.','Awabelani ngalutho.'):paired('You are sharing {count} of {total} things.','Wabelana ngezinto ezingu-{count} kwezingu-{total}.',{count:String(on),total:String(CONSENT_SCOPES.length)})}
            </span>
            <button type="button" onClick={stopAll} disabled={busy !== null || on === 0} aria-label={text('Stop sharing everything','Yeka ukwabelana ngakho konke')}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display disabled:opacity-40" style={{minHeight:44,background:'#F6E7E1',color:'#8A3B1C',border:'1px solid #E4C9BC'}}>
              {busy==='all'&&<Loader2 size={12} className="animate-spin" aria-hidden />}
              <span>{paired('Stop sharing everything','Yeka ukwabelana ngakho konke')}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
