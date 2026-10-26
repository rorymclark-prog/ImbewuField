'use client';

import workspace from '@/components/layout/Workspace.module.css';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  Loader2, MapPin, Plus, MessageCircle, User, Camera, X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { translate,useLanguage } from '@/lib/i18n';
import LanguageDraftNote from '@/components/LanguageDraftNote';
import { communityTimeAgo } from '@/lib/community-time';
import { useAppLevel } from '@/lib/app-level';
import { communityEnabled } from '@/lib/community/flag';
import { uploadPhoto } from '@/lib/db/queries';
import { resizeFileForUpload } from '@/lib/site-evidence';
import {
  getMyCommunityProfile, listNearbyCommunityProfiles, listBoardPosts, createBoardPost,
  closeBoardPost, deleteBoardPost, listMyThreads, getOrCreateThread,
} from '@/lib/db/community-queries';
import type { CommunityProfile, BoardPost, BoardCategory, BoardKind, MessageThread } from '@/lib/db/types';
// perf-06: mapbox only loads once the Nearby tab actually renders a map, not with the rest of
// Community (Board/Messages never touch it).
const NearbyMap = dynamic(() => import('@/components/community/NearbyMap'), {
  ssr: false,
  loading: NearbyMapLoading,
});
import TabBar from '@/components/TabBar';
import LessonLink from '@/components/design/LessonLink';
import AppHeader from '@/components/layout/AppHeader';

type Tab = 'nearby' | 'board' | 'messages';

function NearbyMapLoading(){
  const {t}=useLanguage();
  return <div role="status" aria-label={t('communityHubLoading')} className="w-full h-full flex flex-col gap-3 items-center justify-center rounded-2xl" style={{background:'var(--bg-1)',color:'var(--text-secondary)'}}><Loader2 size={24} className="animate-spin" aria-hidden/><p>{t('communityHubLoading')}</p></div>;
}

const CATEGORY_LABEL: Record<BoardCategory, string> = {
  seed: 'Seed', seedlings: 'Seedlings', produce: 'Produce', tools: 'Tools', other: 'Other',
};
const KIND_LABEL: Record<BoardKind, string> = { have: 'Have', want: 'Want', free: 'Free' };
const KIND_COLOR: Record<BoardKind, string> = { have: 'var(--color-forest-800)', want: '#235E86', free: 'color-mix(in srgb, var(--gold) 12%, var(--bg-1))' };
// White read 2.04:1 on dark Have and 3.47:1 on Free; a themed gold tint keeps Free readable in each theme.
const KIND_TEXT:Record<BoardKind,string>={have:'var(--color-canvas)',want:'var(--on-forest)',free:'var(--text-primary)'};

type CommunityTranslate=(key:string)=>string;
const categoryLabel=(value:BoardCategory,t:CommunityTranslate)=>t(({seed:'communityCategorySeed',seedlings:'communityCategorySeedlings',produce:'communityCategoryProduce',tools:'communityCategoryTools',other:'communityCategoryOther'})[value]);
const kindLabel=(value:BoardKind,t:CommunityTranslate)=>t(({have:'communityBoardKindHave',want:'communityBoardKindWant',free:'communityBoardKindFree'})[value]);
function CommunitySource({id}:{id:string}) {
  const {t,lang}=useLanguage();
  return <><span lang={t(id)===translate('en',id)?'en':lang}>{t(id)}</span>{['zu','st','ts','ve'].includes(lang)&&<small lang="en" style={{display:'block',fontSize:12,lineHeight:1.4,marginTop:4}}><span lang={lang}>{t('offlineSourceLabel')}: </span>{translate('en',id)}</small>}</>;
}

