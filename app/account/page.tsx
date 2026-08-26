'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { isBackendConfigured } from '@/lib/firebase/init';
import { updateMyProfile, uploadPhoto, getOrganizationName } from '@/lib/db/queries';
import { resizeLogoForStorage } from '@/lib/invoice-logo';
import { APP_LANGS } from '@/lib/i18n';
import TabBar from '@/components/TabBar';
import BrandLogo from '@/components/BrandLogo';
import ThemePanel from '@/components/ThemePanel';
import ConsentPanel from '@/components/ConsentPanel';
import { Settings, Sprout, Mail, Phone, Globe, LogOut, ChevronRight, User, Pencil, Check, X, Camera, Lock, Eye, EyeOff, Image as ImageIcon, type LucideIcon } from 'lucide-react';
import type { UserRole } from '@/lib/db/types';
import LessonLink from '@/components/design/LessonLink';
import MenuButton from '@/components/MenuButton';

const ROLE_LABELS: Record<UserRole, string> = {
  farmer: 'Farmer', mentor: 'Mentor',
  student: 'Student', ngo: 'NGO coordinator', funder: 'Funder', admin: 'Admin',
};

function Row({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 py-3" style={{ borderBottom: '1px solid #E2D8C4' }}>
      <Icon size={16} style={{ color: '#8C7A62', flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono uppercase tracking-wider" style={{ color: '#8C7A62' }}>{label}</div>
        <div className="text-sm font-display mt-0.5" style={{ color: '#20190F' }}>{value}</div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  const { user, profile, signOutUser, changePassword, refreshProfile, loading } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', farmName: '', language: 'en' });
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [changingPw, setChangingPw] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  // Named so the consent screen can say WHICH organisation would see the data, rather than
  // "your organisation" — a person cannot meaningfully consent to an unnamed recipient.
  const [orgName, setOrgName] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user && isBackendConfigured()) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (profile?.org_id) getOrganizationName(profile.org_id).then(setOrgName).catch(() => setOrgName(null));
  }, [profile?.org_id]);

  useEffect(() => {
    if (profile) setForm({ name: profile.full_name ?? '', phone: profile.phone ?? '', farmName: profile.farm_name ?? '', language: profile.language ?? 'en' });
  }, [profile]);

  async function handleSignOut() {
    setSigningOut(true);
    await signOutUser();
    // /gate is the old site-wide password wall, disabled in middleware — sending a
    // signed-out user there dead-ends them. /login is the real Firebase auth entry
    // (and is already what this page uses for the unauthenticated redirect above).
    router.push('/login');
  }

  async function saveProfile() {
    setSaving(true);
    await updateMyProfile({ full_name: form.name.trim() || undefined, phone: form.phone.trim() || null, farm_name: form.farmName.trim() || null, language: form.language });
    await refreshProfile();
    setSaving(false);
    setEditing(false);
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      const url = await uploadPhoto(file, 'avatars');
      if (url) { await updateMyProfile({ photo_url: url }); await refreshProfile(); }
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError(null);
    setLogoUploading(true);
    try {
      const dataUrl = await resizeLogoForStorage(file);
      await updateMyProfile({ farm_logo: dataUrl });
      await refreshProfile();
    } catch (err) {
      // The farmer chose a file and watched nothing happen otherwise. Say which part failed.
      setLogoError(err instanceof Error ? err.message : 'Could not add that logo.');
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  }

  async function handleRemoveLogo() {
    setLogoError(null);
    await updateMyProfile({ farm_logo: null });
    await refreshProfile();
  }

  async function handleChangePw() {
    setPwError(null);
    if (pwForm.next !== pwForm.confirm) { setPwError('New passwords do not match.'); return; }
    if (pwForm.next.length < 6) { setPwError('Password must be at least 6 characters.'); return; }
    setPwSaving(true);
    const err = await changePassword(pwForm.current, pwForm.next);
    setPwSaving(false);
    if (err) { setPwError(err); } else { setPwSuccess(true); setPwForm({ current: '', next: '', confirm: '' }); setTimeout(() => { setPwSuccess(false); setChangingPw(false); }, 2000); }
  }

  if (loading || !user) {
    return (
      <div className="flex flex-col" style={{ height: '100dvh', background: '#E4DCC6' }}>
        <div className="flex-1 flex items-center justify-center">
          <Sprout size={32} style={{ color: '#1F4D2B', opacity: 0.4 }} />
        </div>
        <TabBar />
      </div>
    );
  }

  const displayName = profile?.full_name ?? user.displayName;
  const roleLabel = profile?.role ? ROLE_LABELS[profile.role] : null;
  const langLabel = profile?.language ? (APP_LANGS.find((l) => l.code === profile.language)?.label ?? profile.language) : null;

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: '#E4DCC6' }}>
      <header className="flex-shrink-0 flex items-center px-3 sm:px-4 gap-2 sm:gap-3" style={{ height: 52, background: '#FFFEFA', borderBottom: '1px solid #E2D8C4' }}>
        <MenuButton />
        <BrandLogo />
        <div className="w-px h-5" style={{ background: '#E2D8C4' }} />
        <span className="text-xs font-display truncate min-w-0" style={{ color: '#5C5040' }}>Account</span>
        <div className="flex-1" />
        <LessonLink id="account:overview" label="Learn" />
        <button onClick={() => setSettingsOpen(true)} aria-label="Settings"
          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-display"
          style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#20190F', cursor: 'pointer' }}>
          <Settings size={13} strokeWidth={1.7} />
          <span className="hidden sm:inline">Settings</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-4 py-6 space-y-5">

          {/* Avatar + name */}
          <div className="rounded-2xl p-5 flex items-center gap-4" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
            <div className="relative flex-shrink-0">
              {profile?.photo_url ? (
                <img src={profile.photo_url} alt={displayName ?? 'Avatar'}
                  className="rounded-full object-cover"
                  style={{ width: 64, height: 64 }} />
              ) : (
                <div className="flex items-center justify-center rounded-full font-display font-bold"
                  style={{ width: 64, height: 64, fontSize: 28, background: 'linear-gradient(135deg, #1F4D2B, #2D6B3C)', color: '#EAF3E2' }}>
                  {((displayName || user.email || '?').trim()[0] ?? '?').toUpperCase()}
                </div>
              )}
              <button onClick={() => photoInputRef.current?.click()} disabled={photoUploading}
                aria-label="Change photo"
                className="absolute bottom-0 right-0 flex items-center justify-center rounded-full"
                style={{ width: 22, height: 22, background: '#C07A1E', border: '2px solid #FBF6EC', cursor: photoUploading ? 'wait' : 'pointer' }}>
                <Camera size={11} style={{ color: '#fff' }} />
              </button>
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display font-semibold text-lg leading-tight truncate" style={{ color: '#20190F' }}>
                {displayName ?? 'ImbewuField user'}
              </div>
              {roleLabel && (
                <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-display"
                  style={{ background: 'rgba(31,77,43,0.08)', border: '1px solid rgba(31,77,43,0.15)', color: '#1F4D2B' }}>
                  <Sprout size={11} />{roleLabel}
                </div>
              )}
            </div>
            {!editing && (
              <button onClick={() => setEditing(true)} title="Edit profile"
                className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-display"
                style={{ background: 'rgba(31,77,43,0.08)', border: '1px solid rgba(31,77,43,0.15)', color: '#1F4D2B', cursor: 'pointer' }}>
                <Pencil size={12} />Edit
              </button>
            )}
          </div>

          {/* Edit form */}
          {editing ? (
            <div className="rounded-2xl px-4 py-4 space-y-3" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
              <div className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: '#8C7A62' }}>Edit profile</div>

              <label className="block">
                <div className="text-xs font-mono mb-1" style={{ color: '#8C7A62' }}>Full name</div>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Your full name"
                  className="w-full text-sm font-display outline-none rounded-xl px-3 py-2.5"
                  style={{ background: '#fff', border: '1px solid #D8CBB2', color: '#20190F' }} />
              </label>

              <label className="block">
                <div className="text-xs font-mono mb-1" style={{ color: '#8C7A62' }}>Phone</div>
                <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+27 ..."
                  type="tel"
                  className="w-full text-sm font-display outline-none rounded-xl px-3 py-2.5"
                  style={{ background: '#fff', border: '1px solid #D8CBB2', color: '#20190F' }} />
              </label>

              {/* The trading name the buyer knows — it HEADS every invoice, and the person's
                  own name moves to a contact line underneath it. Blank is fine: the invoice
                  then leads with the personal name, which is what a farmer trading under
                  their own name wants. Nothing is ever substituted for an unset value. */}
              <label className="block">
                <div className="text-xs font-mono mb-1" style={{ color: '#8C7A62' }}>Business name <span style={{ opacity: 0.7 }}>(heads your invoices)</span></div>
                <input value={form.farmName} onChange={(e) => setForm((f) => ({ ...f, farmName: e.target.value }))}
                  placeholder="e.g. Ubhejane Creche"
                  className="w-full text-sm font-display outline-none rounded-xl px-3 py-2.5"
                  style={{ background: '#fff', border: '1px solid #D8CBB2', color: '#20190F' }} />
                <div className="text-xs font-sans mt-1" style={{ color: '#8C7A62' }}>
                  Leave this empty to invoice under your own name instead.
                </div>
              </label>

              {/* Business logo. Saved on its own the moment a file is chosen, rather than
                  waiting for Save — the picture is already visible by then, so a logo that
                  vanished on Cancel would read as a failed upload. */}
              <div className="block">
                <div className="text-xs font-mono mb-1" style={{ color: '#8C7A62' }}>Business logo <span style={{ opacity: 0.7 }}>(shown on invoices)</span></div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center rounded-xl flex-shrink-0 overflow-hidden"
                    style={{ width: 56, height: 56, background: '#fff', border: '1px solid #D8CBB2' }}>
                    {profile?.farm_logo
                      /* eslint-disable-next-line @next/next/no-img-element -- farmer-supplied data URL */
                      ? <img src={profile.farm_logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      : <ImageIcon size={20} style={{ color: '#C3B79E' }} />}
                  </div>
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <div className="flex gap-1.5 flex-wrap">
                      <button type="button" onClick={() => logoInputRef.current?.click()} disabled={logoUploading}
                        className="px-3 py-1.5 rounded-lg text-xs font-sans font-semibold"
                        style={{ background: '#fff', border: '1px solid #D8CBB2', color: '#1F4D2B', cursor: logoUploading ? 'default' : 'pointer', opacity: logoUploading ? 0.6 : 1 }}>
                        {logoUploading ? 'Adding…' : profile?.farm_logo ? 'Replace' : 'Add a logo'}
                      </button>
                      {profile?.farm_logo && !logoUploading && (
                        <button type="button" onClick={handleRemoveLogo}
                          className="px-3 py-1.5 rounded-lg text-xs font-sans"
                          style={{ background: 'transparent', border: '1px solid #D8CBB2', color: '#8C7A62', cursor: 'pointer' }}>
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="text-xs font-sans" style={{ color: logoError ? '#A8443A' : '#8C7A62' }}>
                      {logoError ?? 'A photo of your sign works. It is made smaller automatically.'}
                    </div>
                  </div>
                </div>
                <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
              </div>

              <label className="block">
                <div className="text-xs font-mono mb-1" style={{ color: '#8C7A62' }}>Language</div>
                <select value={form.language} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                  className="w-full text-sm font-display outline-none rounded-xl px-3 py-2.5 appearance-none"
                  style={{ background: '#fff', border: '1px solid #D8CBB2', color: '#20190F' }}>
                  {APP_LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
              </label>

              <div className="flex gap-2 pt-1">
                <button onClick={saveProfile} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-display font-semibold"
                  style={{ background: '#1F4D2B', color: '#F7F2E9', border: 'none', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                  <Check size={14} />{saving ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => setEditing(false)} disabled={saving}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-display"
                  style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#5C5040', cursor: 'pointer' }}>
                  <X size={14} />Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl px-4" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
              <Row icon={Mail} label="Email" value={user.email} />
              <Row icon={Phone} label="Phone" value={profile?.phone ?? null} />
              <Row icon={Globe} label="Language" value={langLabel} />
              <Row icon={User} label="Role" value={roleLabel} />
            </div>
          )}

          {/* What you share — POPIA consent. Farmers only: it is the farmer's own record, and
              staff/mentor accounts have nothing to consent to. Hidden when the farmer has no
              org, because consent is granted TO an organisation and the rules pin it to theirs. */}
          {profile?.role === 'farmer' && profile?.org_id && (
            <ConsentPanel orgName={orgName} />
          )}

          {/* Change password */}
          {!changingPw ? (
            <button onClick={() => setChangingPw(true)}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-display"
              style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#20190F', cursor: 'pointer', textAlign: 'left' }}>
              <span className="flex items-center gap-2"><Lock size={14} style={{ color: '#8C7A62' }} />Change password</span>
              <ChevronRight size={16} style={{ color: '#8C7A62' }} />
            </button>
          ) : (
            <div className="rounded-2xl px-4 py-4 space-y-3" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
              <div className="text-xs font-mono uppercase tracking-wider" style={{ color: '#8C7A62' }}>Change password</div>

              {pwSuccess ? (
                <div className="flex items-center gap-2 py-2 text-sm font-display" style={{ color: '#1F4D2B' }}>
                  <Check size={14} />Password updated successfully.
                </div>
              ) : (
                <>
                  {(['current', 'next', 'confirm'] as const).map((field) => (
                    <div key={field} className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        placeholder={field === 'current' ? 'Current password' : field === 'next' ? 'New password' : 'Confirm new password'}
                        value={pwForm[field]}
                        onChange={(e) => { setPwForm((f) => ({ ...f, [field]: e.target.value })); setPwError(null); }}
                        className="w-full text-sm font-display outline-none rounded-xl px-3 py-2.5 pr-10"
                        style={{ background: '#fff', border: '1px solid #D8CBB2', color: '#20190F' }} />
                      {field === 'current' && (
                        <button type="button" onClick={() => setShowPw((s) => !s)}
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                          style={{ color: '#8C7A62', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                          {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      )}
                    </div>
                  ))}
                  {pwError && <p className="text-xs font-sans" style={{ color: '#D4922A' }}>{pwError}</p>}
                  <div className="flex gap-2 pt-1">
                    <button onClick={handleChangePw} disabled={pwSaving || !pwForm.current || !pwForm.next || !pwForm.confirm}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-display font-semibold"
                      style={{ background: '#1F4D2B', color: '#F7F2E9', border: 'none', cursor: pwSaving ? 'wait' : 'pointer', opacity: (pwSaving || !pwForm.current || !pwForm.next) ? 0.6 : 1 }}>
                      <Lock size={13} />{pwSaving ? 'Updating...' : 'Update password'}
                    </button>
                    <button onClick={() => { setChangingPw(false); setPwForm({ current: '', next: '', confirm: '' }); setPwError(null); }}
                      className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-display"
                      style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#5C5040', cursor: 'pointer' }}>
                      <X size={14} />Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Settings shortcut */}
          <button onClick={() => setSettingsOpen(true)}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-display"
            style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', color: '#20190F', cursor: 'pointer', textAlign: 'left' }}>
            <span>Appearance &amp; language</span>
            <ChevronRight size={16} style={{ color: '#8C7A62' }} />
          </button>

          {/* Sign out */}
          <button onClick={handleSignOut} disabled={signingOut}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-display font-semibold transition-all"
            style={{ background: signingOut ? '#FFFEFA' : 'rgba(212,110,66,0.06)', border: '1px solid rgba(212,110,66,0.25)', color: signingOut ? '#8C7A62' : '#B83A18', cursor: signingOut ? 'wait' : 'pointer' }}>
            <LogOut size={15} />
            {signingOut ? 'Signing out...' : 'Sign out'}
          </button>

          <p className="text-center text-xs font-mono" style={{ color: '#8C7A62' }}>
            ImbewuField · growing with you
          </p>
        </div>
      </div>

      <TabBar />
      <ThemePanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
