'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Loader2, Send, Flag } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { communityEnabled } from '@/lib/community/flag';
import { getThread, subscribeMessages, sendMessage, reportContent } from '@/lib/db/community-queries';
import type { MessageThread, ThreadMessage } from '@/lib/db/types';
import BrandLogo from '@/components/BrandLogo';
import LessonLink from '@/components/design/LessonLink';

function timeAgo(ts: unknown): string {
  const t = ts as { toDate?: () => Date; seconds?: number } | null;
  if (!t) return '';
  try {
    const d = typeof t.toDate === 'function' ? t.toDate() : new Date((t.seconds ?? 0) * 1000);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return 'now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
  } catch { return ''; }
}

export default function MessageThreadPage() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const params = useParams<{ threadId: string }>();
  const threadId = params.threadId;

  const [thread, setThread] = useState<MessageThread | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSent, setReportSent] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!communityEnabled()) { router.replace('/home'); return; }
    if (!loading && !user) { router.replace('/login'); return; }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user || !threadId || !communityEnabled()) return;
    getThread(threadId).then((th) => { setThread(th); setBusy(false); }).catch(() => setBusy(false));
    const unsub = subscribeMessages(threadId, setMessages);
    return () => { unsub?.(); };
  }, [user, threadId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (!body.trim() || sending) return;
    setSending(true);
    const text = body.trim();
    setBody('');
    try { await sendMessage(threadId, text); } finally { setSending(false); }
  }, [body, sending, threadId]);

  async function handleReport() {
    if (!reportReason.trim() || !thread) return;
    const otherUid = thread.participants.find((p) => p !== user?.uid) ?? '';
    await reportContent('message', threadId, otherUid, reportReason.trim());
    setReportSent(true);
    setReportReason('');
    setTimeout(() => { setReportSent(false); setReportOpen(false); }, 2000);
  }

  if (busy || loading || !communityEnabled() || !user) {
    return (
      <div className="h-[100dvh] flex items-center justify-center" style={{ background: '#E4DCC6' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: '#1F4D2B' }} />
      </div>
    );
  }

  const otherUid = thread?.participants.find((p) => p !== user.uid) ?? '';
  const otherName = thread?.participant_names?.[otherUid] ?? 'Farmer';

  return (
    <div className="h-[100dvh] flex flex-col font-sans" style={{ background: '#E4DCC6', color: '#20190F' }}>
      <header className="flex-shrink-0 flex items-center gap-3 px-4" style={{ height: 56, borderBottom: '1px solid #E2D8C4', background: '#FFFEFA' }}>
        <Link href="/community" style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#5C5040', textDecoration: 'none' }}>
          <ChevronLeft size={18} strokeWidth={1.7} />
        </Link>
        <BrandLogo />
        <div style={{ flex: 1 }} />
        <LessonLink id="community:messages" label="Learn" />
        <Link href={`/community/u/${otherUid}`} className="font-display font-semibold" style={{ fontSize: 14, color: '#20190F', textDecoration: 'none' }}>
          {otherName}
        </Link>
        <button
          onClick={() => setReportOpen((s) => !s)}
          aria-label={t('communityReportButton')}
          style={{ marginLeft: 8, background: 'transparent', border: 'none', color: '#8C7A62', cursor: 'pointer', display: 'flex' }}
        >
          <Flag size={16} />
        </button>
      </header>

      {reportOpen && (
        <div className="rounded-2xl p-4" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', margin: '12px 16px 0' }}>
          <textarea
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value.slice(0, 300))}
            placeholder={t('communityReportReasonPlaceholder')}
            rows={2}
            className="w-full rounded-xl px-3 py-2.5 font-sans"
            style={{ fontSize: 13.5, background: '#fff', border: '1px solid #D8CBB2', color: '#20190F', outline: 'none', resize: 'none', marginBottom: 8 }}
          />
          <button
            onClick={handleReport}
            disabled={!reportReason.trim()}
            className="font-sans font-semibold rounded-xl"
            style={{ padding: '8px 14px', fontSize: 12.5, background: reportReason.trim() ? '#8B2020' : 'rgba(32,25,15,0.1)', color: reportReason.trim() ? '#fff' : '#94876F', border: 'none', cursor: reportReason.trim() ? 'pointer' : 'default' }}
          >
            {reportSent ? t('communityReportSent') : t('communityReportSubmit')}
          </button>
        </div>
      )}

      <main className="flex-1 overflow-y-auto" style={{ padding: '16px', maxWidth: 560, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.map((m) => {
          const mine = m.sender_id === user.uid;
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '75%' }}>
                <div
                  className="font-sans"
                  style={{
                    fontSize: 14, lineHeight: 1.5, padding: '9px 13px', borderRadius: 16,
                    background: mine ? '#1F4D2B' : '#FFFEFA',
                    color: mine ? '#F7F2E9' : '#20190F',
                    border: mine ? 'none' : '1px solid #E2D8C4',
                    borderBottomRightRadius: mine ? 4 : 16,
                    borderBottomLeftRadius: mine ? 16 : 4,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {m.body}
                </div>
                <div className="font-sans" style={{ fontSize: 10.5, color: '#8C7A62', marginTop: 2, textAlign: mine ? 'right' : 'left' }}>
                  {timeAgo(m.created_at)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </main>

      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-3" style={{ borderTop: '1px solid #E2D8C4', background: '#FFFEFA', paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
        <input
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
          placeholder={t('communityMessageInputPlaceholder')}
          className="flex-1 rounded-full px-4 py-2.5 font-sans"
          style={{ fontSize: 14, background: '#fff', border: '1px solid #D8CBB2', color: '#20190F', outline: 'none' }}
        />
        <button
          onClick={handleSend}
          disabled={!body.trim() || sending}
          className="flex items-center justify-center rounded-full flex-shrink-0"
          style={{ width: 40, height: 40, background: body.trim() ? '#1F4D2B' : 'rgba(32,25,15,0.1)', border: 'none', cursor: body.trim() ? 'pointer' : 'default' }}
        >
          {sending ? <Loader2 size={16} className="animate-spin" style={{ color: '#fff' }} /> : <Send size={16} style={{ color: body.trim() ? '#F7F2E9' : '#94876F' }} />}
        </button>
      </div>
    </div>
  );
}
