'use client';

import workspace from '@/components/layout/Workspace.module.css';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Send, Flag, MoreHorizontal } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { translate,useLanguage } from '@/lib/i18n';
import LanguageDraftNote from '@/components/LanguageDraftNote';
import { communityTimeAgo } from '@/lib/community-time';
import { useAppLevel } from '@/lib/app-level';
import { communityEnabled } from '@/lib/community/flag';
import { getThread, subscribeMessages, sendMessage, reportContent } from '@/lib/db/community-queries';
import type { MessageThread, ThreadMessage } from '@/lib/db/types';
import LessonLink from '@/components/design/LessonLink';
import AppHeader from '@/components/layout/AppHeader';

export default function MessageThreadPage() {
  const { user, loading } = useAuth();
  const { t, lang } = useLanguage();
  const draft=['zu','st','ts','ve'].includes(lang);
  const paired=(key:string)=><><span lang={t(key)===translate('en',key)?'en':lang}>{t(key)}</span>{draft&&<small lang="en" style={{display:'block',fontSize:12,lineHeight:1.4,marginTop:4}}><span lang={lang}>{t('offlineSourceLabel')}: </span>{translate('en',key)}</small>}</>;
  const router = useRouter();
  const params = useParams<{ threadId: string }>();
  const threadId = params.threadId;
  const simple = useAppLevel() === 'simple';

  const [thread, setThread] = useState<MessageThread | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  // bug-14: subscribeMessages used to have no error callback at all, so a denied or dropped
  // listener left this screen showing an empty thread forever with nothing to say why and
  // nothing to retry. listenRetryKey, bumped by the retry button below, forces the effect to
  // tear down and resubscribe.
  const [listenError, setListenError] = useState(false);
  const [listenRetryKey, setListenRetryKey] = useState(0);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [busy, setBusy] = useState(true);
  const [loadError,setLoadError]=useState(false);
  const [loadAttempt,setLoadAttempt]=useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSent, setReportSent] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const reportRef=useRef<HTMLDivElement>(null);
  const scopeRef=useRef('');
  const scopeKey=`${user?.uid??''}:${threadId}`;
  scopeRef.current=scopeKey;

  useEffect(() => {
    if (!communityEnabled()) { router.replace('/home'); return; }
    if (!loading && !user) { router.replace('/login'); return; }
  }, [user, loading, router]);

  useEffect(()=>{
    // A draft, listener or late reply belongs to this conversation and this signed-in owner.
    setBody('');setMessages([]);setMoreOpen(false);setReportOpen(false);setReportReason('');
    setReportSent(false);setReportError(false);setSendError(false);setSending(false);setReportBusy(false);
  },[threadId,user?.uid]);

  useEffect(()=>{
    if(!user||!threadId||!communityEnabled())return;
    let active=true;
    setBusy(true);setLoadError(false);setThread(null);
    getThread(threadId).then(th=>{if(active){setThread(th);setBusy(false);}}).catch(()=>{if(active){setLoadError(true);setBusy(false);}});
    return()=>{active=false;};
  },[user,threadId,loadAttempt]);

  useEffect(() => {
    if (!user || !threadId || !communityEnabled()) return;
    let active=true;
    setListenError(false);
    const unsub = subscribeMessages(threadId, values=>{if(active)setMessages(values);}, () => {if(active)setListenError(true);});
    return () => {active=false;unsub?.();};
  }, [user, threadId, listenRetryKey]);

  useEffect(()=>{if(!reportOpen||sendError)bottomRef.current?.scrollIntoView({block:'end'});},[messages.length,sendError,listenError,reportOpen,busy]);
  useEffect(()=>{if(reportOpen)reportRef.current?.scrollIntoView({block:'start'});},[reportOpen,busy]);

  // A weak-signal Firestore write can reject (offline, timeout, denied). Before
  // this caught the failure, the text was already cleared from the box on
  // line below, sendMessage() threw, and the farmer's typed message simply
  // vanished — no error, nothing sent, nothing left to retry from. Now a
  // failure hands the text back to the box and says so, instead of eating it.
  const handleSend = useCallback(async () => {
    if (!thread || !body.trim() || sending) return;
    const operationScope=scopeRef.current;
    setSending(true);
    setSendError(false);
    const text = body.trim();
    setBody('');
    try {
      await sendMessage(threadId, text);
    } catch (err) {
      console.error('sendMessage failed', err);
      if(scopeRef.current===operationScope){setBody(text);setSendError(true);}
    } finally {
      if(scopeRef.current===operationScope)setSending(false);
    }
  }, [body, sending, threadId,thread]);

  // Same silent-failure shape as handleSend: an uncaught rejection here left a
  // farmer who reported abuse with a form that just sits there — no "sent",
  // no error, no way to tell whether it went anywhere.
  async function handleReport() {
    if (!reportReason.trim() || !thread || reportBusy) return;
    const operationScope=scopeRef.current;
    setReportBusy(true);
    setReportError(false);
    const otherUid = thread.participants.find((p) => p !== user?.uid) ?? '';
    try {
      await reportContent('message', threadId, otherUid, reportReason.trim());
      if(scopeRef.current!==operationScope)return;
      setReportSent(true);
      setReportReason('');
      setTimeout(() => {if(scopeRef.current===operationScope){setReportSent(false);setReportOpen(false);}}, 2000);
    } catch (err) {
      console.error('reportContent failed', err);
      if(scopeRef.current===operationScope)setReportError(true);
    } finally {
      if(scopeRef.current===operationScope)setReportBusy(false);
    }
  }

  const notice=<div className="px-4 pt-3"><LanguageDraftNote lang={lang} scope="community-thread"/></div>;
  const header=<AppHeader backFallback="/community" title={t('communityTabMessages')} right={<LessonLink id="community:messages" label={t('homeLearnAction')}/>}/>;
  if(busy||loading||!communityEnabled()||!user){
    return <div lang={lang} className="h-[100dvh] flex flex-col" style={{background:'var(--bg-0)',color:'var(--text-primary)'}}>{header}{notice}<main className="flex-1 flex flex-col items-center justify-center gap-3 px-6"><h1 className="font-display font-bold" style={{fontSize:20}}>{t('communityTabMessages')}</h1><div role="status" aria-label={t('communityMessagesLoading')}><Loader2 size={24} className="animate-spin" aria-hidden/><p>{t('communityMessagesLoading')}</p></div></main></div>;
  }
  if(loadError||!thread){
    return <div lang={lang} className="h-[100dvh] flex flex-col" style={{background:'var(--bg-0)',color:'var(--text-primary)'}}>{header}{notice}<main className={`${workspace.workspace} ${workspace.readingWidth} flex-1 px-4 py-5 text-center`}><h1 className="font-display font-bold" style={{fontSize:20}}>{t('communityTabMessages')}</h1><p role={loadError?'alert':undefined}>{paired(loadError?'communityThreadLoadError':'communityThreadUnavailable')}</p>{loadError&&<button type="button" onClick={()=>setLoadAttempt(n=>n+1)} className="rounded-xl px-4 py-2 font-semibold" style={{minHeight:44,background:'var(--brand)',color:'var(--on-forest)'}}>{t('communityRetry')}</button>}</main></div>;
  }

  const otherUid = thread.participants.find((p) => p !== user.uid) ?? '';
  const ownedOtherName=thread.participant_names?.[otherUid];
  const otherName=ownedOtherName??t('communityFarmer');

  return (
    <div lang={lang} className="h-[100dvh] flex flex-col font-sans" style={{ background: 'var(--bg-0)', color: 'var(--text-primary)' }}>
      {/* The person you are talking to IS this page's subject, but in the header they are a link
          back to the profile, not a heading. Name the page for screen readers separately. */}
      <h1 lang={ownedOtherName===undefined?lang:''} className="sr-only">{otherName}</h1>
      <AppHeader
        title={t('communityTabMessages')}
        right={
          <>
            <LessonLink id="community:messages" label={t('homeLearnAction')} />
            <Link lang={ownedOtherName===undefined?lang:''} href={`/community/u/${otherUid}`} className="font-display font-semibold" style={{ fontSize: 14, color: 'var(--text-primary)', textDecoration: 'none' }}>
              {otherName}
            </Link>
            {simple ? (
              <button
                onClick={() => setMoreOpen((s) => !s)}
                aria-label={t('communityMoreLabel')}
                aria-expanded={moreOpen} aria-controls="community-thread-more"
                style={{ marginLeft: 8, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
              >
                <MoreHorizontal size={18} />
              </button>
            ) : (
              <button
                onClick={() => setReportOpen((s) => !s)}
                aria-label={t('communityReportButton')} aria-expanded={reportOpen} aria-controls="community-thread-report"
                style={{ marginLeft: 8, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
              >
                <Flag size={16} />
              </button>
            )}
          </>
        }
      />
      {notice}

      {/* Source-paired errors exceeded a short phone viewport; the composer stays reachable while the whole conversation scrolls. */}
      <main className={`${workspace.workspace} ${workspace.readingWidth} flex-1 min-h-0 overflow-y-auto`}>
      {/* Simple keeps the report/block flow out of the header but never out of reach — tapping
          More reveals it, the same safety-critical action All tools shows directly. */}
      {simple && moreOpen && (
        <div id="community-thread-more" className="flex justify-end" style={{ padding: '10px 16px 0' }}>
          <button
            onClick={() => { setReportOpen((s) => !s); setMoreOpen(false); }}
            className="flex items-center gap-1.5 font-sans font-semibold"
            style={{ fontSize: 12.5, color: 'var(--text-primary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            <Flag size={13} /> {t('communityReportButton')}
          </button>
        </div>
      )}

      {reportOpen && (
        <div id="community-thread-report" ref={reportRef} className="rounded-2xl p-4" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', margin: '12px 16px 0' }}>
          <label htmlFor="community-thread-reason" className="block font-sans font-semibold mb-2" style={{fontSize:13}}>{paired('communityReportReasonPlaceholder')}</label>
          <textarea
            id="community-thread-reason" lang="" readOnly={reportBusy}
            value={reportReason}
            onChange={(e) => {if(!reportBusy)setReportReason(e.target.value.slice(0,300));}}
            placeholder={t('communityReportReasonPlaceholder')}
            rows={2}
            className="w-full rounded-xl px-3 py-2.5 font-sans focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
            style={{ fontSize: 13.5, background: 'var(--bg-1)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)', outline: 'none', resize: 'none', marginBottom: 8 }}
          />
          <button
            onClick={handleReport}
            disabled={!reportReason.trim() || reportBusy} aria-busy={reportBusy}
            className="font-sans font-semibold rounded-xl"
            style={{ minHeight:44, padding: '8px 14px', fontSize: 12.5, background: reportReason.trim() ? 'var(--danger)' : 'rgba(32,25,15,0.1)', color: reportReason.trim() ? '#fff' : 'var(--text-muted)', border: 'none', cursor: reportReason.trim() && !reportBusy ? 'pointer' : 'default' }}
          >
            <span role={reportSent?'status':undefined}>{reportSent ? t('communityReportSent') : t('communityReportSubmit')}</span>
          </button>
          {reportError && (
            <p role="alert" className="font-sans" style={{ fontSize: 12, color: 'var(--text-primary)', margin: '8px 0 0' }}>
              {paired('communityReportError')}
            </p>
          )}
        </div>
      )}


      <div className="flex flex-col gap-2 px-4 py-4 sm:px-6">
        {messages.map((m) => {
          const mine = m.sender_id === user.uid;
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: 'min(75%, 40rem)', overflowWrap: 'anywhere' }}>
                <div
                  lang="" className="font-sans"
                  style={{
                    fontSize: 14, lineHeight: 1.5, padding: '9px 13px', borderRadius: 16,
                    background: mine ? 'var(--color-forest-800)' : 'var(--bg-1)',
                    color: mine ? 'var(--on-forest-800)' : 'var(--text-primary)',
                    border: mine ? 'none' : '1px solid var(--border)',
                    borderBottomRightRadius: mine ? 4 : 16,
                    borderBottomLeftRadius: mine ? 16 : 4,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {m.body}
                </div>
                {!simple && (
                  <div className="font-sans" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, textAlign: mine ? 'right' : 'left' }}>
                    {communityTimeAgo(m.created_at,lang,t,true)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {listenError && (
        <div
          role="alert" className={`${workspace.workspace} ${workspace.readingWidth} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-shrink-0`}
          style={{ width:'calc(100% - 32px)', margin: '10px auto 0', padding: '8px 12px', borderRadius: 12, background: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.25)' }}
        >
          <span className="font-sans" style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>
            {paired('communityMessagesListenError')}
          </span>
          <button
            type="button"
            onClick={() => setListenRetryKey((k) => k + 1)}
            className="font-sans font-semibold flex-shrink-0"
            style={{minHeight:44,padding:'6px 12px',fontSize:12,color:'var(--text-primary)',background:'var(--bg-1)',border:'1px solid var(--border-strong)',borderRadius:10,cursor:'pointer',textDecoration:'underline'}}
          >
            {t('communityRetry')}
          </button>
        </div>
      )}


      {sendError && (
        <p role="alert" className="font-sans" style={{ fontSize: 12, color: 'var(--text-primary)', margin: '0 16px 6px', textAlign: 'center' }}>
          {paired('communitySendError')}
        </p>
      )}
        <div ref={bottomRef}/>
      </main>
      <div className={`${workspace.workspace} ${workspace.readingWidth} flex-shrink-0 flex items-center gap-2 px-3 py-3 sm:px-6`} style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-1)', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
        <input
          type="text"
          value={body} lang="" readOnly={sending} aria-busy={sending}
          onChange={(e) => {if(!sending){setBody(e.target.value);if(sendError)setSendError(false);}}}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
          placeholder={t('communityMessageInputPlaceholder')}
          aria-label={t('communityMessageInputPlaceholder')}
          className="flex-1 min-w-0 rounded-full px-4 py-2.5 font-sans focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
          style={{ fontSize: 14, background: 'var(--bg-1)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)', outline: 'none' }}
        />
        <button
          onClick={handleSend}
          aria-label={t(sending?'communitySendingStatus':'communitySend')} aria-busy={sending}
          disabled={!body.trim() || sending}
          className="flex items-center justify-center rounded-full flex-shrink-0"
          style={{ width: 44, height: 44, background: body.trim() ? 'var(--brand)' : 'rgba(32,25,15,0.1)', border: 'none', cursor: body.trim() ? 'pointer' : 'default' }}
        >
          {sending ? <Loader2 size={16} className="animate-spin" style={{ color: '#fff' }} /> : <Send size={16} style={{ color: body.trim() ? 'var(--on-forest)' : 'var(--text-muted)' }} />}
        </button>
      </div>
    </div>
  );
}
