'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, Loader2, MapPin, Plus, MessageCircle, User, Camera, X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { communityEnabled } from '@/lib/community/flag';
import { uploadPhoto } from '@/lib/db/queries';
import {
  getMyCommunityProfile, listNearbyCommunityProfiles, listBoardPosts, createBoardPost,
  closeBoardPost, deleteBoardPost, listMyThreads, getOrCreateThread,
} from '@/lib/db/community-queries';
import type { CommunityProfile, BoardPost, BoardCategory, BoardKind, MessageThread } from '@/lib/db/types';
import NearbyMap from '@/components/community/NearbyMap';
import BrandLogo from '@/components/BrandLogo';
import TabBar from '@/components/TabBar';

type Tab = 'nearby' | 'board' | 'messages';

const CATEGORY_LABEL: Record<BoardCategory, string> = {
  seed: 'Seed', seedlings: 'Seedlings', produce: 'Produce', tools: 'Tools', other: 'Other',
};
const KIND_LABEL: Record<BoardKind, string> = { have: 'Have', want: 'Want', free: 'Free' };
const KIND_COLOR: Record<BoardKind, string> = { have: '#1F4D2B', want: '#235E86', free: '#C07A1E' };

function timeAgo(ts: unknown): string {
  const t = ts as { toDate?: () => Date; seconds?: number } | null;
  if (!t) return '';
  try {
    const d = typeof t.toDate === 'function' ? t.toDate() : new Date((t.seconds ?? 0) * 1000);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return 'Just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
  } catch { return ''; }
}

