'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { paidApiHeaders } from '@/lib/api-client-auth';
import { isSampleMode } from '@/lib/sample-mode';
import type { ProductionSite, productionAreaSummary } from '@/lib/production-sites';
import styles from './MelDashboard.module.css';
type Summary = ReturnType<typeof productionAreaSummary>;
const blank = () => ({ code: '', name: '', observedOn: new Date().toISOString().slice(0, 10), vegetableM2: '', stapleM2: '', boundaryM2: '', evidence: '', published: false });
async function request(url: string, body?: unknown) {
  const res = await fetch(url, { method: body ? 'POST' : 'GET', headers: { ...(await paidApiHeaders()), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await res.json(); if (!res.ok) throw Error(data.error ?? 'Unable to load production areas.'); return data;
}
export default function ProductionAreas({ publishedOnly = false }: { publishedOnly?: boolean }) {
  const { user, role } = useAuth();
  return <ProductionAreaContent key={`${user?.uid ?? 'guest'}:${role}`} publishedOnly={publishedOnly} />;
}
function ProductionAreaContent({ publishedOnly }: { publishedOnly: boolean }) {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]), [org, setOrg] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null), [sites, setSites] = useState<ProductionSite[]>([]);
  const [manage, setManage] = useState(false), [sample, setSample] = useState(false), [loading, setLoading] = useState(false);
  const [form, setForm] = useState(blank), [editing, setEditing] = useState(false), [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [saving, setSaving] = useState(false);
  const version = useRef(0);
  useEffect(() => {
    let cancelled = false; setSample(isSampleMode());
    if (!user || isSampleMode()) return;
    void request('/api/network/orgs').then(d => { if (!cancelled) { setOrgs(d.orgs); setOrg(d.orgs[0]?.id ?? ''); } }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [user]);
  async function reload() {
    const current = ++version.current; setLoading(true); setError('');
    try { const d = await request(`/api/production-sites?org=${encodeURIComponent(org)}${publishedOnly ? '&published=true' : ''}`); if (current === version.current) { setSummary(d.summary); setSites(d.sites ?? []); setManage(d.canManage ?? false); } }
    catch (e) { if (current === version.current) setError((e as Error).message); }
    finally { if (current === version.current) setLoading(false); }
  }
  useEffect(() => {
    setSummary(null); setSites([]); setManage(false); setForm(blank()); setEditing(false); setConfirmed(false); setNotice('');
    if (org) void reload();
    return () => { version.current++; };
    // reload uses this exact organisation and projection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org, publishedOnly]);
  async function save() {
    if (saving || !confirmed) return;
    setSaving(true); setError(''); setNotice(''); const current = version.current;
    try {
      const numeric = (v: string) => v.trim() ? Number(v) : null;
      await request(`/api/production-sites?org=${encodeURIComponent(org)}`, { confirmed, site: { ...form, vegetableM2: numeric(form.vegetableM2), stapleM2: numeric(form.stapleM2), boundaryM2: numeric(form.boundaryM2) } });
      if (current !== version.current) return;
      setNotice(form.published ? 'Saved and included in the funder total.' : 'Saved privately for the NGO.'); setForm(blank()); setConfirmed(false); setEditing(false); await reload();
    } catch (e) { if (current === version.current) setError((e as Error).message); }
    finally { setSaving(false); }
  }
  const field = (key: keyof ReturnType<typeof blank>, value: string | boolean) => setForm(f => ({ ...f, [key]: value }));
  return <section className={styles.root}><div className={styles.wrap}>
    <div className={styles.hero}><h1>Production area</h1><p>{publishedOnly ? 'Areas checked and shared by the NGO.' : 'Record the space actually in production. Keep one code for each physical garden.'}</p></div>
    {sample ? <p className={styles.card}>Sample mode · no checked areas have been published. On a live project, the NGO records vegetable beds and staple plots, the measurement date and supporting evidence before sharing the total.</p> : <label>Organisation<select disabled={saving} value={org} onChange={e => setOrg(e.target.value)}>{orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}
    {error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status">{notice}</p>}{loading && <p>Loading production areas…</p>}
    {summary && <><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: 16, margin: '20px 0' }}>{[['Vegetable beds', summary.vegetableM2], ['Staple plots', summary.stapleM2], ['Combined', summary.combinedM2]].map(([label, area]) => <article key={label} className={styles.card}><h2>{label}</h2><strong style={{ fontSize: 28 }}>{summary.sites ? `${((area as number) / 10000).toLocaleString('en-ZA', { maximumFractionDigits: 4 })} ha` : 'Not recorded'}</strong><p>{summary.sites ? `${(area as number).toLocaleString('en-ZA')} m²` : 'No published measurements yet'}</p></article>)}</div>
      <p>{summary.sites} distinct gardens · observations {summary.firstObserved ?? 'not recorded'} to {summary.lastObserved ?? 'not recorded'}. {publishedOnly ? 'Published records only.' : 'Includes private records; funders see published records only.'}</p>
      <p className={styles.muted}>This is a sum of each garden’s latest recorded observation, not necessarily an area planted on one common date. Recheck at each reporting period. NGO-checked does not mean independently audited. Crop cycles and multiple farmers do not add extra hectares.</p></>}
    {manage && !publishedOnly && <form className={styles.card} style={{ marginTop: 24 }} onSubmit={e => { e.preventDefault(); void save(); }}><h2>{editing ? 'Update this garden' : 'Add a garden observation'}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 16 }}>
        <label>Stable site code<input required disabled={editing || saving} pattern="[a-z0-9][a-z0-9_-]{1,63}" placeholder="e.g. ubhejane-01" value={form.code} onChange={e => field('code', e.target.value)} /></label>
        <label>Garden name<input required maxLength={160} value={form.name} onChange={e => field('name', e.target.value)} /></label>
        <label>Observation date<input required type="date" max={new Date().toISOString().slice(0, 10)} value={form.observedOn} onChange={e => field('observedOn', e.target.value)} /></label>
        <label>Vegetable beds in production (m²)<input required type="number" min="0" step="any" value={form.vegetableM2} onChange={e => field('vegetableM2', e.target.value)} /></label>
        <label>Staple plots in production (m²)<input required type="number" min="0" step="any" value={form.stapleM2} onChange={e => field('stapleM2', e.target.value)} /></label>
        <label>Total garden boundary (m², optional)<input type="number" min="0" step="any" value={form.boundaryM2} onChange={e => field('boundaryM2', e.target.value)} /></label>
      </div>
      <label>Measurement evidence<textarea required minLength={10} maxLength={1500} value={form.evidence} placeholder="Method, date, and where the site record or photograph is saved. Avoid participant personal details." onChange={e => field('evidence', e.target.value)} /></label>
      <p>Enter 0 only where you have checked there is no production. Use the same site code for later visits. Exclude paths, buildings, fallow ground and tree areas from these two crop categories.</p>
      <label style={{ display: 'flex', gap: 12 }}><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I checked that these areas do not overlap and this garden is not registered under another code.</label>
      <label style={{ display: 'flex', gap: 12 }}><input type="checkbox" checked={form.published} onChange={e => field('published', e.target.checked)} />Include this garden’s areas in the funder total</label>
      <div className={styles.row}><button type="submit" disabled={saving || !confirmed}>{saving ? 'Saving…' : 'Save observation'}</button><button type="button" disabled={saving} onClick={() => { setForm(blank()); setEditing(false); setConfirmed(false); }}>Clear</button></div>
    </form>}
    {!publishedOnly && sites.length > 0 && <div className={styles.card} style={{ marginTop: 24 }}><h2>Garden register</h2>{sites.map(s => <div key={s.code} style={{ borderTop: '1px solid #cbd5ca', padding: '16px 0' }}><strong>{s.name} · {s.code}</strong><p>{(s.vegetableM2 + s.stapleM2).toLocaleString()} m² · {s.observedOn} · {s.published ? 'Shared total' : 'NGO only'}</p><p>{s.evidence}</p>{manage && <button type="button" disabled={saving} onClick={() => { setEditing(true); setConfirmed(false); setForm({ ...s, vegetableM2: String(s.vegetableM2), stapleM2: String(s.stapleM2), boundaryM2: s.boundaryM2 === null ? '' : String(s.boundaryM2) }); }}>{'Update / change sharing'}</button>}</div>)}</div>}
  </div></section>;
}
