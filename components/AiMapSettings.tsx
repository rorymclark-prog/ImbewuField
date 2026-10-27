'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { paidApiHeaders } from '@/lib/api-client-auth';
import { isSampleMode } from '@/lib/sample-mode';
import { AI_MAP_ROLES, type AiRenderAccess } from '@/lib/ai-render/access';
import { useLanguage } from '@/lib/i18n';

interface AiMapSettingsState {
  access: AiRenderAccess; master: boolean; canManage: boolean;
  globalEnabled: boolean; personalEnabled: boolean; selectedOrg: string | null;
  organizations: { id: string; name: string; enabled: boolean; roles: string[] }[];
  members: { id: string; name: string; role: string; granted: boolean | null }[];
}
const roleNames: Record<string, string> = { farmer: 'Farmers', mentor: 'Mentors', student: 'Students', ngo: 'Organisation staff', funder: 'Funders' };
const row = { display: 'flex', alignItems: 'center', gap: 12, minHeight: 48 } as const;
const inputStyle = { minHeight: 44, maxWidth: '100%', background: 'var(--bg-2)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: 8 } as const;

export default function AiMapSettings() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const [data, setData] = useState<(AiMapSettingsState & { uid: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const request = useRef(0);
  const activeUid = useRef(user?.uid);
  activeUid.current = user?.uid;

  useEffect(() => {
    let active = true;
    const id = ++request.current;
    setData(null); setError(''); setSaved(false); setBusy(false);
    if (!user || isSampleMode()) return;
    const load = async () => {
      try {
        const response = await fetch('/api/ai-render/settings', { headers: await paidApiHeaders(user), cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? 'AI map settings are unavailable.');
        if (active && id === request.current) setData({ ...result, uid: user.uid });
      } catch (e) { if (active && id === request.current) setError((e as Error).message); }
    };
    void load();
    return () => { active = false; };
  }, [user]);

  async function update(body?: Record<string, unknown>, orgId = data?.selectedOrg ?? '') {
    if (!user || isSampleMode() || busy) return;
    const uid = user.uid, id = ++request.current;
    setBusy(true); setError(''); setSaved(false);
    try {
      const headers = await paidApiHeaders(user);
      const url = `/api/ai-render/settings${orgId ? `?org=${encodeURIComponent(orgId)}` : ''}`;
      if (body) {
        const response = await fetch(url, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const result = await response.json();
        if (!response.ok || !result.saved) throw new Error(result.error ?? 'AI map settings were not saved.');
      }
      const response = await fetch(url, { headers, cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'AI map settings could not be checked.');
      if (id === request.current && activeUid.current === uid) {
        setData({ ...result, uid }); setSaved(Boolean(body));
        if (body) window.dispatchEvent(new Event('imbewu-ai-map-access-changed'));
      }
    } catch (e) { if (id === request.current && activeUid.current === uid) setError((e as Error).message); }
    finally { if (id === request.current && activeUid.current === uid) setBusy(false); }
  }

  const current = data?.uid === user?.uid ? data : null;
  const org = current?.organizations.find(o => o.id === current.selectedOrg);
  return <section lang="en" aria-label="AI glossy map settings" style={{ marginBottom: 28, borderTop: '1px solid var(--border)', paddingTop: 18 }}>
    <h3 style={{ fontSize: 18, fontWeight: 700 }}>AI glossy maps{lang !== 'en' ? ' (English)' : ''}</h3>
    <p style={{ fontSize: 13, lineHeight: 1.5 }}>Choose whether your account can start paid map renders. Each render uses the platform’s AI service. Saved maps and free exact maps remain available when access is off.</p>
    {!user || isSampleMode() ? <p>Sign in to your own account to manage paid AI maps. This control is unavailable in the sample farm.</p> : <>
      {!current && !error && <p role="status">Checking AI map access…</p>}
      {current && <>
        <label style={row}><input type="checkbox" role="switch" aria-label="Enable AI glossy maps for my account" checked={current.personalEnabled} disabled={busy} onChange={e => { void update({ action: 'personal', enabled: e.target.checked }); }} />Enable AI glossy maps for my account</label>
        <p style={{ fontSize: 13 }} role="status">{current.access.allowed ? 'AI glossy maps are ready. Open Design Studio → Glossy → AI Polished.' : current.access.message}</p>
        {current.master && <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginTop: 14 }}>
          <h4 style={{ fontWeight: 700 }}>Your master controls</h4>
          <p style={{ fontSize: 13 }}>Only your platform master account can switch the service or an organisation’s access on and off. Suspending an organisation blocks new renders even if its staff previously granted access.</p>
          <label style={row}><input type="checkbox" role="switch" aria-label="Allow paid AI maps across the platform" checked={current.globalEnabled} disabled={busy} onChange={e => { void update({ action: 'global', enabled: e.target.checked }); }} />Allow paid AI maps across the platform</label>
        </div>}
        {current.canManage && <div style={{ marginTop: 18 }}>
          <h4 style={{ fontWeight: 700 }}>Organisation AI map access</h4>
          {current.organizations.length === 0 ? <p>No organisations have been created yet.</p> : <>
            <label htmlFor="ai-map-organization">Organisation</label>
            <select id="ai-map-organization" style={{ ...inputStyle, width: '100%', marginTop: 6 }} value={current.selectedOrg ?? ''} disabled={busy} onChange={e => { void update(undefined, e.target.value); }}>
              {current.organizations.map(o => <option value={o.id} key={o.id}>{o.name}</option>)}
            </select>
            {org && <>
              {current.master ? <label style={row}><input type="checkbox" role="switch" aria-label={`Allow AI maps for ${org.name}`} checked={org.enabled} disabled={busy} onChange={e => { void update({ action: 'organization', orgId: org.id, enabled: e.target.checked }); }} />Allow AI maps for this organisation</label> : <p>{org.enabled ? 'The platform has enabled AI maps for your organisation.' : 'AI maps are suspended by the platform. Contact the platform owner to restore access.'}</p>}
              <fieldset disabled={busy || !org.enabled} style={{ marginTop: 12 }}><legend>Give access by role</legend>
                {AI_MAP_ROLES.map(role => <label key={role} style={row}><input type="checkbox" checked={org.roles.includes(role)} onChange={e => { void update({ action: 'roles', orgId: org.id, roles: e.target.checked ? [...org.roles, role] : org.roles.filter(r => r !== role) }); }} />{roleNames[role]}</label>)}
              </fieldset>
              <details style={{ marginTop: 14 }}><summary style={{ cursor: 'pointer', minHeight: 44 }}>Individual member access ({current.members.length})</summary>
                <p style={{ fontSize: 13 }}>Use the role rule, allow this person, or block this person. Each person also controls their own Settings switch.</p>
                {current.members.map(member => <label key={member.id} style={{ display: 'block', marginBottom: 12 }}><span>{member.name} · {member.role}</span><select style={{ ...inputStyle, display: 'block', width: '100%' }} aria-label={`AI access for ${member.name}`} value={member.granted === null ? 'role' : member.granted ? 'allow' : 'block'} disabled={busy || !org.enabled} onChange={e => { void update({ action: 'member', orgId: org.id, uid: member.id, granted: e.target.value === 'role' ? null : e.target.value === 'allow' }); }}><option value="role">Use role rule</option><option value="allow">Allow this person</option><option value="block">Block this person</option></select></label>)}
              </details>
            </>}
          </>}
        </div>}
      </>}
      <button type="button" style={{ ...inputStyle, marginTop: 12 }} disabled={busy} onClick={() => { void update(); }}>Refresh AI map access</button>
    </>}
    {busy && <p role="status">Saving and checking access…</p>}
    {saved && !busy && <p role="status">AI map settings saved.</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
