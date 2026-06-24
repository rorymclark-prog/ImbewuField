'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, Phone, Mail, Users, Building2, Send, CheckCircle, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { isBackendConfigured, getFirebase } from '@/lib/firebase/init';
import { getMyProfile } from '@/lib/db/queries';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import TabBar from '@/components/TabBar';
import BrandLogo from '@/components/BrandLogo';
import type { Profile } from '@/lib/db/types';

type Recipient = 'mentor' | 'organisation' | 'support';

export default function ContactPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const isLive = isBackendConfigured();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [recipient, setRecipient] = useState<Recipient>('mentor');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user && isLive) router.replace('/login');
  }, [user, loading, router, isLive]);

  useEffect(() => {
    if (!loading && user && isLive) {
      getMyProfile().then(setProfile).catch(() => {});
    }
  }, [user, loading, isLive]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError('');

    try {
      if (isLive && user) {
        const fb = getFirebase();
        if (!fb) throw new Error('Firebase not initialised');
        await addDoc(collection(fb.db, 'contact_messages'), {
          from_uid: user.uid,
          from_name: profile?.full_name ?? user.displayName ?? user.email,
          recipient,
          subject: subject.trim() || '(no subject)',
          body: body.trim(),
          status: 'unread',
          created_at: serverTimestamp(),
        });
      }
      setSent(true);
    } catch {
      setError('Could not send message. Please try again.');
    } finally {
      setSending(false);
    }
  }

  const RECIPIENT_OPTIONS: { value: Recipient; label: string; sub: string; Icon: React.ElementType }[] = [
    { value: 'mentor', label: 'My Mentor', sub: 'Course support, farm visits, design review', Icon: Users },
    { value: 'organisation', label: 'My Organisation', sub: profile?.org_id ? 'Your NGO or programme coordinator' : 'Set when you join a programme', Icon: Building2 },
    { value: 'support', label: 'ImbewuField Support', sub: 'Technical help or general queries', Icon: MessageCircle },
  ];

  return (
    <div
      className="h-[100dvh] flex flex-col font-sans"
      style={{ background: '#F7F2E9', color: '#20190F' }}
    >
      {/* Header */}
      <header
        className="flex-shrink-0 flex items-center gap-3 px-4"
        style={{ height: 56, borderBottom: '1px solid #E2D8C4', background: '#FBF6EC' }}
      >
        <Link
          href="/home"
          style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#5C5040', textDecoration: 'none' }}
        >
          <ChevronLeft size={18} strokeWidth={1.7} />
        </Link>
        <BrandLogo />
        <div style={{ flex: 1 }} />
        <span className="font-display font-semibold" style={{ fontSize: 15, color: '#20190F' }}>Contact</span>
      </header>

      {/* Content */}
      <main
        className="flex-1 overflow-y-auto"
        style={{ padding: '20px 16px', maxWidth: 480, width: '100%', margin: '0 auto' }}
      >
        {sent ? (
          /* Success state */
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: 'rgba(31,77,43,0.07)', border: '1px solid rgba(31,77,43,0.2)', marginTop: 32 }}
          >
            <CheckCircle size={40} style={{ color: '#1F4D2B', margin: '0 auto 16px' }} strokeWidth={1.5} />
            <div className="font-display font-bold" style={{ fontSize: 20, color: '#1F4D2B', marginBottom: 8 }}>
              Message sent
            </div>
            <p className="font-sans" style={{ fontSize: 14, color: '#5C5040', lineHeight: 1.6, marginBottom: 24 }}>
              Your message has been delivered. You&apos;ll hear back within 1–2 working days.
            </p>
            <button
              onClick={() => { setSent(false); setBody(''); setSubject(''); }}
              className="font-sans font-semibold"
              style={{
                background: '#1F4D2B', color: '#F7F2E9', border: 'none',
                borderRadius: 100, padding: '10px 20px', fontSize: 14, cursor: 'pointer',
              }}
            >
              Send another message
            </button>
          </div>
        ) : (
          <>
            {/* Page intro */}
            <div style={{ marginBottom: 24 }}>
              <div
                className="font-sans uppercase tracking-widest"
                style={{ fontSize: 10, color: '#C07A1E', letterSpacing: '0.12em', marginBottom: 4 }}
              >
                Get in touch
              </div>
              <div className="font-display font-bold" style={{ fontSize: 22, letterSpacing: '-0.02em', color: '#20190F' }}>
                Contact
              </div>
              <p className="font-sans" style={{ fontSize: 13, color: '#5C5040', marginTop: 4, lineHeight: 1.5 }}>
                Reach your mentor, organisation, or ImbewuField support.
              </p>
            </div>

            {/* Quick contact buttons (phone/email if available) */}
            {profile?.phone && (
              <a
                href={`tel:${profile.phone}`}
                className="flex items-center gap-3 rounded-xl p-4 mb-3"
                style={{ textDecoration: 'none', background: '#FBF6EC', border: '1px solid #E2D8C4' }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(31,77,43,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Phone size={17} style={{ color: '#1F4D2B' }} strokeWidth={1.6} />
                </div>
                <div>
                  <div className="font-display font-semibold" style={{ fontSize: 14, color: '#20190F' }}>Call</div>
                  <div className="font-sans" style={{ fontSize: 12, color: '#5C5040' }}>{profile.phone}</div>
                </div>
              </a>
            )}

            {user?.email && (
              <a
                href={`mailto:${user.email}?subject=ImbewuField enquiry`}
                className="flex items-center gap-3 rounded-xl p-4 mb-5"
                style={{ textDecoration: 'none', background: '#FBF6EC', border: '1px solid #E2D8C4' }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(31,77,43,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Mail size={17} style={{ color: '#1F4D2B' }} strokeWidth={1.6} />
                </div>
                <div>
                  <div className="font-display font-semibold" style={{ fontSize: 14, color: '#20190F' }}>Email</div>
                  <div className="font-sans" style={{ fontSize: 12, color: '#5C5040' }}>{user.email}</div>
                </div>
              </a>
            )}

            {/* Message form */}
            <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Recipient selector */}
              <div>
                <div className="font-sans uppercase tracking-widest" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.12em', marginBottom: 8 }}>
                  Send to
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {RECIPIENT_OPTIONS.map(({ value, label, sub, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRecipient(value)}
                      className="flex items-center gap-3 rounded-xl p-3 text-left transition-all"
                      style={{
                        background: recipient === value ? 'rgba(31,77,43,0.08)' : '#FBF6EC',
                        border: `1px solid ${recipient === value ? 'rgba(31,77,43,0.35)' : '#E2D8C4'}`,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{
                        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                        background: recipient === value ? 'rgba(31,77,43,0.12)' : 'rgba(32,25,15,0.05)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={16} style={{ color: recipient === value ? '#1F4D2B' : '#5C5040' }} strokeWidth={1.6} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="font-display font-semibold" style={{ fontSize: 13.5, color: recipient === value ? '#1F4D2B' : '#20190F' }}>
                          {label}
                        </div>
                        <div className="font-sans" style={{ fontSize: 11.5, color: '#5C5040', marginTop: 1 }}>{sub}</div>
                      </div>
                      <div style={{
                        width: 16, height: 16, borderRadius: 8, border: `2px solid ${recipient === value ? '#1F4D2B' : '#C8BCA8'}`,
                        background: recipient === value ? '#1F4D2B' : 'transparent', flexShrink: 0,
                        boxSizing: 'border-box', position: 'relative',
                      }}>
                        {recipient === value && (
                          <div style={{ position: 'absolute', inset: 3, borderRadius: 4, background: '#F7F2E9' }} />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div>
                <div className="font-sans uppercase tracking-widest" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.12em', marginBottom: 6 }}>
                  Subject (optional)
                </div>
                <input
                  type="text"
                  placeholder="e.g. Farm visit request"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 font-sans"
                  style={{
                    fontSize: 14, background: '#FBF6EC', border: '1px solid #E2D8C4',
                    color: '#20190F', outline: 'none',
                  }}
                />
              </div>

              {/* Message body */}
              <div>
                <div className="font-sans uppercase tracking-widest" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.12em', marginBottom: 6 }}>
                  Message
                </div>
                <textarea
                  rows={5}
                  placeholder="Write your message here…"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required
                  className="w-full rounded-xl px-3 py-2.5 font-sans"
                  style={{
                    fontSize: 14, background: '#FBF6EC', border: '1px solid #E2D8C4',
                    color: '#20190F', outline: 'none', resize: 'vertical', lineHeight: 1.5,
                  }}
                />
              </div>

              {error && (
                <p className="font-sans" style={{ fontSize: 13, color: '#8B2020' }}>{error}</p>
              )}

              {!isLive && (
                <p className="font-sans rounded-xl px-3 py-2.5" style={{ fontSize: 12.5, color: '#8C7A62', background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
                  Backend not connected — messages will be logged locally only. Connect Firebase to enable delivery.
                </p>
              )}

              <button
                type="submit"
                disabled={sending || !body.trim()}
                className="flex items-center justify-center gap-2 font-display font-semibold rounded-xl"
                style={{
                  background: body.trim() ? '#1F4D2B' : 'rgba(32,25,15,0.1)',
                  color: body.trim() ? '#F7F2E9' : '#94876F',
                  border: 'none', cursor: body.trim() ? 'pointer' : 'default',
                  padding: '13px 20px', fontSize: 15,
                  transition: 'background 0.15s',
                }}
              >
                {sending ? (
                  <>Sending…</>
                ) : (
                  <><Send size={16} strokeWidth={1.8} /> Send message</>
                )}
              </button>
            </form>
          </>
        )}
      </main>

      <TabBar />
    </div>
  );
}
