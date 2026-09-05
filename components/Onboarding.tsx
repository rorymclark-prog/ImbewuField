'use client';

import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { APP_LANGS, useLanguage, translate, loadLocale } from '@/lib/i18n';

export default function Onboarding() {
  const router = useRouter();
  const { onboarded, completeOnboarding } = useLanguage();
  const [picked, setPicked] = useState('en');
  // This is the language-pick screen, so prefetching every locale's small chunk here (rather
  // than waiting for a farmer to pick one) is the point — whichever they land on previews
  // correctly right away instead of showing English for a beat while its chunk loads. Bumping
  // loadTick on each arrival re-renders the preview below as translations land, one by one.
  const [, setLoadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    for (const l of APP_LANGS) {
      loadLocale(l.code).then(() => {
        if (!cancelled) setLoadTick((n) => n + 1);
      });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  if (onboarded) return null;
  const tp = (key: string) => translate(picked, key); // preview in the picked language

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(4,10,6,0.92)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md rounded-2xl p-6"
        style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', boxShadow: '0 4px 24px rgba(32,25,15,0.10)' }}>

        {/* Hero */}
        <div className="text-center mb-6">
          <div className="mb-2 flex justify-center">
            <div className="flex items-center justify-center rounded-lg"
              style={{ width: 48, height: 48, background: '#1F4D2B', boxShadow: '0 4px 16px rgba(31,77,43,0.20)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 20s4-6 4-11a5 5 0 0 1 10 0c0 5-4 11-4 11"/>
                <path d="M7 20c-2-2-4-4-4-7a7 7 0 0 1 7-7"/>
              </svg>
            </div>
          </div>
          <div className="font-display font-bold text-xl mb-1" style={{ color: '#20190F' }}>{tp('welcomeTitle')}</div>
          <div className="font-display text-sm" style={{ color: '#5C5040' }}>{tp('welcomeSub')}</div>
        </div>

        {/* LANGUAGE FIRST, BUTTON SECOND — this order is the whole point.
            It used to be the other way round: a big dark-green "Start" over a grid of language
            names styled as a secondary afterthought. A farmer who does not read English taps the
            obvious primary control, and lands in an English app she then has to find her way out
            of — through a switcher that is `hidden md:block` on /farmer, i.e. not on her phone at
            all. The one screen where she is asked to choose must ask before it offers the exit.
            The button below is labelled in the picked language, so it answers as she chooses. */}
        <div className="mb-1 flex items-center gap-2">
          <div className="text-xs font-mono uppercase tracking-wider" style={{ color: '#5C5040' }}>
            {tp('pickLang')}
          </div>
          <div className="flex-1 h-px" style={{ background: '#E2D8C4' }} />
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {APP_LANGS.map((l) => (
            <button key={l.code} onClick={() => setPicked(l.code)}
              className="py-2 px-2 rounded-lg font-display transition-all"
              style={picked === l.code
                ? { fontSize: 15, background: 'rgba(31,77,43,0.10)', border: '1px solid rgba(31,77,43,0.30)', color: '#1F4D2B' }
                : { fontSize: 15, background: '#F0E9D9', border: '1px solid #E2D8C4', color: '#5C5040' }}>
              {l.native}
            </button>
          ))}
        </div>

        {/* Primary action — prominent, immediately actionable */}
        <button onClick={() => completeOnboarding(picked)}
          aria-label={`${tp('start')} — ${tp('welcomeTitle')}`}
          className="w-full py-3 rounded-xl text-base font-display font-semibold transition-all mb-4"
          style={{ background: '#1F4D2B', color: '#fff', boxShadow: '0 4px 16px rgba(31,77,43,0.20)' }}>
          <span className="flex items-center justify-center gap-1.5">{tp('start')}<ArrowRight size={16} /></span>
        </button>

        <button type="button" onClick={() => { completeOnboarding(picked); router.push('/tour'); }}
          style={{display:'block',width:'100%',minHeight:44,fontSize:16,color:'#1F4D2B',marginBottom:16,textDecoration:'underline'}}>
          {picked === 'zu' ? 'Zama isibonelo · imizuzu engu-15' : 'Show me the 15-minute sample tour'}
        </button>
        {/* Reassurance — language is always changeable */}
        <div className="text-xs font-display text-center" style={{ color: '#5C5040', opacity: 0.65 }}>
          {tp('pickLangSub')}
        </div>
      </div>
    </div>
  );
}
