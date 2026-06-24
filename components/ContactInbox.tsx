'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageCircle, ChevronDown, ChevronUp, Mail, Loader2, MailOpen, CornerDownRight, Send } from 'lucide-react';
import { collection, query, where, orderBy, getDocs, updateDoc, addDoc, doc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getFirebase, isBackendConfigured } from '@/lib/firebase/init';

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

function formatDate(ts: ContactMessage['created_at']): string {
  if (!ts) return '';
  try {
    const d = typeof (ts as { toDate?: () => Date }).toDate === 'function'
      ? (ts as { toDate: () => Date }).toDate()
      : new Date((ts as { seconds?: number }).seconds ? (ts as { seconds: number }).seconds * 1000 : String(ts));
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return 'Just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

export default function ContactInbox({ recipient, onUnreadCount }: Props) {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replySending, setReplySending] = useState<string | null>(null);
  const [replySent, setReplySent] = useState<Set<string>>(new Set());
  const isLive = isBackendConfigured();

  const load = useCallback(async () => {
    if (!isLive) { setLoading(false); return; }
    const fb = getFirebase();
    if (!fb) { setLoading(false); return; }
    try {
      const q = query(
        collection(fb.db, 'contact_messages'),
        where('recipient', '==', recipient),
        orderBy('created_at', 'desc'),
      );
      const snap = await getDocs(q);
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ContactMessage));
      setMessages(msgs);
      onUnreadCount?.(msgs.filter((m) => m.status === 'unread').length);
    } catch {
      // Missing index or no messages — fail silently
    }
    setLoading(false);
  }, [recipient, isLive, onUnreadCount]);

  useEffect(() => { load(); }, [load]);

  async function markRead(id: string) {
    const fb = getFirebase();
    if (!fb) return;
    await updateDoc(doc(fb.db, 'contact_messages', id), { status: 'read' });
    setMessages((prev) => {
      const next = prev.map((m) => m.id === id ? { ...m, status: 'read' as const } : m);
      onUnreadCount?.(next.filter((m) => m.status === 'unread').length);
      return next;
    });
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
    if (!text || !isLive) return;
    const fb = getFirebase();
    if (!fb) return;
    setReplySending(msg.id);
    const auth = getAuth(fb.app);
    const me = auth.currentUser;
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
    setReplySending(null);
    setTimeout(() => setReplySent((s) => { const n = new Set(s); n.delete(msg.id); return n; }), 3000);
  }

  const unreadCount = messages.filter((m) => m.status === 'unread').length;

  if (!isLive) {
    return (
      <div className="rounded-2xl px-4 py-10 text-center" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
        <MessageCircle size={26} style={{ color: '#8C7A62', margin: '0 auto 10px' }} strokeWidth={1.5} />
        <p className="text-sm font-display font-semibold" style={{ color: '#5C5040' }}>Backend not connected</p>
        <p className="text-xs font-sans mt-1" style={{ color: '#8C7A62' }}>Connect Firebase to receive messages</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={22} className="animate-spin" style={{ color: '#1F4D2B' }} />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="rounded-2xl px-4 py-10 text-center" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
        <Mail size={26} style={{ color: '#8C7A62', margin: '0 auto 10px' }} strokeWidth={1.5} />
        <p className="text-sm font-display font-semibold" style={{ color: '#5C5040' }}>No messages yet</p>
        <p className="text-xs font-sans mt-1" style={{ color: '#8C7A62' }}>Messages from learners appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Unread banner */}
      {unreadCount > 0 && (
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2.5"
          style={{ background: 'rgba(31,77,43,0.07)', border: '1px solid rgba(31,77,43,0.2)' }}
        >
          <MailOpen size={14} style={{ color: '#1F4D2B' }} />
          <span className="text-xs font-sans font-semibold" style={{ color: '#1F4D2B' }}>
            {unreadCount} unread {unreadCount === 1 ? 'message' : 'messages'}
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
              background: isUnread ? 'rgba(31,77,43,0.04)' : '#FBF6EC',
              border: `1px solid ${isUnread ? 'rgba(31,77,43,0.25)' : '#E2D8C4'}`,
            }}
          >
            {/* Row */}
            <button
              onClick={() => toggleExpand(msg.id)}
              className="w-full flex items-start gap-3 px-4 py-3.5 text-left"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              {/* Unread indicator dot */}
              <div
                className="flex-shrink-0 rounded-full"
                style={{ width: 7, height: 7, marginTop: 6, background: isUnread ? '#1F4D2B' : 'transparent', flexShrink: 0 }}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className="font-display font-semibold text-sm truncate"
                    style={{ color: '#20190F', fontWeight: isUnread ? 700 : 600 }}
                  >
                    {msg.from_name ?? 'Unknown sender'}
                  </span>
                  <span className="font-sans flex-shrink-0" style={{ fontSize: 11, color: '#8C7A62' }}>
                    {formatDate(msg.created_at)}
                  </span>
                </div>
                <div className="font-sans text-xs mt-0.5 truncate" style={{ color: '#5C5040' }}>
                  {msg.subject || '(no subject)'}
                </div>
                {!isOpen && (
                  <div className="font-sans text-xs mt-0.5 truncate" style={{ color: '#8C7A62' }}>
                    {msg.body}
                  </div>
                )}
              </div>

              {isOpen
                ? <ChevronUp size={14} style={{ color: '#8C7A62', flexShrink: 0, marginTop: 2 }} />
                : <ChevronDown size={14} style={{ color: '#8C7A62', flexShrink: 0, marginTop: 2 }} />}
            </button>

            {/* Expanded body */}
            {isOpen && (
              <div className="px-10 pb-4" style={{ borderTop: '1px solid rgba(226,216,196,0.6)' }}>
                <div className="font-sans text-xs pt-2 pb-3" style={{ color: '#8C7A62' }}>
                  Sent to: <span style={{ textTransform: 'capitalize' }}>{msg.recipient}</span>
                  {msg.status === 'replied' && (
                    <span className="ml-2 px-1.5 py-0.5 rounded font-mono" style={{ fontSize: 10, background: 'rgba(31,77,43,0.08)', color: '#1F4D2B', border: '1px solid rgba(31,77,43,0.2)' }}>
                      replied
                    </span>
                  )}
                </div>
                <p className="font-sans text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#20190F' }}>
                  {msg.body}
                </p>

                {/* Reply box */}
                <div className="mt-4 pt-3" style={{ borderTop: '1px solid #E2D8C4' }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <CornerDownRight size={12} style={{ color: '#8C7A62' }} />
                    <span className="font-sans text-xs font-semibold uppercase tracking-wide" style={{ color: '#5C5040' }}>Reply</span>
                  </div>
                  <textarea
                    value={replyText[msg.id] ?? ''}
                    onChange={(e) => setReplyText((t) => ({ ...t, [msg.id]: e.target.value }))}
                    placeholder="Write a reply to this learner…"
                    rows={3}
                    className="w-full font-sans text-sm rounded-xl px-3 py-2.5 resize-none outline-none"
                    style={{ background: '#fff', border: '1px solid #D8CBB2', color: '#20190F', lineHeight: 1.5 }}
                  />
                  <button
                    onClick={() => sendReply(msg)}
                    disabled={!replyText[msg.id]?.trim() || replySending === msg.id}
                    className="mt-2 flex items-center gap-1.5 font-display font-semibold text-xs px-4 py-2 rounded-xl"
                    style={{
                      background: replyText[msg.id]?.trim() ? '#1F4D2B' : 'rgba(32,25,15,0.08)',
                      color: replyText[msg.id]?.trim() ? '#F7F2E9' : '#8C7A62',
                      border: 'none', cursor: replyText[msg.id]?.trim() ? 'pointer' : 'default',
                    }}
                  >
                    {replySending === msg.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    {replySent.has(msg.id) ? 'Sent!' : replySending === msg.id ? 'Sending…' : 'Send reply'}
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
