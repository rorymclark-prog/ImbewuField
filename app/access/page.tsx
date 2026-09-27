'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '@/lib/auth';
import { getFirebase } from '@/lib/firebase/init';
import { listTrainees } from '@/lib/db/queries';
import { ACCESS_FEATURES, type AccessFeature, type AccessTier, type AppAccess } from '@/lib/app-access';
import type { Profile } from '@/lib/db/types';

const LABELS: Record<AccessFeature, string> = {
  planning: 'Crop and task planning',
  field_records: 'Field journal',
  money_records: 'Money and production records',
  design: 'Map, design and site reports',
  community: 'Exchange and community',
};

export default function TrainingAccessPage() {
  const { user, profile, role, loading } = useAuth();
  const authorised = role === 'ngo' || role === 'admin';
  const [people, setPeople] = useState<Profile[]>([]);
  const [grants, setGrants] = useState<Record<string, AppAccess | null>>({});
  const [selected, setSelected] = useState('');
  const [tier, setTier] = useState<AccessTier>('study');
  const [features, setFeatures] = useState<AccessFeature[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!authorised || !user || !profile?.org_id) return;
    let active = true;
    const fb = getFirebase();
    if (!fb) return;
    listTrainees().then(async (rows) => {
      const accessRows = await Promise.all(rows.map(async (person) => {
        const snapshot = await getDoc(doc(fb.db, 'app_access', person.id));
        return [person.id, snapshot.exists() ? snapshot.data() as AppAccess : null] as const;
      }));
      if (active) { setPeople(rows); setGrants(Object.fromEntries(accessRows)); }
    }).catch(() => { if (active) setMessage('Could not load the group. Check your connection and organisation access.'); });
    return () => { active = false; };
  }, [authorised, user?.uid, profile?.org_id]);

  function choose(id: string) {
    setSelected(id);
    const grant = grants[id];
    setTier(grant?.tier ?? 'full');
    setFeatures(grant?.features ?? []);
    setMessage('');
  }

  async function save() {
    const fb = getFirebase();
    const target = people.find((person) => person.id === selected);
    if (!fb || !user || !profile?.org_id || !target || target.org_id !== profile.org_id) return;
    setBusy(true); setMessage('');
    const next: AppAccess = {
      tier, features: tier === 'pilot' ? features : [],
      org_id: profile.org_id, updated_by: user.uid, updated_at: new Date().toISOString(),
    };
    try {
      await setDoc(doc(fb.db, 'app_access', target.id), next);
      setGrants((prev) => ({ ...prev, [target.id]: next }));
      setMessage(`Saved access for ${target.full_name || 'learner'}.`);
    } catch {
      setMessage('Access was not saved. Check your connection and staff permission.');
    } finally { setBusy(false); }
  }

  if (loading) return <main style={{ padding: 24 }}>Loading…</main>;
  if (!authorised || !profile?.org_id) return <main style={{ padding: 24 }}>Only an organisation access manager can assign learner tools.</main>;
  return <main style={{ maxWidth: 680, margin: '0 auto', padding: 24, overflowY: 'auto', height: '100vh' }}>
    <Link href="/home">← Home</Link>
    <h1 style={{ fontSize: 28, fontWeight: 700, margin: '20px 0 8px' }}>Course app access</h1>
    <p style={{ marginBottom: 20 }}>Studies and the available manual stay open for every level. Select a learner to enable pilot tools as they are taught. Existing accounts without an access record retain full access.</p>
    <label htmlFor="learner">Learner</label>
    <select id="learner" value={selected} onChange={(event) => choose(event.target.value)} style={{ display: 'block', width: '100%', padding: 12, margin: '8px 0 20px' }}>
      <option value="">Choose a learner</option>
      {people.map((person) => <option key={person.id} value={person.id}>{person.full_name || person.id} — {grants[person.id]?.tier ?? 'existing full access'}</option>)}
    </select>
    {selected && <>
      <fieldset style={{ border: '1px solid var(--border)', padding: 16, borderRadius: 12 }}>
        <legend>Access level</legend>
        {(['study', 'pilot', 'full'] as const).map((option) => <label key={option} style={{ display: 'block', padding: 8 }}>
          <input type="radio" name="tier" checked={tier === option} onChange={() => setTier(option)} />{' '}
          {option === 'study' ? 'Study and manual' : option === 'pilot' ? 'Selected pilot tools' : 'All tools'}
        </label>)}
      </fieldset>
      {tier === 'pilot' && <fieldset style={{ border: '1px solid var(--border)', padding: 16, borderRadius: 12, marginTop: 16 }}>
        <legend>Enable these tools</legend>
        {ACCESS_FEATURES.map((feature) => <label key={feature} style={{ display: 'block', padding: 8 }}>
          <input type="checkbox" checked={features.includes(feature)} onChange={(event) => setFeatures((current) => event.target.checked ? [...current, feature] : current.filter((value) => value !== feature))} />{' '}{LABELS[feature]}
        </label>)}
      </fieldset>}
      <button type="button" disabled={busy || (tier === 'pilot' && features.length === 0)} onClick={save} style={{ marginTop: 20, padding: '12px 20px', borderRadius: 10, background: 'var(--color-forest-800)', color: 'white' }}>{busy ? 'Saving…' : 'Save access'}</button>
    </>}
    {message && <p role="status" style={{ marginTop: 16 }}>{message}</p>}
  </main>;
}
