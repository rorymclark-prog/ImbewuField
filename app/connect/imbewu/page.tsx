'use client';

import { useCallback, useEffect, useState } from 'react';
import PhotoRegistrationPreview, { type RegistrationPreview } from '@/components/PhotoRegistrationPreview';
import { useRegisterBackControl } from '@/components/BackControl';
import { numberLabel } from '@/lib/format-figures';
import { useAuth } from '@/lib/auth';

type Site = { id: string; name: string; lat: number; lon: number; hasDesign: boolean };
type Connection = { id: string; clientName: string; scopes: string[]; siteIds: string[]; expiresAt: number; revoked: boolean };
type Account = { profile: { id: string; name: string; role: string; organizationId: string | null }; sites: Site[]; connections: Connection[] };
type Consent = { clientName: string; callbackHost: string; scopes: { id: string; description: string }[] };
type Attachment = { id: string; name: string; mime: string; size: number; sha256: string; importedAt: string; source: { reference: string; authorisation: string } };
const button = 'min-h-12 rounded-xl border px-5 py-3 text-left disabled:opacity-50';

export default function ImbewuConnection() {
  useRegisterBackControl();
  const { user, loading, signInWithGoogle, signIn } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [consent, setConsent] = useState<Consent | null>(null);
  const [requestId, setRequestId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [site, setSite] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationPreview[]>([]);
  const [registrationDesign, setRegistrationDesign] = useState<any>(null);
  const [activeRegistration, setActiveRegistration] = useState<RegistrationPreview | null>(null);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const api = useCallback(async (path: string, body?: object) => {
    if (!user) throw Error('Sign in to ImbewuField first.');
    const r = await fetch(`/api/assistant/${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${await user.getIdToken()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store' });
    const value = await r.json(); if (!r.ok) throw Error(value.error ?? 'The app could not confirm this action.'); return value;
  }, [user]);
  const refresh = useCallback(async () => {
    const a: Account = await api('account'); setAccount(a);
    const params = new URLSearchParams(window.location.search);
    const request = params.get('request') ?? ''; setRequestId(request);
    if (request) setConsent(await api(`consent?request=${encodeURIComponent(request)}`));
    const wanted = params.get('site'); setSite(old => old || (a.sites.some(s => s.id === wanted) ? wanted! : a.sites[0]?.id ?? ''));
  }, [api]);
  useEffect(() => { setAccount(null); setConsent(null); setSelected([]); setAttachments([]); if (user) void refresh().catch(e => setError(e.message)); }, [user, refresh]);
  useEffect(() => { setAttachments([]); setRegistrations([]); setPreview(null); setActiveRegistration(null); if (user && site && !requestId) void Promise.all([api(`site-assets?site=${encodeURIComponent(site)}`),api(`site-registrations?site=${encodeURIComponent(site)}`)]).then(([a,r]) => {setAttachments(a.assets);setRegistrations(r.registrations);setRegistrationDesign(r.design);}).catch(e => setError(e.message)); }, [user, site, requestId, api]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  async function openOriginal(a: Attachment) {
    if (!user) return;
    setBusy(true); setError('');
    try {
      const base = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === '1' ? (process.env.NEXT_PUBLIC_ASSISTANT_EMULATOR_ORIGIN ?? 'http://127.0.0.1:5001/fieldproof-sa/europe-west1/imbewuConnector') : 'https://europe-west1-fieldproof-sa.cloudfunctions.net/imbewuConnector';
      const r = await fetch(`${base}/account-attachment?asset=${encodeURIComponent(a.id)}`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
      if (!r.ok) throw Error('The original could not be opened. Try again after signing in.');
      const blob = await r.blob();
      const checksum = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(n => n.toString(16).padStart(2, '0')).join('');
      if (checksum !== a.sha256 || blob.size !== a.size) throw Error('Original file verification failed.');
      const url = URL.createObjectURL(blob);
      if (a.mime.startsWith('image/')) setPreview({ url, name: a.name });
      else { const link = document.createElement('a'); link.href = url; link.download = a.name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60_000); }
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function decision(approved: boolean) {
    setBusy(true); setError('');
    try { const r = await api('consent', { request: requestId, siteIds: selected, approved }); window.location.assign(r.redirect); }
    catch (e) { setError((e as Error).message); setBusy(false); }
  }
  async function disconnect(c: Connection) {
    setBusy(true); setError(''); try { await api('disconnect', { id: c.id }); await refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-3xl space-y-6 px-5 py-10 pb-32">
    <a href="/account" className="inline-block min-h-11 py-3 underline">Back to Account</a>
    <div className="flex items-center gap-4"><img src="/icon-192.png" width="64" height="64" alt="" /><div><p className="text-sm">ImbewuField</p><h1 className="text-3xl font-semibold">Assistant connections</h1></div></div>
    <p>Work with your saved sites through an assistant. Choose which sites it may use and disconnect it here whenever you need to.</p>
    {error && <p role="alert" className="rounded-xl border border-red-500 p-4">{error}</p>}
    {loading ? <p role="status">Checking your account…</p> : !user ? <section className="space-y-4 rounded-2xl border p-5">
      <h2 className="text-xl font-semibold">Sign in to your ImbewuField account</h2><p>Your assistant receives its own scoped connection. It does not receive your password.</p>
      <button className={button} onClick={() => { void signInWithGoogle().then(e => e && setError(e)); }}>Continue with Google</button>
      <form className="grid gap-3" onSubmit={e => { e.preventDefault(); void signIn(email, password).then(e => e && setError(e)); }}>
        <label>Email<input className="mt-1 block min-h-12 w-full rounded-lg border bg-transparent px-3" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label>Password<input className="mt-1 block min-h-12 w-full rounded-lg border bg-transparent px-3" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
        <button className={button} type="submit">Sign in</button>
      </form>
    </section> : !account ? <p role="status">Loading your sites and connections…</p> : <>
      <section className="rounded-2xl border p-5"><h2 className="text-xl font-semibold">{account.profile.name || 'Your account'}</h2><p>{account.profile.role} · {account.profile.organizationId || 'Personal account'}</p></section>
      {consent ? <section className="space-y-5 rounded-2xl border p-5">
        <h2 className="text-2xl font-semibold">Connect {consent.clientName}</h2><p>After you approve, return to <strong>{consent.callbackHost}</strong>. Only continue if you started this connection and recognise that destination.</p>
        <ul className="list-disc space-y-2 pl-5">{consent.scopes.map(s => <li key={s.id}>{s.description}</li>)}</ul>
        <fieldset className="space-y-3"><legend className="mb-3 text-lg font-semibold">Choose sites to share with this assistant</legend>{account.sites.map(s => <label key={s.id} className="flex min-h-12 items-center gap-3 rounded-lg border p-3"><input type="checkbox" checked={selected.includes(s.id)} onChange={e => setSelected(v => e.target.checked ? [...v, s.id] : v.filter(id => id !== s.id))} /><span>{s.name}<small className="block">{s.lat.toFixed(5)}, {s.lon.toFixed(5)}{s.hasDesign ? ' · Saved design' : ''}</small></span></label>)}</fieldset>
        {!account.sites.length && <p>No saved sites are synced to this account yet. You may connect with no sites, then save a site in the app and reconnect to select it.</p>}
        <p className="text-sm">This does not grant access to your Gmail, Drive or computer. New sites need a new connection decision. Connections expire after 90 days; access tokens last one hour.</p>
        <div className="flex flex-wrap gap-3"><button className={button} disabled={busy} onClick={() => void decision(true)}>Allow selected access</button><button className={button} disabled={busy} onClick={() => void decision(false)}>Cancel connection</button></div>
      </section> : <>
        <section className="space-y-4 rounded-2xl border p-5"><h2 className="text-xl font-semibold">Connected assistants</h2>{account.connections.filter(c => !c.revoked && c.expiresAt > Date.now()).map(c => <div key={c.id} className="space-y-2 border-b pb-4"><h3 className="font-semibold">{c.clientName}</h3><p>{c.siteIds.length} selected sites · expires {new Date(c.expiresAt).toLocaleDateString('en-ZA')}</p><p className="text-sm">{c.scopes.join(', ')}</p><button className={button} disabled={busy} onClick={() => void disconnect(c)}>Disconnect {c.clientName}</button></div>)}{!account.connections.some(c => !c.revoked && c.expiresAt > Date.now()) && <p>No active assistant connections.</p>}</section>
        <section className="space-y-3 rounded-2xl border p-5"><h2 className="text-xl font-semibold">Site originals</h2><p>Imported originals keep their source, byte count and fingerprint. They are separate from the small evidence thumbnails stored on a device.</p><label className="block">Site<select className="mt-1 block min-h-12 w-full rounded-lg border bg-transparent px-3" value={site} onChange={e => setSite(e.target.value)}>{account.sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><p>Completed imports remain in ImbewuField after the chat closes.</p>{attachments.length ? <ul className="space-y-4">{attachments.map(a => <li key={a.id} className="space-y-2 rounded-xl border p-4"><h3 className="font-semibold">{a.name}</h3><p>{numberLabel(a.size)} bytes · {a.mime}</p><p>Source: {a.source.reference}</p><p className="text-sm">Import authorisation: {a.source.authorisation}</p><p className="break-all text-xs">SHA-256: {a.sha256}</p><button className={button} disabled={busy} onClick={() => { setActiveRegistration(null); void openOriginal(a); }}>Open original {a.name}</button></li>)}</ul> : <p>No originals are attached to this site.</p>}{registrations.map(r => <div key={r.id} className="rounded-xl border p-4"><h3 className="font-semibold">Historical photo registration draft</h3><p>{r.note}</p><button className={button} disabled={busy} onClick={() => { const a = attachments.find(a => a.id === r.assetId); if (a) {setActiveRegistration(r); void openOriginal(a);} }}>Review registered photograph</button></div>)}{preview && activeRegistration ? <PhotoRegistrationPreview originalUrl={preview.url} registration={activeRegistration} design={registrationDesign} /> : preview && <figure><img src={preview.url} alt={preview.name} className="max-h-[70vh] w-full rounded-xl object-contain" /><figcaption>{preview.name} · Original bytes verified</figcaption></figure>}</section>
        <section className="space-y-3 rounded-2xl border p-5"><h2 className="text-xl font-semibold">Connect an MCP-compatible assistant</h2><p>Use the ImbewuField private plugin, or add the following Streamable HTTP endpoint in a host that supports OAuth and remote MCP:</p><code className="block break-all rounded-lg border p-3">https://imbewufield.vercel.app/api/assistant/mcp</code><p>Your host should open this app’s sign-in and site-selection page. An installed plugin card alone does not mean the connection is authenticated.</p></section>
      </>}
    </>}
  </main>;
}
