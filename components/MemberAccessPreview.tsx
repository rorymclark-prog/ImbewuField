'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { paidApiHeaders } from '@/lib/api-client-auth';
import { isSampleMode } from '@/lib/sample-mode';
import { sampleRead } from '@/lib/sample-operations';
import { freshFieldWorkspace } from '@/lib/field-teams';
import { memberAccessSummary } from '@/lib/mel';
import { readSampleProgramme } from './SampleProgramme';
import { melRequest } from './MelDashboard';
import styles from './MelDashboard.module.css';
import { useLanguage } from '@/lib/i18n-context';

type Person = { id: string; name: string; role: string };
type Preview = Person & { capabilities: ReturnType<typeof memberAccessSummary>; location: string; people: { id: string; name: string }[]; checkedAt: string; sample: boolean };

export default function MemberAccessPreview() {
  const { user, role } = useAuth();
  return <AccessBody key={`${user?.uid ?? 'guest'}:${role}`} />;
}

function AccessBody() {
  const { t } = useLanguage();
  const { user, role, loading } = useAuth();
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [org, setOrg] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [id, setId] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (loading || isSampleMode() || role !== 'admin' || !user) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/network/orgs', { headers: await paidApiHeaders() });
        const data = await response.json();
        if (!response.ok) throw Error(data.error ?? 'Could not load organisations.');
        if (!cancelled) { setOrgs(data.orgs); setOrg(data.orgs[0]?.id ?? ''); setBusy(false); }
      } catch (e) { if (!cancelled) { setError((e as Error).message); setBusy(false); } }
    })();
    return () => { cancelled = true; };
  }, [user, role, loading]);

  useEffect(() => {
    if (loading || (!isSampleMode() && role === 'admin' && !org)) return;
    let cancelled = false;
    setPeople([]); setId(''); setPreview(null); setError(''); setBusy(true);
    void (async () => {
      try {
        const members = isSampleMode() ? readSampleProgramme().people : (await melRequest(`?mode=people${org ? `&org=${encodeURIComponent(org)}` : ''}`)).people;
        if (!cancelled) setPeople(members);
      } catch (e) { if (!cancelled) setError((e as Error).message); }
      finally { if (!cancelled) setBusy(false); }
    })();
    return () => { cancelled = true; };
  }, [loading, role, org, revision]);

  useEffect(() => {
    setPreview(null);
    if (!id) return;
    let cancelled = false;
    setError(''); setBusy(true);
    void (async () => {
      try {
        let data: Preview;
        if (isSampleMode()) {
          const member = readSampleProgramme().people.find(p => p.id === id);
          if (!member) throw Error("Choose a member.");
          const field = sampleRead('field-teams', freshFieldWorkspace);
          const team = member.role === 'mentor' ? field.teams.find(t => t.mentorId === id) : null;
          data = { id, name: member.name, role: member.role, capabilities: memberAccessSummary(member.role, member),
            location: team?.location ?? '', people: field.people.filter(p => team?.farmerIds.includes(p.id) && ['farmer', 'student'].includes(p.role)), checkedAt: new Date().toISOString(), sample: true };
        } else data = await melRequest(`?mode=access-preview&id=${encodeURIComponent(id)}${org ? `&org=${encodeURIComponent(org)}` : ''}`);
        if (!cancelled) setPreview(data);
      } catch (e) { if (!cancelled) setError((e as Error).message); }
      finally { if (!cancelled) setBusy(false); }
    })();
    return () => { cancelled = true; };
  }, [id, org]);

  return <div className={styles.card} style={{ marginTop: 20 }}>
    <h2>{t('mentorAccessCheckHeading')}</h2>
    <p>{t('mentorAccessCheckIntro')}</p>
    {orgs.length > 0 && <label>{t('mentorAccessOrgLabel')}<select value={org} onChange={e => { setPreview(null); setId(''); setOrg(e.target.value); }}>{orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}
    <div className={styles.row}><label>{t('mentorAccessMemberLabel')}<select disabled={busy} value={id} onChange={e => { setPreview(null); setId(e.target.value); }}><option value="">{t('mentorAccessChooseMember')}</option>{people.map(p => <option key={p.id} value={p.id}>{p.name} · {p.role === 'ngo' ? t('mentorAccessRoleOrganisation') : p.role}</option>)}</select></label><button type="button" disabled={busy} onClick={() => setRevision(n => n + 1)}>{t('mentorAccessRefreshButton')}</button></div>
    {busy && <p role="status">{t('mentorAccessChecking')}</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {preview && <><h3>{preview.name} · {preview.role === 'ngo' ? t('mentorAccessRoleOrganisation') : preview.role}</h3><p className={styles.muted}>{preview.sample ? t('mentorAccessSettingsLabel') : t('mentorAccessCurrentServerSettings')} · {t('mentorAccessCheckedAtPrefix')} {new Date(preview.checkedAt).toLocaleTimeString()}</p>
      <div className={styles.grid}>{preview.capabilities.map(c => <div className={styles.metric} key={c.id}><strong>{c.label}</strong><p>{c.allowed ? t('mentorAccessAllowed') : t('mentorAccessNotAllowed')}</p></div>)}</div>
      {preview.role === 'mentor' && <><h3>{t('mentorAccessAssignedFieldGroup')}</h3><p>{preview.location || t('mentorAccessNoLocationAssigned')}</p>{preview.people.length ? <ul>{preview.people.map(p => <li key={p.id}>{p.name}</li>)}</ul> : <p>{t('mentorAccessNoFarmersAssigned')}</p>}<p>{t('mentorAccessTrainingRecordsNote')}</p></>}
    </>}
    <p className={styles.notice}>{t('mentorAccessReadOnlyNotice')}</p>
  </div>;
}
