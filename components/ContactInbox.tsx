'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageCircle, ChevronDown, ChevronUp, Mail, Loader2, MailOpen, CornerDownRight, Send } from 'lucide-react';
import { collection, query, where, orderBy, getDocs, updateDoc, addDoc, doc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { useLanguage } from '@/lib/i18n';
import { isSampleMode } from '@/lib/sample-mode';
import { sampleRead, sampleWrite, freshSampleMessages, type SampleMessage } from '@/lib/sample-operations';
import { getFirebase, isBackendConfigured } from '@/lib/firebase/init';
import { getMyProfile } from '@/lib/db/queries';

interface ContactMessage {
  id: string;
  from_name: string | null;
  from_uid: string;
  recipient: string;
  subject: string;
  body: string;
  status: 'unread' | 'read' | 'replied';
  created_at: { toDate?: () => Date; seconds?: number } | string | null;
}

interface Props {
  recipient: 'mentor' | 'organisation' | 'support';
  onUnreadCount?: (n: number) => void;
}

function formatDate(ts: ContactMessage['created_at'], lang: string): string {
  if (!ts) return '';
  try {
    const d = typeof (ts as { toDate?: () => Date }).toDate === 'function'
      ? (ts as { toDate: () => Date }).toDate()
      : new Date((ts as { seconds?: number }).seconds ? (ts as { seconds: number }).seconds * 1000 : String(ts));
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return lang === 'zu' ? 'Manje' : 'Just now';
    if (diff < 3_600_000) return lang === 'zu' ? `emiz ${Math.floor(diff / 60_000)} edlule` : `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return lang === 'zu' ? `amahora ${Math.floor(diff / 3_600_000)} edlule` : `${Math.floor(diff / 3_600_000)}h ago`;
    return d.toLocaleDateString(lang === 'zu' ? 'zu-ZA' : 'en-ZA', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

export default function ContactInbox({ recipient, onUnreadCount }: Props) {
  const { lang } = useLanguage();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [noOrg, setNoOrg] = useState(false);
  const [actionError, setActionError] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replySending, setReplySending] = useState<string | null>(null);
  const [replySent, setReplySent] = useState<Set<string>>(new Set());
  const isLive = isBackendConfigured();
  const [sample, setSample] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    setNoOrg(false);
    if (isSampleMode()) { const rows = sampleRead(`messages-${recipient}`, () => freshSampleMessages(recipient)); setSample(true); setMessages(rows); onUnreadCount?.(rows.filter(m => m.status === 'unread').length); setLoading(false); return; }
    if (sample || !isLive) { setLoading(false); return; }
    const fb = getFirebase();
    if (!fb) { setLoading(false); return; }
    try {
      // Recipient names are shared across every organisation. Scope the query to the signed-in
      // staff member's organisation so Firestore can prove the same boundary as the rules.
      const profile = await getMyProfile();
      if (!profile?.org_id) {
        setMessages([]);
        setNoOrg(true);
        onUnreadCount?.(0);
        return;
      }
      const q = query(
        collection(fb.db, 'contact_messages'),
        where('recipient', '==', recipient),
        where('org_id', '==', profile.org_id),
        orderBy('created_at', 'desc'),
      );
      const snap = await getDocs(q);
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ContactMessage));
      setMessages(msgs);
      onUnreadCount?.(msgs.filter((m) => m.status === 'unread').length);
    } catch {
      // A rules denial or missing index is not the same state as an empty inbox.
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [recipient, isLive, onUnreadCount]);

  useEffect(() => { load(); }, [load]);

  async function markRead(id: string) {
    if (isSampleMode()) { const next = sampleRead(`messages-${recipient}`, () => freshSampleMessages(recipient)).map(m => m.id === id ? { ...m, status: 'read' as const } : m); sampleWrite(`messages-${recipient}`, next); setMessages(next); onUnreadCount?.(next.filter(m => m.status === 'unread').length); return; }
    if (sample) return;
    const fb = getFirebase();
    if (!fb) return;
    try {
      await updateDoc(doc(fb.db, 'contact_messages', id), { status: 'read' });
      setMessages((prev) => {
        const next = prev.map((m) => m.id === id ? { ...m, status: 'read' as const } : m);
        onUnreadCount?.(next.filter((m) => m.status === 'unread').length);
        return next;
      });
    } catch {
      setActionError(true);
    }
  }

  function toggleExpand(id: string) {
    const isOpening = expanded !== id;
    setExpanded(isOpening ? id : null);
    if (isOpening) {
      const msg = messages.find((m) => m.id === id);
      if (msg?.status === 'unread') markRead(id);
    }
  }

  async function sendReply(msg: ContactMessage) {
    const text = (replyText[msg.id] ?? '').trim();
    if (!text) return;
    if (isSampleMode()) { const next = sampleRead(`messages-${recipient}`, () => freshSampleMessages(recipient)).map(m => m.id === msg.id ? { ...m, status: 'replied' as const, reply: text } : m); sampleWrite(`messages-${recipient}`, next); setMessages(next); setReplySent(s => new Set(s).add(msg.id)); setReplyText(t => ({ ...t, [msg.id]: '' })); return; }
    if (sample || !isLive) return;
    const fb = getFirebase();
    if (!fb) return;
    setReplySending(msg.id);
    const auth = getAuth(fb.app);
    const me = auth.currentUser;
    setActionError(false);
    try {
      await addDoc(collection(fb.db, 'contact_replies'), {
        message_id: msg.id,
        for_uid: msg.from_uid,
        reply_body: text,
        replied_at: serverTimestamp(),
        replied_by_name: me?.displayName ?? me?.email ?? 'Your mentor',
        recipient_label: recipient,
      });
      await updateDoc(doc(fb.db, 'contact_messages', msg.id), { status: 'replied' });
      setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, status: 'replied' as const } : m));
      setReplySent((s) => new Set(s).add(msg.id));
      setReplyText((t) => ({ ...t, [msg.id]: '' }));
      setTimeout(() => setReplySent((s) => { const n = new Set(s); n.delete(msg.id); return n; }), 3000);
    } catch {
      setActionError(true);
    } finally {
      setReplySending(null);
    }
  }

  const unreadCount = messages.filter((m) => m.status === 'unread').length;

  if (!isLive && !sample) {
    return (
      <div className="rounded-2xl px-4 py-10 text-center" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
        <MessageCircle size={26} style={{ color: 'var(--text-muted)', margin: '0 auto 10px' }} strokeWidth={1.5} />
        <p className="text-sm font-display font-semibold" style={{ color: 'var(--text-muted)' }}>{lang === 'zu' ? 'Isistimu ayikaxhunyaniswa' : 'Backend not connected'}</p>
        <p className="text-xs font-sans mt-1" style={{ color: 'var(--text-muted)' }}>{lang === 'zu' ? 'Xhuma i-Firebase ukuze wamukele imilayezo' : 'Connect Firebase to receive messages'}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={22} className="animate-spin" style={{ color: 'var(--color-forest-800)' }} aria-label={lang === 'zu' ? 'Iyalayisha' : 'Loading'} role="status" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-2xl px-4 py-10 text-center" style={{ background: 'var(--bg-1)', border: "1px solid color-mix(in srgb, var(--danger) 35%, transparent)" }}>
        <Mail size={26} style={{ color: 'var(--danger)', margin: '0 auto 10px' }} strokeWidth={1.5} />
        <p className="text-sm font-display font-semibold" style={{ color: 'var(--danger)' }}>{lang === 'zu' ? 'Imilayezo ayitholakali' : 'Messages unavailable'}</p>
        <p className="text-xs font-sans mt-1" style={{ color: 'var(--text-muted)' }}>{lang === 'zu' ? 'Kungenzeka awunayo imvume, noma uxhumano alutholakali.' : 'You may not have access, or the connection is unavailable.'}</p>
      </div>
    );
  }

  if (noOrg) {
    return (
      <div className="rounded-2xl px-4 py-10 text-center" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
        <Mail size={26} style={{ color: 'var(--text-muted)', margin: '0 auto 10px' }} strokeWidth={1.5} />
        <p className="text-sm font-display font-semibold" style={{ color: 'var(--text-muted)' }}>{lang === 'zu' ? 'Ayikho inhlangano exhunywe' : 'No organisation linked yet'}</p>
        <p className="text-xs font-sans mt-1" style={{ color: 'var(--text-muted)' }}>{lang === 'zu' ? 'Imilayezo izovela uma i-akhawunti yakho isixhunywe enhlanganweni.' : 'Messages appear here once your account is linked to an organisation.'}</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="rounded-2xl px-4 py-10 text-center" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
        <Mail size={26} style={{ color: 'var(--text-muted)', margin: '0 auto 10px' }} strokeWidth={1.5} />
        <p className="text-sm font-display font-semibold" style={{ color: 'var(--text-muted)' }}>{lang === 'zu' ? 'Akukho milayezo okwamanje' : 'No messages yet'}</p>
        <p className="text-xs font-sans mt-1" style={{ color: 'var(--text-muted)' }}>{lang === 'zu' ? 'Imilayezo evela kubafundi izovela lapha' : 'Messages from learners appear here'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sample && <p className="rounded-xl p-3 text-sm" style={{ background: 'var(--info-soft)', color: 'var(--info)' }}>{lang === 'zu' ? 'Izimpendulo zigcinwa kulesi sivivinyo kuphela. Akukho okuthunyelwayo.' : 'Replies stay in this tour session. Nothing is sent.'}</p>}
      {actionError && (
        <div className="rounded-xl px-3 py-2 text-xs font-sans" style={{ background: 'var(--bg-1)', border: "1px solid color-mix(in srgb, var(--danger) 35%, transparent)", color: 'var(--danger)' }}>
          {lang === 'zu' ? 'Leso senzo asikwazanga ukugcinwa. Hlola imvume ye-akhawunti noma uxhumano, bese uzama futhi.' : 'That action could not be saved. Check your account access or connection and try again.'}
        </div>
      )}
      {/* Unread banner */}
      {unreadCount > 0 && (
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2.5"
          style={{ background: 'rgba(31,77,43,0.07)', border: '1px solid rgba(31,77,43,0.2)' }}
        >
          <MailOpen size={14} style={{ color: 'var(--color-forest-800)' }} />
          <span className="text-xs font-sans font-semibold" style={{ color: 'var(--color-forest-800)' }}>
            {unreadCount} {lang === 'zu' ? (unreadCount === 1 ? 'umlayezo ongafundiwe' : 'imilayezo engafundiwe') : `unread ${unreadCount === 1 ? 'message' : 'messages'}`}
          </span>
        </div>
      )}

      {messages.map((msg) => {
        const isUnread = msg.status === 'unread';
        const isOpen = expanded === msg.id;
        return (
          <div
            key={msg.id}
            className="rounded-2xl overflow-hidden transition-all"
            style={{
              background: isUnread ? 'rgba(31,77,43,0.04)' : 'var(--bg-1)',
              border: `1px solid ${isUnread ? 'rgba(31,77,43,0.25)' : 'var(--border)'}`,
            }}
          >
            {/* Row */}
            <button
              onClick={() => toggleExpand(msg.id)}
              aria-expanded={isOpen}
              aria-label={`${lang === 'zu' ? (isOpen ? 'Fihla umlayezo' : 'Vula umlayezo') : (isOpen ? 'Collapse message' : 'Open message')}: ${msg.subject || (lang === 'zu' ? 'Akunasihloko' : 'no subject')}`}
              className="w-full flex items-start gap-3 px-4 py-3.5 text-left"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              {/* Unread indicator dot */}
              <div
                className="flex-shrink-0 rounded-full"
                style={{ width: 7, height: 7, marginTop: 6, background: isUnread ? 'var(--color-forest-800)' : 'transparent', flexShrink: 0 }}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className="font-display font-semibold text-sm truncate"
                    style={{ color: 'var(--text-primary)', fontWeight: isUnread ? 700 : 600 }}
                  >
                    {msg.from_name ?? (lang === 'zu' ? 'Umthumeli ongaziwa' : 'Unknown sender')}
                  </span>
                  <span className="font-sans flex-shrink-0" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {formatDate(msg.created_at, lang)}
                  </span>
                </div>
                <div className="font-sans text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                  {msg.subject || (lang === 'zu' ? '(Akunasihloko)' : '(no subject)')}
                </div>
                {!isOpen && (
                  <div className="font-sans text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                    {msg.body}
                  </div>
                )}
              </div>

              {isOpen
                ? <ChevronUp size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
                : <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />}
            </button>

            {/* Expanded body */}
            {isOpen && (
              <div className="px-10 pb-4" style={{ borderTop: '1px solid rgba(226,216,196,0.6)' }}>
                <div className="font-sans text-xs pt-2 pb-3" style={{ color: 'var(--text-muted)' }}>
                  {lang === 'zu' ? 'Ithunyelwe ku: ' : 'Sent to: '}<span style={{ textTransform: 'capitalize' }}>{msg.recipient}</span>
                  {msg.status === 'replied' && (
                    <span className="ml-2 px-1.5 py-0.5 rounded font-mono" style={{ fontSize: 10, background: 'rgba(31,77,43,0.08)', color: 'var(--color-forest-800)', border: '1px solid rgba(31,77,43,0.2)' }}>
                      {lang === 'zu' ? 'kuphenduliwe' : 'replied'}
                    </span>
                  )}
                </div>
                <p className="font-sans text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                  {msg.body}
                </p>

                {sample && (msg as SampleMessage).reply && <p className="text-sm"><strong>{lang === 'zu' ? 'Impendulo:' : 'reply:'}</strong> {(msg as SampleMessage).reply}</p>}
                {/* Reply box */}
                <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <CornerDownRight size={12} style={{ color: 'var(--text-muted)' }} />
                    <span className="font-sans text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{lang === 'zu' ? 'Phendula' : 'Reply'}</span>
                  </div>
                  <textarea
                    value={replyText[msg.id] ?? ''}
                    aria-label={`${lang === 'zu' ? 'Impendulo eya ku-' : 'Reply to '}${msg.from_name ?? (lang === 'zu' ? 'umfundi' : 'learner')}`}
                    onChange={(e) => setReplyText((t) => ({ ...t, [msg.id]: e.target.value }))}
                    placeholder={lang === 'zu' ? 'Bhala impendulo oya kuyithumela kulo mfundi…' : 'Write a reply to this learner…'}
                    rows={3}
                    className="w-full font-sans text-sm rounded-xl px-3 py-2.5 resize-none outline-none"
                    style={{ background: 'var(--input-bg)', border: '1px solid #D8CBB2', color: 'var(--text-primary)', lineHeight: 1.5 }}
                  />
                  <button
                    onClick={() => sendReply(msg)}
                    disabled={!replyText[msg.id]?.trim() || replySending === msg.id}
                    className="mt-2 flex items-center gap-1.5 font-display font-semibold text-xs px-4 py-2 rounded-xl"
                    style={{
                      background: replyText[msg.id]?.trim() ? 'var(--color-forest-800)' : 'rgba(32,25,15,0.08)',
                      color: replyText[msg.id]?.trim() ? 'var(--color-canvas)' : 'var(--text-muted)',
                      border: 'none', cursor: replyText[msg.id]?.trim() ? 'pointer' : 'default',
                    }}
                  >
                    {replySending === msg.id ? <Loader2 size={12} className="animate-spin" aria-label={lang === 'zu' ? 'Kuyathunyelwa' : 'Sending'} /> : <Send size={12} aria-hidden="true" />}
                    {replySent.has(msg.id) ? (sample ? (lang === 'zu' ? 'Kulondoloziwe kule ndawo' : 'Saved in this workspace') : (lang === 'zu' ? 'Kuthunyelwe!' : 'Sent!')) : replySending === msg.id ? (lang === 'zu' ? 'Kuyathunyelwa…' : 'Sending…') : sample ? (lang === 'zu' ? 'Londoloza impendulo' : 'Save reply') : (lang === 'zu' ? 'Thumela impendulo' : 'Send reply')}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