export default function CommunityHubPage() {
  const { user, loading } = useAuth();
  const { t, lang } = useLanguage();
  const tr = t;
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
  const [failedReads,setFailedReads]=useState({profile:false,nearby:false,posts:false,threads:false});
  const refreshEpoch=useRef(0);
  const ownerRef=useRef(user?.uid);
  if(ownerRef.current!==user?.uid){ownerRef.current=user?.uid;refreshEpoch.current++;}
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
    const epoch=++refreshEpoch.current;
    const owner=user.uid;
    setBusy(true);
    const [mp, nb, bp, th] = await Promise.allSettled([
      getMyCommunityProfile(), listNearbyCommunityProfiles(), listBoardPosts(), listMyThreads(),
    ]);
    // A delayed reply must not expose the previous owner’s private conversation list.
    if(refreshEpoch.current!==epoch||ownerRef.current!==owner)return;
    setFailedReads({profile:mp.status==='rejected',nearby:nb.status==='rejected',posts:bp.status==='rejected',threads:th.status==='rejected'});
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
      <div lang={lang} role="status" aria-label={t('communityHubLoading')} className="h-[100dvh] flex flex-col gap-3 items-center justify-center" style={{ background: 'var(--bg-0)' }}>
        <Loader2 size={24} className="animate-spin" aria-hidden style={{ color: 'var(--color-forest-800)' }} /><p>{t('communityHubLoading')}</p>
      </div>
    );
  }

  return (
    <div lang={lang} className="h-[100dvh] flex flex-col font-sans" style={{ background: 'var(--bg-0)', color: 'var(--text-primary)' }}>
      <AppHeader
        title={t('communityHubTitle')}
        right={
          <>
            <LessonLink id="community:overview" label={t('homeLearnAction')} />
            <Link href="/community/profile" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-forest-800)', textDecoration: 'none' }}>
              <User size={16} strokeWidth={1.8} />
              <span className="font-sans font-semibold" style={{ fontSize: 13 }}>
                {t(myProfile||failedReads.profile?'communityHubMyProfile':'communityHubSetupProfile')}
              </span>
            </Link>
          </>
        }
      />
      <div className="px-4 pt-3"><LanguageDraftNote lang={lang} scope="community-hub"/></div>
      {/* nav-17: AppHeader's title is a <span>, not a heading — this page had no h1 before
          either (the tabs below carried no accessible page name), so give it one now. */}
      <h1 className="sr-only">{t('communityHubTitle')}</h1>

      <div className="flex-shrink-0 flex" role="tablist" aria-label={t('communityHubTitle')} style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-1)' }}>
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl" style={{ padding: '10px 14px', marginBottom: 14, background: 'color-mix(in srgb, var(--danger) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)' }}>
            <span role="alert" className="font-sans" style={{ fontSize: 12.5, color: 'var(--text-primary)' }}><CommunitySource id="communityLoadError"/></span>
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
            <span role="alert" className="font-sans" style={{ fontSize: 12.5, color: 'var(--text-primary)' }}><CommunitySource id="communityContactError"/></span>
          </div>
        )}
        {busy ? (
          <div role="status" aria-label={t('communityHubLoading')} className="flex justify-center py-16"><Loader2 size={22} className="animate-spin" style={{ color: 'var(--color-forest-800)' }} /></div>
        ) : failedReads[tab==='board'?'posts':tab==='messages'?'threads':'nearby'] ? null : tab === 'nearby' ? (
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

      <TabBar hideAtDesktop />
    </div>
  );
}

