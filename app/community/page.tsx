'use client';

import workspace from '@/components/layout/Workspace.module.css';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, Loader2, MapPin, Plus, MessageCircle, User, Camera, X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { useAppLevel } from '@/lib/app-level';
import { communityEnabled } from '@/lib/community/flag';
import { uploadPhoto } from '@/lib/db/queries';
import { resizeFileForUpload } from '@/lib/site-evidence';
import {
  getMyCommunityProfile, listNearbyCommunityProfiles, listBoardPosts, createBoardPost,
  closeBoardPost, deleteBoardPost, listMyThreads, getOrCreateThread,
} from '@/lib/db/community-queries';
import type { CommunityProfile, BoardPost, BoardCategory, BoardKind, MessageThread } from '@/lib/db/types';
import NearbyMap from '@/components/community/NearbyMap';
import BrandLogo from '@/components/BrandLogo';
import TabBar from '@/components/TabBar';
import LessonLink from '@/components/design/LessonLink';
import MenuButton from '@/components/MenuButton';
import BackButton from '@/components/BackButton';

type Tab = 'nearby' | 'board' | 'messages';

const CATEGORY_LABEL: Record<BoardCategory, string> = {
  seed: 'Seed', seedlings: 'Seedlings', produce: 'Produce', tools: 'Tools', other: 'Other',
};
const KIND_LABEL: Record<BoardKind, string> = { have: 'Have', want: 'Want', free: 'Free' };
const KIND_COLOR: Record<BoardKind, string> = { have: 'var(--color-forest-800)', want: '#235E86', free: '#C07A1E' };

const zuCopy: Record<string, string> = {
  Nearby: 'Eduze nawe', Board: 'Ibhodi', Messages: 'Imiyalezo', Community: 'Umphakathi', 'Loading community': 'Kulayishwa umphakathi', 'My profile': 'Iphrofayela yami', 'Set up profile': 'Setha iphrofayela',
  "Couldn't load the community layer right now. Check your connection and try again.": 'Umphakathi awukwazanga ukulayishwa. Hlola uxhumano lwakho bese uzama futhi.',
  Retry: 'Zama futhi', 'Could not open this conversation. Check your connection and try again.': 'Ingxoxo ayikwazanga ukuvulwa. Hlola uxhumano lwakho bese uzama futhi.',
  'People and listings near you': 'Abantu nezikhangiso eziseduze nawe', 'No community profiles nearby yet.': 'Akukabikho amaphrofayela omphakathi aseduze.',
  'Community board': 'Ibhodi lomphakathi', 'New post': 'Isikhangiso esisha', 'Nothing on the board yet.': 'Akukabikho lutho ebhodini.',
  Close: 'Vala', Delete: 'Susa', Message: 'Thumela umlayezo', Have: 'Nginakho', Want: 'Ngifuna', Free: 'Mahhala',
  Seed: 'Imbewu', Seedlings: 'Izithombo', Produce: 'Umkhiqizo', Tools: 'Amathuluzi', Other: 'Okunye',
  'What are you offering or looking for?': 'Yini oyinikezayo noma oyifunayo?', 'Describe the item or request': 'Chaza into noma isicelo',
  Area: 'Indawo', 'Your area or town': 'Indawo noma idolobha lakho', 'Add photo (optional)': 'Faka isithombe (uma uthanda)',
  Cancel: 'Khansela', Post: 'Shicilela', 'Could not publish your post. Check your connection and try again.': 'Isikhangiso asikwazanga ukushicilelwa. Hlola uxhumano lwakho bese uzama futhi.',
  'No messages yet.': 'Akukabikho miyalezo.', 'Say hello…': 'Bingelela…', 'Learn': 'Funda',
  'More options': 'Izinketho ezengeziwe',
  'Farmers who choose to be visible show up here as an approximate area — never their exact homestead.': 'Abalimi abakhetha ukubonakala bavela lapha njengendawo elinganiselwe — akuboniswa ikhaya labo eliqondile.',
  'No farmers nearby have opted in yet.': 'Abekho abalimi abaseduze abakhethe ukubonakala okwamanje.', 'Trade board': 'Ibhodi lokuhwebelana',
  'Nothing posted yet — be the first.': 'Akukabikho okuthunyelwe — yiba ngowokuqala.', 'Category': 'Isigaba', 'Type': 'Uhlobo',
  'Description': 'Incazelo', 'e.g. Heirloom tomato seedlings, 20 available': 'isib. Izithombo zikatamatisi wendabuko, ezingama-20 ziyatholakala',
  'e.g. Bergville, KZN': 'isib. Bergville, KZN', 'Mark as done': 'Maka njengokuqediwe',
  'No conversations yet.': 'Akukabikho zingxoxo.', 'Couldn\'t post — check your connection and try again.': 'Akukwazanga ukuthunyelwa. Hlola uxhumano lwakho bese uzama futhi.',
  'Remove photo': 'Susa isithombe', 'Uploading photo…': 'Kulayishwa isithombe…', 'Posting…': 'Kuyathunyelwa…',
};
const copyCommunity = (en: string, lang: string) => lang === 'zu' ? (zuCopy[en] ?? en) : en;