export default function CommunityHubPage() {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('nearby');
  const [myProfile, setMyProfile] = useState<CommunityProfile | null>(null);
  const [nearby, setNearby] = useState<CommunityProfile[]>([]);
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [busy, setBusy] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showNewPost, setShowNewPost] = useState(false);

  useEffect(() => {
    if (!communityEnabled()) { router.replace('/home'); return; }
    if (!loading && !user) { router.replace('/login'); return; }
  }, [user, loading, router]);

  // Promise.allSettled (not .all) so one failed query — e.g. a missing index,
  // or a denied read if the backend kill switch flips off mid-session — never
  // blanks the other tabs' data, and always reaches setBusy(false) below
  // instead of leaving the hub on an infinite spinner.
  const refresh = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    const [mp, nb, bp, th] = await Promise.allSettled([
      getMyCommunityProfile(), listNearbyCommunityProfiles(), listBoardPosts(), listMyThreads(),
    ]);
    setMyProfile(mp.status === 'fulfilled' ? mp.value : null);
    setNearby(nb.status === 'fulfilled' ? nb.value : []);
    setPosts(bp.status === 'fulfilled' ? bp.value : []);
    setThreads(th.status === 'fulfilled' ? th.value : []);
    const failed = [mp, nb, bp, th].filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    if (failed.length > 0) failed.forEach((r) => console.error('community hub load failed', r.reason));
    setLoadError(failed.length > 0);
    setBusy(false);
  }, [user]);

  useEffect(() => { if (user && communityEnabled()) refresh(); }, [user, refresh]);

  async function handleOpenThread(otherUid: string, otherName: string) {
    const id = await getOrCreateThread(otherUid, otherName);
    if (id) router.push(`/community/messages/${id}`);
  }

  if (!communityEnabled() || loading || !user) {
    return (
      <div className="h-[100dvh] flex items-center justify-center" style={{ background: '#E4DCC6' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: '#1F4D2B' }} />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col font-sans" style={{ background: '#E4DCC6', color: '#20190F' }}>
      <header className="flex-shrink-0 flex items-center gap-3 px-4" style={{ height: 56, borderBottom: '1px solid #E2D8C4', background: '#FFFEFA' }}>
        <Link href="/home" style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#5C5040', textDecoration: 'none' }}>
          <ChevronLeft size={18} strokeWidth={1.7} />
        </Link>
        <BrandLogo />
        <div style={{ flex: 1 }} />
        <Link href="/community/profile" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#1F4D2B', textDecoration: 'none' }}>
          <User size={16} strokeWidth={1.8} />
          <span className="font-sans font-semibold" style={{ fontSize: 13 }}>
            {myProfile ? 'My profile' : 'Set up profile'}
          </span>
        </Link>
      </header>

      <div className="flex-shrink-0 flex" style={{ borderBottom: '1px solid #E2D8C4', background: '#FFFEFA' }}>
        {(['nearby', 'board', 'messages'] as Tab[]).map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className="flex-1 font-sans font-semibold"
            style={{
              padding: '12px 8px', fontSize: 13.5, background: 'transparent', border: 'none', cursor: 'pointer',
              color: tab === tb ? '#1F4D2B' : '#8C7A62',
              borderBottom: tab === tb ? '2.5px solid #1F4D2B' : '2.5px solid transparent',
            }}
          >
            {tb === 'nearby' ? t('communityTabNearby') : tb === 'board' ? t('communityTabBoard') : t('communityTabMessages')}
          </button>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto" style={{ padding: '16px', maxWidth: 560, width: '100%', margin: '0 auto' }}>
        {loadError && !busy && (
          <div className="flex items-center justify-between gap-3 rounded-xl" style={{ padding: '10px 14px', marginBottom: 14, background: 'rgba(139,32,32,0.08)', border: '1px solid rgba(139,32,32,0.25)' }}>
            <span className="font-sans" style={{ fontSize: 12.5, color: '#8B2020' }}>{t('communityLoadError')}</span>
            <button
              onClick={() => refresh()}
              className="font-sans font-semibold"
              style={{ fontSize: 12, color: '#1F4D2B', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', flexShrink: 0 }}
            >
              {t('communityRetry')}
            </button>
          </div>
        )}
        {busy ? (
          <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin" style={{ color: '#1F4D2B' }} /></div>
        ) : tab === 'nearby' ? (
          <NearbyTab nearby={nearby} onOpenProfile={(uid) => router.push(`/community/u/${uid}`)} />
        ) : tab === 'board' ? (
          <BoardTab
            posts={posts}
            myUid={user.uid}
            showNewPost={showNewPost}
            onToggleNewPost={() => setShowNewPost((s) => !s)}
            myAreaText={myProfile?.area_text ?? ''}
            onPosted={async () => { setShowNewPost(false); await refresh(); }}
            onClose={async (id) => { await closeBoardPost(id); await refresh(); }}
            onDelete={async (id) => { await deleteBoardPost(id); await refresh(); }}
            onMessage={handleOpenThread}
          />
        ) : (
          <MessagesTab threads={threads} myUid={user.uid} onOpen={(id) => router.push(`/community/messages/${id}`)} />
        )}
      </main>

      <TabBar />
    </div>
  );
}

function NearbyTab({ nearby, onOpenProfile }: { nearby: CommunityProfile[]; onOpenProfile: (uid: string) => void }) {
  const { t } = useLanguage();
  const pinned = nearby.filter((p) => p.show_on_map);
  return (
    <div>
      <p className="font-sans" style={{ fontSize: 12.5, color: '#5C5040', lineHeight: 1.5, marginBottom: 14 }}>
        {t('communityNearbyIntro')}
      </p>
      {pinned.length > 0 && (
        <div style={{ height: 260, marginBottom: 16 }}>
          <NearbyMap people={pinned} onOpenProfile={onOpenProfile} />
        </div>
      )}
      {nearby.length === 0 ? (
        <div className="rounded-2xl px-4 py-10 text-center" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
          <MapPin size={26} style={{ color: '#8C7A62', margin: '0 auto 10px' }} strokeWidth={1.5} />
          <p className="font-sans" style={{ fontSize: 13, color: '#5C5040' }}>{t('communityNearbyEmpty')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {nearby.map((p) => (
            <button
              key={p.uid}
              onClick={() => onOpenProfile(p.uid)}
              className="flex items-center gap-3 rounded-xl p-3 text-left w-full"
              style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', cursor: 'pointer' }}
            >
              <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#1F4D2B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {p.photos?.[0]
                  ? <img src={p.photos[0]} alt={p.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ color: '#F7F2E9', fontWeight: 700, fontSize: 15 }}>{(p.display_name?.[0] ?? '?').toUpperCase()}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="font-display font-semibold" style={{ fontSize: 14, color: '#20190F' }}>{p.display_name}</div>
                <div className="font-sans" style={{ fontSize: 12, color: '#8C7A62' }}>{p.area_text || '—'}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BoardTab({
  posts, myUid, showNewPost, onToggleNewPost, myAreaText, onPosted, onClose, onDelete, onMessage,
}: {
  posts: BoardPost[]; myUid: string; showNewPost: boolean; onToggleNewPost: () => void; myAreaText: string;
  onPosted: () => void; onClose: (id: string) => void; onDelete: (id: string) => void;
  onMessage: (uid: string, name: string) => void;
}) {
  const { t } = useLanguage();
  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
        <div className="font-display font-bold" style={{ fontSize: 18, color: '#20190F' }}>{t('communityBoardTitle')}</div>
        <button
          onClick={onToggleNewPost}
          className="flex items-center gap-1.5 font-display font-semibold rounded-xl"
          style={{ background: '#1F4D2B', color: '#F7F2E9', border: 'none', cursor: 'pointer', padding: '8px 14px', fontSize: 13 }}
        >
          <Plus size={14} /> {t('communityBoardNewPost')}
        </button>
      </div>

      {showNewPost && <NewBoardPostForm myAreaText={myAreaText} onPosted={onPosted} onCancel={onToggleNewPost} />}

      {posts.length === 0 ? (
        <div className="rounded-2xl px-4 py-10 text-center" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
          <p className="font-sans" style={{ fontSize: 13, color: '#5C5040' }}>{t('communityBoardEmpty')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {posts.map((p) => (
            <div key={p.id} className="rounded-2xl p-4" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
                <span className="font-sans font-bold" style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 100, background: KIND_COLOR[p.kind], color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {KIND_LABEL[p.kind]}
                </span>
                <span className="font-sans" style={{ fontSize: 11.5, color: '#8C7A62' }}>{CATEGORY_LABEL[p.category]}</span>
                <div style={{ flex: 1 }} />
                <span className="font-sans" style={{ fontSize: 11, color: '#8C7A62' }}>{timeAgo(p.created_at)}</span>
              </div>
              {p.photo_url && (
                <img src={p.photo_url} alt="" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 10, marginBottom: 8 }} />
              )}
              <p className="font-sans" style={{ fontSize: 14, color: '#20190F', lineHeight: 1.5, marginBottom: 6 }}>{p.description}</p>
              <div className="flex items-center gap-1.5" style={{ marginBottom: 10 }}>
                <MapPin size={11} style={{ color: '#8C7A62' }} />
                <span className="font-sans" style={{ fontSize: 12, color: '#8C7A62' }}>{p.area_text} · {p.owner_name}</span>
              </div>
              <div className="flex items-center gap-2">
                {p.owner_id === myUid ? (
                  <>
                    <button onClick={() => onClose(p.id)} className="font-sans font-semibold rounded-lg" style={{ fontSize: 12, padding: '6px 12px', background: 'rgba(31,77,43,0.08)', color: '#1F4D2B', border: '1px solid rgba(31,77,43,0.2)', cursor: 'pointer' }}>
                      {t('communityBoardClose')}
                    </button>
                    <button onClick={() => onDelete(p.id)} className="font-sans font-semibold rounded-lg" style={{ fontSize: 12, padding: '6px 12px', background: 'transparent', color: '#8B2020', border: '1px solid rgba(139,32,32,0.25)', cursor: 'pointer' }}>
                      {t('communityBoardDelete')}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => onMessage(p.owner_id, p.owner_name)}
                    className="flex items-center gap-1.5 font-sans font-semibold rounded-lg"
                    style={{ fontSize: 12, padding: '6px 12px', background: '#1F4D2B', color: '#F7F2E9', border: 'none', cursor: 'pointer' }}
                  >
                    <MessageCircle size={12} /> {t('communityMessageButton')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NewBoardPostForm({ myAreaText, onPosted, onCancel }: { myAreaText: string; onPosted: () => void; onCancel: () => void }) {
  const { t } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<BoardCategory>('seed');
  const [kind, setKind] = useState<BoardKind>('have');
  const [description, setDescription] = useState('');
  const [areaText, setAreaText] = useState(myAreaText);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadPhoto(file, 'board');
      if (url) setPhotoUrl(url);
    } finally { setUploading(false); }
  }

  async function handlePost() {
    if (!description.trim()) return;
    setPosting(true);
    try {
      await createBoardPost({ category, kind, description: description.trim(), photo_url: photoUrl, area_text: areaText.trim() });
      onPosted();
    } finally { setPosting(false); }
  }

  return (
    <div className="rounded-2xl p-4" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div className="font-sans uppercase tracking-widest" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.12em', marginBottom: 6 }}>{t('communityBoardKind')}</div>
        <div className="flex gap-2">
          {(['have', 'want', 'free'] as BoardKind[]).map((k) => (
            <button key={k} onClick={() => setKind(k)} className="font-sans font-semibold" style={{ flex: 1, padding: '8px', borderRadius: 10, fontSize: 12.5, cursor: 'pointer', background: kind === k ? KIND_COLOR[k] : 'rgba(226,216,196,0.5)', color: kind === k ? '#fff' : '#5C5040', border: `1px solid ${kind === k ? KIND_COLOR[k] : '#E2D8C4'}` }}>
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="font-sans uppercase tracking-widest" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.12em', marginBottom: 6 }}>{t('communityBoardCategory')}</div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as BoardCategory)}
          className="w-full rounded-xl px-3 py-2.5 font-sans"
          style={{ fontSize: 14, background: '#fff', border: '1px solid #D8CBB2', color: '#20190F' }}
        >
          {(Object.keys(CATEGORY_LABEL) as BoardCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>
      </div>
      <div>
        <div className="font-sans uppercase tracking-widest" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.12em', marginBottom: 6 }}>{t('communityBoardDescription')}</div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 300))}
          placeholder={t('communityBoardDescriptionPlaceholder')}
          rows={3}
          className="w-full rounded-xl px-3 py-2.5 font-sans"
          style={{ fontSize: 14, background: '#fff', border: '1px solid #D8CBB2', color: '#20190F', outline: 'none', resize: 'none', lineHeight: 1.5 }}
        />
      </div>
      <div>
        <div className="font-sans uppercase tracking-widest" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.12em', marginBottom: 6 }}>{t('communityAreaLabel')}</div>
        <input
          type="text"
          value={areaText}
          onChange={(e) => setAreaText(e.target.value)}
          placeholder={t('communityAreaPlaceholder')}
          className="w-full rounded-xl px-3 py-2.5 font-sans"
          style={{ fontSize: 14, background: '#fff', border: '1px solid #D8CBB2', color: '#20190F', outline: 'none' }}
        />
      </div>
      <div>
        {photoUrl ? (
          <div style={{ position: 'relative', width: 80, height: 80 }}>
            <img src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} />
            <button onClick={() => setPhotoUrl(null)} style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={12} color="#fff" />
            </button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-2 font-sans font-semibold rounded-xl" style={{ fontSize: 12.5, padding: '8px 12px', background: '#fff', border: '1px dashed #C8BCA8', color: '#5C5040', cursor: 'pointer' }}>
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />} Add photo (optional)
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="font-sans font-semibold rounded-xl" style={{ flex: 1, padding: '10px', fontSize: 13.5, background: 'transparent', border: '1px solid #D8CBB2', color: '#5C5040', cursor: 'pointer' }}>
          Cancel
        </button>
        <button onClick={handlePost} disabled={posting || !description.trim()} className="font-display font-semibold rounded-xl" style={{ flex: 2, padding: '10px', fontSize: 14, background: description.trim() ? '#1F4D2B' : 'rgba(32,25,15,0.1)', color: description.trim() ? '#F7F2E9' : '#94876F', border: 'none', cursor: description.trim() ? 'pointer' : 'default' }}>
          {posting ? <Loader2 size={14} className="animate-spin" style={{ margin: '0 auto' }} /> : t('communityBoardPost')}
        </button>
      </div>
    </div>
  );
}

function MessagesTab({ threads, myUid, onOpen }: { threads: MessageThread[]; myUid: string; onOpen: (id: string) => void }) {
  const { t } = useLanguage();
  if (threads.length === 0) {
    return (
      <div className="rounded-2xl px-4 py-10 text-center" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
        <MessageCircle size={26} style={{ color: '#8C7A62', margin: '0 auto 10px' }} strokeWidth={1.5} />
        <p className="font-sans" style={{ fontSize: 13, color: '#5C5040' }}>{t('communityMessagesEmpty')}</p>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {threads.map((th) => {
        const otherUid = th.participants.find((p) => p !== myUid) ?? '';
        const otherName = th.participant_names?.[otherUid] ?? 'Farmer';
        return (
          <button
            key={th.id}
            onClick={() => onOpen(th.id)}
            className="flex items-center gap-3 rounded-xl p-3 text-left w-full"
            style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', cursor: 'pointer' }}
          >
            <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, background: '#1F4D2B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#F7F2E9', fontWeight: 700, fontSize: 15 }}>{(otherName?.[0] ?? '?').toUpperCase()}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display font-semibold" style={{ fontSize: 14, color: '#20190F' }}>{otherName}</span>
                <span className="font-sans" style={{ fontSize: 11, color: '#8C7A62', flexShrink: 0 }}>{timeAgo(th.last_message_at)}</span>
              </div>
              <div className="font-sans truncate" style={{ fontSize: 12.5, color: '#5C5040' }}>{th.last_message || 'Say hello…'}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