function NearbyTab({ nearby, onOpenProfile }: { nearby: CommunityProfile[]; onOpenProfile: (uid: string) => void }) {
  const { t, lang } = useLanguage();
  const tr = t;
  const pinned = nearby.filter((p) => p.show_on_map);
  return (
    <div>
      <p className="font-sans" style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 14 }}>
        <CommunitySource id="communityNearbyIntro"/>
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
                  ? <img data-photo-preview src={p.photos[0]} alt={p.display_name} lang="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ color: 'var(--color-canvas)', fontWeight: 700, fontSize: 15 }}>{(p.display_name?.[0] ?? '?').toUpperCase()}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div lang="" className="font-display font-semibold" style={{ fontSize: 14, color: 'var(--text-primary)' }}>{p.display_name}</div>
                <div lang="" className="font-sans" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.area_text || '—'}</div>
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
  onPosted: () => void; onClose: (id: string) => Promise<void>; onDelete: (id: string) => Promise<void>;
  onMessage: (uid: string, name: string) => void; messagingBusy: boolean;
}) {
  const { t, lang } = useLanguage();
  const tr = t;
  const [pendingPost,setPendingPost]=useState<string|null>(null);
  const [actionError,setActionError]=useState<'communityBoardCloseError'|'communityBoardDeleteError'|null>(null);
  async function actOnPost(id:string,remove:boolean){
    if(pendingPost)return;
    setPendingPost(id);setActionError(null);
    try{await(remove?onDelete(id):onClose(id));}
    catch{setActionError(remove?'communityBoardDeleteError':'communityBoardCloseError');}
    finally{setPendingPost(null);}
  }
  return (
    <div>
      {actionError&&<p role="alert" style={{color:'var(--text-primary)',borderInlineStart:'3px solid var(--danger)',paddingInlineStart:8}}><CommunitySource id={actionError}/></p>}
      <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
        <h1 className="font-display font-bold" style={{ margin: 0, fontSize: 18, color: 'var(--text-primary)' }}>{tr('communityBoardTitle')}</h1>
        <button
          onClick={onToggleNewPost}
          className="flex items-center gap-1.5 font-display font-semibold rounded-xl"
          style={{ minHeight:44, background: 'var(--color-forest-800)', color: 'var(--color-canvas)', border: 'none', cursor: 'pointer', padding: '8px 14px', fontSize: 13 }}
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
                <span className="font-sans font-bold" style={{ fontSize: 12, padding: '2px 8px', borderRadius: 100, background: KIND_COLOR[p.kind], color: KIND_TEXT[p.kind], textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {kindLabel(p.kind,t)}
                </span>
                <span className="font-sans" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{categoryLabel(p.category,t)}</span>
                <div style={{ flex: 1 }} />
                <span className="font-sans" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{communityTimeAgo(p.created_at,lang,t)}</span>
              </div>
              {/* The caption identifies the farmer's photo without translating their name. */}
              {p.photo_url && (
                <img data-photo-preview src={p.photo_url} alt={t('communityBoardPhotoAlt').replace(/\{name\}/g,()=>p.owner_name)} style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 10, marginBottom: 8 }} />
              )}
              <p lang="" className="font-sans" style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 6 }}>{p.description}</p>
              <div className="flex items-center gap-1.5" style={{ marginBottom: 10 }}>
                <MapPin size={11} style={{ color: 'var(--text-muted)' }} />
                <span lang="" className="font-sans" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.area_text} · {p.owner_name}</span>
              </div>
              <div className="flex items-center gap-2">
                {p.owner_id === myUid ? (
                  <>
                    <button onClick={() => actOnPost(p.id,false)} disabled={pendingPost!==null} aria-busy={pendingPost===p.id} className="font-sans font-semibold rounded-lg" style={{ minHeight:44, fontSize: 12, padding: '6px 12px', background: 'color-mix(in srgb, var(--color-forest-800) 8%, transparent)', color: 'var(--color-forest-800)', border: '1px solid color-mix(in srgb, var(--color-forest-800) 20%, transparent)', cursor: 'pointer' }}>
                      {tr('communityBoardClose')}
                    </button>
                    <button onClick={() => actOnPost(p.id,true)} disabled={pendingPost!==null} aria-busy={pendingPost===p.id} className="font-sans font-semibold rounded-lg" style={{ minHeight:44, fontSize: 12, padding: '6px 12px', background: 'transparent', color: 'var(--text-primary)', border: '1px solid color-mix(in srgb, var(--danger) 25%, transparent)', cursor: 'pointer' }}>
                      {tr('communityBoardDelete')}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => onMessage(p.owner_id, p.owner_name)}
                    disabled={messagingBusy}
                    className="flex items-center gap-1.5 font-sans font-semibold rounded-lg"
                    style={{ minHeight:44, fontSize: 12, padding: '6px 12px', background: 'var(--color-forest-800)', color: 'var(--color-canvas)', border: 'none', cursor: messagingBusy ? 'default' : 'pointer', opacity: messagingBusy ? 0.7 : 1 }}
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
  const tr = t;
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<BoardCategory>('seed');
  const [kind, setKind] = useState<BoardKind>('have');
  const [description, setDescription] = useState('');
  const [areaText, setAreaText] = useState(myAreaText);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState(false);
  const [photoError,setPhotoError]=useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  // Simple keeps the essentials — what, a photo, send — and tucks Type/Category/Area (each
  // already has a sensible default: 'have', 'seed', the farmer's own area) behind one disclosure.
  const optionsExpanded = !simple || showMoreOptions;

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if(uploading)return;
    setUploading(true);setPhotoError(false);
    try {
      const url = await uploadPhoto(await resizeFileForUpload(file), 'board');
      if (url) setPhotoUrl(url);else setPhotoError(true);
    } catch {setPhotoError(true);}
    finally {setUploading(false);if(fileRef.current)fileRef.current.value='';}
  }

  // createBoardPost() is a Firestore write and can reject on a weak signal.
  // Before this caught it, tapping Post on a bad connection just closed the
  // spinner and sat there — no confirmation, no error, nothing to tell a
  // farmer whether the listing they just typed actually went anywhere.
  async function handlePost() {
    if (!description.trim()||posting) return;
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
          <div className="font-sans uppercase tracking-widest" style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 6 }}>{tr('communityBoardKind')}</div>
          <div className="flex gap-2">
            {(['have', 'want', 'free'] as BoardKind[]).map((k) => (
              <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k} className="font-sans font-semibold" style={{ minHeight:44, flex: 1, padding: '8px', borderRadius: 10, fontSize: 12.5, cursor: 'pointer', background: kind === k ? KIND_COLOR[k] : 'var(--bg-2)', color: kind === k ? KIND_TEXT[k] : 'var(--text-primary)', border: `1px solid ${kind === k ? (k==='free'?'var(--gold)':KIND_COLOR[k]) : 'var(--border)'}` }}>
                {kindLabel(k,t)}
              </button>
            ))}
          </div>
        </div>
      )}
      {optionsExpanded && (
        <div>
          <label htmlFor="community-board-category" className="block font-sans uppercase tracking-widest" style={{fontSize:12,color:'var(--text-muted)',marginBottom:6}}>{tr('communityBoardCategory')}</label>
          <select id="community-board-category"
            value={category}
            aria-label={tr('communityBoardCategory')}
            onChange={(e) => setCategory(e.target.value as BoardCategory)}
            className="w-full rounded-xl px-3 py-2.5 font-sans"
            style={{ fontSize: 14, background: 'var(--bg-1)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
          >
            {(Object.keys(CATEGORY_LABEL) as BoardCategory[]).map((c) => <option key={c} value={c}>{categoryLabel(c,t)}</option>)}
          </select>
        </div>
      )}
      <div>
        <label htmlFor="community-board-description" className="block font-sans uppercase tracking-widest" style={{fontSize:12,color:'var(--text-muted)',marginBottom:6}}>{tr('communityBoardDescription')}</label>
        <textarea id="community-board-description" lang=""
          value={description}
          aria-label={tr('communityBoardDescription')}
          readOnly={posting} onChange={(e) => {if(!posting)setDescription(e.target.value.slice(0,300));}}
          placeholder={tr('communityBoardDescriptionPlaceholder')}
          rows={3}
          className="w-full rounded-xl px-3 py-2.5 font-sans focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
          style={{ fontSize: 14, background: 'var(--bg-1)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)', outline: 'none', resize: 'none', lineHeight: 1.5 }}
        />
      </div>
      {optionsExpanded && (
        <div>
          <label htmlFor="community-board-area" className="block font-sans uppercase tracking-widest" style={{fontSize:12,color:'var(--text-muted)',marginBottom:6}}>{tr('communityAreaLabel')}</label>
          <input id="community-board-area" lang=""
            type="text"
            value={areaText}
            aria-label={tr('communityAreaLabel')}
            readOnly={posting} onChange={(e) => {if(!posting)setAreaText(e.target.value);}}
            placeholder={tr('communityAreaPlaceholder')}
            className="w-full rounded-xl px-3 py-2.5 font-sans focus-visible:ring-2 focus-visible:ring-[var(--gold)]"
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
          + {t('communityBoardMoreOptions')}
        </button>
      )}
      <div>
        {photoUrl ? (
          <div style={{ position: 'relative', width: 80, height: 80 }}>
            <img data-photo-preview src={photoUrl} alt={t('communityBoardPhotoPreview')} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} />
            <button onClick={() => setPhotoUrl(null)} aria-label={t('communityBoardRemovePhoto')} style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={12} color="#fff" />
            </button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} disabled={uploading} aria-busy={uploading} className="flex items-center gap-2 font-sans font-semibold rounded-xl" style={{ fontSize: 12.5, padding: '8px 12px', background: 'var(--bg-1)', border: '1px dashed var(--border-strong)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />} {uploading ? t('communityBoardUploadingPhoto') : t('communityBoardAddPhoto')}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
      </div>
      {photoError&&<p role="alert" style={{color:'var(--text-primary)',borderInlineStart:'3px solid var(--danger)',paddingInlineStart:8}}><CommunitySource id="communityPhotoUploadError"/></p>}
      {postError && (
        <p role="alert" className="font-sans" style={{ fontSize:12,color:'var(--text-primary)',borderInlineStart:'3px solid var(--danger)',paddingInlineStart:8,margin:0 }}>
          <CommunitySource id="communityPostError"/>
        </p>
      )}
      <div className="flex gap-2">
        <button onClick={onCancel} className="font-sans font-semibold rounded-xl" style={{ flex: 1, padding: '10px', fontSize: 13.5, background: 'transparent', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          {t('cancelBtn')}
        </button>
          <button onClick={handlePost} disabled={posting || !description.trim()} aria-busy={posting} className="font-display font-semibold rounded-xl" style={{ flex: 2, padding: '10px', fontSize: 14, background: description.trim() ? 'var(--color-forest-800)' : 'rgba(32,25,15,0.1)', color: description.trim() ? 'var(--color-canvas)' : 'var(--text-muted)', border: 'none', cursor: description.trim() ? 'pointer' : 'default' }}>
          {posting ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" />{t('communityBoardPosting')}</span> : tr('communityBoardPost')}
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
        <p className="font-sans" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('communityMessagesEmpty')}</p>
      </div>
    );
  }
  return (
    <div className={workspace.cards}>
      {threads.map((th) => {
        const otherUid = th.participants.find((p) => p !== myUid) ?? '';
        const ownedOtherName=th.participant_names?.[otherUid];
        const otherName=ownedOtherName??t('communityFarmer');
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
                <span lang={ownedOtherName===undefined?lang:''} className="font-display font-semibold" style={{ fontSize: 14, color: 'var(--text-primary)' }}>{otherName}</span>
                <span className="font-sans" style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{communityTimeAgo(th.last_message_at,lang,t)}</span>
              </div>
              <div lang={th.last_message?'':lang} className="font-sans truncate" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{th.last_message || t('communitySayHello')}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