const categoryLabel = (value: BoardCategory, lang: string) => lang === 'zu' ? ({ seed: 'Imbewu', seedlings: 'Izithombo', produce: 'Umkhiqizo', tools: 'Amathuluzi', other: 'Okunye' } as Record<BoardCategory, string>)[value] : CATEGORY_LABEL[value];
const kindLabel = (value: BoardKind, lang: string) => lang === 'zu' ? ({ have: 'Nginakho', want: 'Ngifuna', free: 'Mahhala' } as Record<BoardKind, string>)[value] : KIND_LABEL[value];

function timeAgo(ts: unknown, lang: string): string {
  const t = ts as { toDate?: () => Date; seconds?: number } | null;
  if (!t) return '';
  try {
    const d = typeof t.toDate === 'function' ? t.toDate() : new Date((t.seconds ?? 0) * 1000);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return lang === 'zu' ? 'Manje' : 'Just now';
    if (diff < 3_600_000) return lang === 'zu' ? `Emizuzwini engu-${Math.floor(diff / 60_000)} edlule` : `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return lang === 'zu' ? `Emahoreni angu-${Math.floor(diff / 3_600_000)} edlule` : `${Math.floor(diff / 3_600_000)}h ago`;
    return d.toLocaleDateString(lang === 'zu' ? 'zu-ZA' : 'en-ZA', { day: 'numeric', month: 'short' });
  } catch { return ''; }
}

export default function CommunityHubPage() {
  const { user, loading } = useAuth();
  const { t, lang } = useLanguage();
  const tr = (key: string) => copyCommunity(t(key), lang);
  const router = useRouter();
  const simple = useAppLevel() === 'simple';
  // Simple leads with the posts, not the people-nearby map, and drops the Messages tab from the
  // top nav — a farmer reaches a conversation directly via "Send a message" on a post or a
  // profile, or by switching to All tools to see the full list.
  const TABS: Tab[] = simple ? ['board', 'nearby'] : ['nearby', 'board', 'messages'];

  const [tab, setTab] = useState<Tab>(simple ? 'board' : 'nearby');
  const [myProfile, setMyProfile] = useState<CommunityProfile | null>(null);
  const [nearby, setNearby] = useState<CommunityProfile[]>([]);
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [busy, setBusy] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showNewPost, setShowNewPost] = useState(false);
  const [openingThread, setOpeningThread] = useState(false);
  const [threadError, setThreadError] = useState(false);

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

  // Switching to Simple mid-session (e.g. from Settings) drops the Messages tab from the nav —
  // if it was the active tab, land somewhere still reachable rather than a panel with no
  // highlighted tab button.
  useEffect(() => { if (simple && tab === 'messages') setTab('board'); }, [simple, tab]);

  // getOrCreateThread() is a Firestore round trip. On a weak signal it can
  // reject, and an uncaught rejection here used to mean tapping "Message" on
  // a board post simply did nothing — no navigation, no error, a dead button.
  async function handleOpenThread(otherUid: string, otherName: string) {
    if (openingThread) return;
    setOpeningThread(true);
    setThreadError(false);
    try {
      const id = await getOrCreateThread(otherUid, otherName);
      if (id) { router.push(`/community/messages/${id}`); return; }
      setThreadError(true);
    } catch (err) {
      console.error('getOrCreateThread failed', err);
      setThreadError(true);
    } finally {
      setOpeningThread(false);
    }
  }

  if (!communityEnabled() || loading || !user) {
    return (
      <div className="h-[100dvh] flex items-center justify-center" style={{ background: 'var(--bg-0)' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-forest-800)' }} />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col font-sans" style={{ background: 'var(--bg-0)', color: 'var(--text-primary)' }}>
      <header className="flex-shrink-0 flex items-center gap-3 px-4" style={{ height: 56, borderBottom: '1px solid var(--border)', background: 'var(--bg-1)' }}>
        <MenuButton /><BackButton fallback="/home" />
        <Link href="/home" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)', textDecoration: 'none' }}>
          <ChevronLeft size={18} strokeWidth={1.7} />
        </Link>
        <BrandLogo />
        <div style={{ flex: 1 }} />
        <LessonLink id="community:overview" label={copyCommunity('Learn', lang)} />
        <Link href="/community/profile" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-forest-800)', textDecoration: 'none' }}>
          <User size={16} strokeWidth={1.8} />
          <span className="font-sans font-semibold" style={{ fontSize: 13 }}>
            {copyCommunity(myProfile ? 'My profile' : 'Set up profile', lang)}
          </span>
        </Link>
      </header>

      <div className="flex-shrink-0 flex" role="tablist" aria-label={copyCommunity('Community', lang)} style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-1)' }}>
        {TABS.map((tb) => (
          <button
            key={tb}
            role="tab"
            aria-selected={tab === tb}
            aria-controls="community-tab-panel"
            id={`community-tab-${tb}`}
            onClick={() => setTab(tb)}
            className="flex-1 font-sans font-semibold"
            style={{
              padding: '12px 8px', fontSize: 13.5, background: 'transparent', border: 'none', cursor: 'pointer',
              color: tab === tb ? 'var(--color-forest-800)' : 'var(--text-muted)',
              borderBottom: tab === tb ? '2.5px solid var(--color-forest-800)' : '2.5px solid transparent',
            }}
          >
            {tr(tb === 'nearby' ? 'communityTabNearby' : tb === 'board' ? 'communityTabBoard' : 'communityTabMessages')}
          </button>
        ))}
      </div>

      <main id="community-tab-panel" role="tabpanel" aria-labelledby={`community-tab-${tab}`} className={`${workspace.workspace} flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6`}>
        {loadError && !busy && (
          <div className="flex items-center justify-between gap-3 rounded-xl" style={{ padding: '10px 14px', marginBottom: 14, background: 'color-mix(in srgb, var(--danger) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)' }}>
            <span role="alert" className="font-sans" style={{ fontSize: 12.5, color: 'var(--danger)' }}>{tr('communityLoadError')}</span>
            <button
              onClick={() => refresh()}
              className="font-sans font-semibold"
              style={{ fontSize: 12, color: 'var(--color-forest-800)', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', flexShrink: 0 }}
            >
              {tr('communityRetry')}
            </button>
          </div>
        )}
        {threadError && (
          <div className="rounded-xl" style={{ padding: '10px 14px', marginBottom: 14, background: 'color-mix(in srgb, var(--danger) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)' }}>
            <span role="alert" className="font-sans" style={{ fontSize: 12.5, color: 'var(--danger)' }}>{tr('communityContactError')}</span>
          </div>
        )}
        {busy ? (
          <div role="status" aria-label={copyCommunity('Loading community', lang)} className="flex justify-center py-16"><Loader2 size={22} className="animate-spin" style={{ color: 'var(--color-forest-800)' }} /></div>
        ) : tab === 'nearby' ? (
          <NearbyTab nearby={nearby} onOpenProfile={(uid) => router.push(`/community/u/${uid}`)} />
        ) : tab === 'board' ? (
          <BoardTab
            posts={posts}
            myUid={user.uid}
            simple={simple}
            showNewPost={showNewPost}
            onToggleNewPost={() => setShowNewPost((s) => !s)}
            myAreaText={myProfile?.area_text ?? ''}
            onPosted={async () => { setShowNewPost(false); await refresh(); }}
            onClose={async (id) => { await closeBoardPost(id); await refresh(); }}
            onDelete={async (id) => { await deleteBoardPost(id); await refresh(); }}
            onMessage={handleOpenThread}
            messagingBusy={openingThread}
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
  const { t, lang } = useLanguage();
  const tr = (key: string) => copyCommunity(t(key), lang);
  const locationPrivacy = lang === 'zu'
    ? `${t('communityNearbyIntro')} / Farmers who choose to be visible show up here as an approximate area — never their exact homestead.`
    : t('communityNearbyIntro');
  const pinned = nearby.filter((p) => p.show_on_map);
  return (
    <div>
      <p className="font-sans" style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 14 }}>
        {locationPrivacy}
      </p>
      {pinned.length > 0 && (
        <div style={{ height: 'clamp(260px, 35vw, 440px)', marginBottom: 16 }}>
          <NearbyMap people={pinned} onOpenProfile={onOpenProfile} />
        </div>
      )}
      {nearby.length === 0 ? (
        <div className="rounded-2xl px-4 py-10 text-center" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
          <MapPin size={26} style={{ color: 'var(--text-muted)', margin: '0 auto 10px' }} strokeWidth={1.5} />
          <p className="font-sans" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{tr('communityNearbyEmpty')}</p>
        </div>
      ) : (
        <div className={workspace.cards}>
          {nearby.map((p) => (
            <button
              key={p.uid}
              onClick={() => onOpenProfile(p.uid)}
              className="flex items-center gap-3 rounded-xl p-3 text-left w-full"
              style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', cursor: 'pointer' }}
            >
              <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--color-forest-800)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {p.photos?.[0]
                  ? <img data-photo-preview src={p.photos[0]} alt={p.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ color: 'var(--color-canvas)', fontWeight: 700, fontSize: 15 }}>{(p.display_name?.[0] ?? '?').toUpperCase()}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="font-display font-semibold" style={{ fontSize: 14, color: 'var(--text-primary)' }}>{p.display_name}</div>
                <div className="font-sans" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.area_text || '—'}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BoardTab({
  posts, myUid, simple, showNewPost, onToggleNewPost, myAreaText, onPosted, onClose, onDelete, onMessage, messagingBusy,
}: {
  posts: BoardPost[]; myUid: string; simple: boolean; showNewPost: boolean; onToggleNewPost: () => void; myAreaText: string;
  onPosted: () => void; onClose: (id: string) => void; onDelete: (id: string) => void;
  onMessage: (uid: string, name: string) => void; messagingBusy: boolean;
}) {
  const { t, lang } = useLanguage();
  const tr = (key: string) => copyCommunity(t(key), lang);
  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
        <h1 className="font-display font-bold" style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)' }}>{tr('communityBoardTitle')}</h1>
        <button
          onClick={onToggleNewPost}
          className="flex items-center gap-1.5 font-display font-semibold rounded-xl"
          style={{ background: 'var(--color-forest-800)', color: 'var(--color-canvas)', border: 'none', cursor: 'pointer', padding: '8px 14px', fontSize: 13 }}
        >
          <Plus size={14} /> {tr('communityBoardNewPost')}
        </button>
      </div>

      {showNewPost && <NewBoardPostForm myAreaText={myAreaText} simple={simple} onPosted={onPosted} onCancel={onToggleNewPost} />}

      {posts.length === 0 ? (
        <div className="rounded-2xl px-4 py-10 text-center" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
          <p className="font-sans" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{tr('communityBoardEmpty')}</p>
        </div>
      ) : (
        <div className={workspace.cards}>
          {posts.map((p) => (
            <div key={p.id} className="rounded-2xl p-4" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
                <span className="font-sans font-bold" style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 100, background: KIND_COLOR[p.kind], color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {kindLabel(p.kind, lang)}
                </span>
                <span className="font-sans" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{categoryLabel(p.category, lang)}</span>
                <div style={{ flex: 1 }} />
                <span className="font-sans" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timeAgo(p.created_at, lang)}</span>
              </div>
              {p.photo_url && (
                <img data-photo-preview src={p.photo_url} alt="" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 10, marginBottom: 8 }} />
              )}
              <p className="font-sans" style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 6 }}>{p.description}</p>
              <div className="flex items-center gap-1.5" style={{ marginBottom: 10 }}>
                <MapPin size={11} style={{ color: 'var(--text-muted)' }} />
                <span className="font-sans" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.area_text} · {p.owner_name}</span>
              </div>
              <div className="flex items-center gap-2">
                {p.owner_id === myUid ? (
                  <>
                    <button onClick={() => onClose(p.id)} className="font-sans font-semibold rounded-lg" style={{ fontSize: 12, padding: '6px 12px', background: 'color-mix(in srgb, var(--color-forest-800) 8%, transparent)', color: 'var(--color-forest-800)', border: '1px solid color-mix(in srgb, var(--color-forest-800) 20%, transparent)', cursor: 'pointer' }}>
                      {tr('communityBoardClose')}
                    </button>
                    <button onClick={() => onDelete(p.id)} className="font-sans font-semibold rounded-lg" style={{ fontSize: 12, padding: '6px 12px', background: 'transparent', color: 'var(--danger)', border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)', cursor: 'pointer' }}>
                      {tr('communityBoardDelete')}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => onMessage(p.owner_id, p.owner_name)}
                    disabled={messagingBusy}
                    className="flex items-center gap-1.5 font-sans font-semibold rounded-lg"
                    style={{ fontSize: 12, padding: '6px 12px', background: 'var(--color-forest-800)', color: 'var(--color-canvas)', border: 'none', cursor: messagingBusy ? 'default' : 'pointer', opacity: messagingBusy ? 0.7 : 1 }}
                  >
                    {messagingBusy ? <Loader2 size={12} className="animate-spin" /> : <MessageCircle size={12} />}
                    {tr('communityMessageButton')}
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

function NewBoardPostForm({ myAreaText, simple, onPosted, onCancel }: { myAreaText: string; simple: boolean; onPosted: () => void; onCancel: () => void }) {
  const { t, lang } = useLanguage();
  const tr = (key: string) => copyCommunity(t(key), lang);
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<BoardCategory>('seed');
  const [kind, setKind] = useState<BoardKind>('have');
  const [description, setDescription] = useState('');
  const [areaText, setAreaText] = useState(myAreaText);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  // Simple keeps the essentials — what, a photo, send — and tucks Type/Category/Area (each
  // already has a sensible default: 'have', 'seed', the farmer's own area) behind one disclosure.
  const optionsExpanded = !simple || showMoreOptions;

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadPhoto(await resizeFileForUpload(file), 'board');
      if (url) setPhotoUrl(url);
    } finally { setUploading(false); }
  }

  // createBoardPost() is a Firestore write and can reject on a weak signal.
  // Before this caught it, tapping Post on a bad connection just closed the
  // spinner and sat there — no confirmation, no error, nothing to tell a
  // farmer whether the listing they just typed actually went anywhere.
  async function handlePost() {
    if (!description.trim()) return;
    setPosting(true);
    setPostError(false);
    try {
      await createBoardPost({ category, kind, description: description.trim(), photo_url: photoUrl, area_text: areaText.trim() });
      onPosted();
    } catch (err) {
      console.error('createBoardPost failed', err);
      setPostError(true);
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {optionsExpanded && (
        <div>
          <div className="font-sans uppercase tracking-widest" style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 6 }}>{tr('communityBoardKind')}</div>
          <div className="flex gap-2">
            {(['have', 'want', 'free'] as BoardKind[]).map((k) => (
              <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k} className="font-sans font-semibold" style={{ flex: 1, padding: '8px', borderRadius: 10, fontSize: 12.5, cursor: 'pointer', background: kind === k ? KIND_COLOR[k] : 'rgba(226,216,196,0.5)', color: kind === k ? '#fff' : 'var(--text-secondary)', border: `1px solid ${kind === k ? KIND_COLOR[k] : 'var(--border)'}` }}>
                {kindLabel(k, lang)}
              </button>
            ))}
          </div>
        </div>
      )}
      {optionsExpanded && (
        <div>
          <div className="font-sans uppercase tracking-widest" style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 6 }}>{tr('communityBoardCategory')}</div>
          <select
            value={category}
            aria-label={tr('communityBoardCategory')}
            onChange={(e) => setCategory(e.target.value as BoardCategory)}
            className="w-full rounded-xl px-3 py-2.5 font-sans"
            style={{ fontSize: 14, background: 'var(--bg-1)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
          >
            {(Object.keys(CATEGORY_LABEL) as BoardCategory[]).map((c) => <option key={c} value={c}>{categoryLabel(c, lang)}</option>)}
          </select>
        </div>
      )}
      <div>
        <div className="font-sans uppercase tracking-widest" style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 6 }}>{tr('communityBoardDescription')}</div>
        <textarea
          value={description}
          aria-label={tr('communityBoardDescription')}
          onChange={(e) => setDescription(e.target.value.slice(0, 300))}
          placeholder={tr('communityBoardDescriptionPlaceholder')}
          rows={3}
          className="w-full rounded-xl px-3 py-2.5 font-sans"
          style={{ fontSize: 14, background: 'var(--bg-1)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)', outline: 'none', resize: 'none', lineHeight: 1.5 }}
        />
      </div>
      {optionsExpanded && (
        <div>
          <div className="font-sans uppercase tracking-widest" style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.12em', marginBottom: 6 }}>{tr('communityAreaLabel')}</div>
          <input
            type="text"
            value={areaText}
            aria-label={tr('communityAreaLabel')}
            onChange={(e) => setAreaText(e.target.value)}
            placeholder={tr('communityAreaPlaceholder')}
            className="w-full rounded-xl px-3 py-2.5 font-sans"
            style={{ fontSize: 14, background: 'var(--bg-1)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)', outline: 'none' }}
          />
        </div>
      )}
      {!optionsExpanded && (
        <button
          type="button"
          onClick={() => setShowMoreOptions(true)}
          className="font-sans font-semibold text-left"
          style={{ fontSize: 13, color: 'var(--color-forest-800)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          + {copyCommunity('More options', lang)}
        </button>
      )}
      <div>
        {photoUrl ? (
          <div style={{ position: 'relative', width: 80, height: 80 }}>
            <img data-photo-preview src={photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} />
            <button onClick={() => setPhotoUrl(null)} aria-label={copyCommunity('Remove photo', lang)} style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={12} color="#fff" />
            </button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-2 font-sans font-semibold rounded-xl" style={{ fontSize: 12.5, padding: '8px 12px', background: 'var(--bg-1)', border: '1px dashed var(--border-strong)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />} {uploading ? copyCommunity('Uploading photo…', lang) : copyCommunity('Add photo (optional)', lang)}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
      </div>
      {postError && (
        <p role="alert" className="font-sans" style={{ fontSize: 12, color: 'var(--danger)', margin: 0 }}>
          {tr('communityPostError')}
        </p>
      )}
      <div className="flex gap-2">
        <button onClick={onCancel} className="font-sans font-semibold rounded-xl" style={{ flex: 1, padding: '10px', fontSize: 13.5, background: 'transparent', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          {copyCommunity('Cancel', lang)}
        </button>
          <button onClick={handlePost} disabled={posting || !description.trim()} aria-busy={posting} className="font-display font-semibold rounded-xl" style={{ flex: 2, padding: '10px', fontSize: 14, background: description.trim() ? 'var(--color-forest-800)' : 'rgba(32,25,15,0.1)', color: description.trim() ? 'var(--color-canvas)' : 'var(--text-muted)', border: 'none', cursor: description.trim() ? 'pointer' : 'default' }}>
          {posting ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" />{copyCommunity('Posting…', lang)}</span> : tr('communityBoardPost')}
        </button>
      </div>
    </div>
  );
}

function MessagesTab({ threads, myUid, onOpen }: { threads: MessageThread[]; myUid: string; onOpen: (id: string) => void }) {
  const { t, lang } = useLanguage();
  if (threads.length === 0) {
    return (
      <div className="rounded-2xl px-4 py-10 text-center" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
        <MessageCircle size={26} style={{ color: 'var(--text-muted)', margin: '0 auto 10px' }} strokeWidth={1.5} />
        <p className="font-sans" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{copyCommunity(t('communityMessagesEmpty'), lang)}</p>
      </div>
    );
  }
  return (
    <div className={workspace.cards}>
      {threads.map((th) => {
        const otherUid = th.participants.find((p) => p !== myUid) ?? '';
        const otherName = th.participant_names?.[otherUid] ?? 'Farmer';
        return (
          <button
            key={th.id}
            onClick={() => onOpen(th.id)}
            className="flex items-center gap-3 rounded-xl p-3 text-left w-full"
            style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', cursor: 'pointer' }}
          >
            <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, background: 'var(--color-forest-800)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'var(--color-canvas)', fontWeight: 700, fontSize: 15 }}>{(otherName?.[0] ?? '?').toUpperCase()}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display font-semibold" style={{ fontSize: 14, color: 'var(--text-primary)' }}>{otherName}</span>
                <span className="font-sans" style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{timeAgo(th.last_message_at, lang)}</span>
              </div>
              <div className="font-sans truncate" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{th.last_message || copyCommunity('Say hello…', lang)}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
