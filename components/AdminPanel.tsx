'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Search, Plus, Trash2 } from 'lucide-react';
import { paidApiHeaders } from '@/lib/api-client-auth';
import type { Organization, Grant, UserRole } from '@/lib/db/types';

// Everything here talks to app/api/admin/* (Admin-SDK-backed, requireAdmin()-gated) — none of it
// touches Firestore directly, since profiles.role/org_id are client-immutable by rule and
// /grants denies all client writes. Role + org assignment only, per the plan: no suspend/
// disable, no audit-log UI.

const ROLES: readonly UserRole[] = ['farmer', 'mentor', 'student', 'ngo', 'funder', 'admin'];

interface AdminUser { id: string; full_name: string | null; role: UserRole | null; org_id: string | null }

const cardStyle: React.CSSProperties = { background: '#FFFEFA', border: '1px solid #E2D8C4', borderRadius: 16 };
const inputStyle: React.CSSProperties = {
  background: '#FBF6EC', border: '1px solid #E2D8C4', borderRadius: 8,
  padding: '6px 10px', fontSize: 12, color: '#20190F',
};

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = { ...(await paidApiHeaders()), ...(init?.headers ?? {}) };
  const res = await fetch(path, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof body.error === 'string' ? body.error : `Request failed (${res.status}).`);
  return body as T;
}

export default function AdminPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [u, o, g] = await Promise.all([
        apiFetch<{ users: AdminUser[] }>('/api/admin/users'),
        apiFetch<{ orgs: Organization[] }>('/api/admin/orgs'),
        apiFetch<{ grants: Grant[] }>('/api/admin/grants'),
      ]);
      setUsers(u.users);
      setOrgs(o.orgs);
      setGrants(g.grants);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin data.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const orgById = useMemo(() => new Map(orgs.map((o) => [o.id, o])), [orgs]);
  const filteredUsers = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return users;
    return users.filter((u) => (u.full_name ?? '').toLowerCase().includes(query) || u.id.toLowerCase().includes(query));
  }, [users, q]);

  if (busy && users.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={22} className="animate-spin" style={{ color: '#1F4D2B' }} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 flex flex-col gap-6 font-sans" style={{ color: '#20190F' }}>
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-lg font-semibold">Platform admin</h1>
        <button onClick={refresh} disabled={busy} className="flex items-center gap-1.5 text-xs font-display"
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E2D8C4', background: '#FBF6EC', color: '#5C5040', cursor: busy ? 'default' : 'pointer' }}>
          <RefreshCw size={12} className={busy ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg px-3 py-2 text-xs font-sans" style={{ background: '#FBEAE5', border: '1px solid #E3B4A6', color: '#8C3B23' }}>
          {error}
        </div>
      )}

      <UsersSection users={filteredUsers} orgs={orgs} orgById={orgById} q={q} setQ={setQ} onChanged={refresh} />
      <OrgsSection orgs={orgs} onCreated={refresh} />
      <GrantsSection grants={grants} orgs={orgs} orgById={orgById} onChanged={refresh} />
    </div>
  );
}

// ─── Users ───────────────────────────────────────────────────────────────────

function UsersSection({
  users, orgs, orgById, q, setQ, onChanged,
}: {
  users: AdminUser[]; orgs: Organization[]; orgById: Map<string, Organization>;
  q: string; setQ: (v: string) => void; onChanged: () => void;
}) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  async function saveRow(id: string, patch: { role?: UserRole; org_id?: string | null }) {
    setSavingId(id);
    setRowError(null);
    try {
      await apiFetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: id, ...patch }),
      });
      onChanged();
    } catch (err) {
      setRowError({ id, message: err instanceof Error ? err.message : 'Update failed.' });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <section style={cardStyle} className="p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-display text-sm font-semibold">Users</h2>
        <div className="flex items-center gap-1.5" style={inputStyle}>
          <Search size={12} style={{ color: '#8C7A62' }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or uid"
            className="bg-transparent outline-none text-xs"
            style={{ width: 180 }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {users.length === 0 && <p className="text-xs" style={{ color: '#8C7A62' }}>No users match.</p>}
        {users.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-2 py-2" style={{ borderTop: '1px solid #E2D8C4' }}>
            <div className="flex-1 min-w-[140px]">
              <p className="text-xs font-semibold" style={{ color: '#20190F' }}>{u.full_name || '(no name)'}</p>
              <p className="text-[10px] font-mono" style={{ color: '#8C7A62' }}>{u.id}</p>
            </div>
            <select
              defaultValue={u.role ?? ''}
              onChange={(e) => saveRow(u.id, { role: e.target.value as UserRole })}
              disabled={savingId === u.id}
              style={inputStyle}
            >
              <option value="" disabled>role...</option>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select
              defaultValue={u.org_id ?? ''}
              onChange={(e) => saveRow(u.id, { org_id: e.target.value || null })}
              disabled={savingId === u.id}
              style={inputStyle}
            >
              <option value="">no org</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.kind})</option>)}
            </select>
            {u.org_id && !orgById.has(u.org_id) && (
              <span className="text-[10px]" style={{ color: '#8C3B23' }}>org_id has no matching org</span>
            )}
            {savingId === u.id && <Loader2 size={12} className="animate-spin" style={{ color: '#1F4D2B' }} />}
            {rowError?.id === u.id && <span className="text-[10px]" style={{ color: '#8C3B23' }}>{rowError.message}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Orgs ────────────────────────────────────────────────────────────────────

function OrgsSection({ orgs, onCreated }: { orgs: Organization[]; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'ngo' | 'funder'>('ngo');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createOrg() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/admin/orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), kind }),
      });
      setName('');
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create org.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={cardStyle} className="p-4">
      <h2 className="font-display text-sm font-semibold mb-3">Organisations</h2>
      <div className="flex flex-col gap-1.5 mb-3">
        {orgs.length === 0 && <p className="text-xs" style={{ color: '#8C7A62' }}>No organisations yet.</p>}
        {orgs.map((o) => (
          <div key={o.id} className="flex items-center gap-2 text-xs py-1" style={{ borderTop: '1px solid #E2D8C4' }}>
            <span className="font-semibold flex-1">{o.name}</span>
            <span className="font-mono" style={{ color: '#8C7A62' }}>{o.kind}</span>
            <span className="font-mono text-[10px]" style={{ color: '#8C7A62' }}>{o.id}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Org name" style={{ ...inputStyle, width: 200 }} />
        <select value={kind} onChange={(e) => setKind(e.target.value as 'ngo' | 'funder')} style={inputStyle}>
          <option value="ngo">ngo</option>
          <option value="funder">funder</option>
        </select>
        <button onClick={createOrg} disabled={busy || !name.trim()} className="flex items-center gap-1 text-xs font-display"
          style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#C07A1E', color: '#FBF6EC', cursor: busy ? 'default' : 'pointer' }}>
          <Plus size={12} /> Create
        </button>
        {error && <span className="text-[10px]" style={{ color: '#8C3B23' }}>{error}</span>}
      </div>
    </section>
  );
}

// ─── Grants ──────────────────────────────────────────────────────────────────

function GrantsSection({
  grants, orgs, orgById, onChanged,
}: { grants: Grant[]; orgs: Organization[]; orgById: Map<string, Organization>; onChanged: () => void }) {
  const funders = useMemo(() => orgs.filter((o) => o.kind === 'funder'), [orgs]);
  const ngos = useMemo(() => orgs.filter((o) => o.kind === 'ngo'), [orgs]);
  const [funderOrgId, setFunderOrgId] = useState('');
  const [ngoOrgId, setNgoOrgId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createGrant() {
    if (!funderOrgId || !ngoOrgId) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/admin/grants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funder_org_id: funderOrgId, ngo_org_id: ngoOrgId }),
      });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create grant.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteGrant(id: string) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/admin/grants?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete grant.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={cardStyle} className="p-4">
      <h2 className="font-display text-sm font-semibold mb-1">Grants</h2>
      <p className="text-[11px] mb-3" style={{ color: '#8C7A62' }}>
        A grant lets a funder org see one NGO org&rsquo;s data on the funder dashboard.
      </p>
      <div className="flex flex-col gap-1.5 mb-3">
        {grants.length === 0 && <p className="text-xs" style={{ color: '#8C7A62' }}>No grants yet.</p>}
        {grants.map((g) => (
          <div key={g.id} className="flex items-center gap-2 text-xs py-1" style={{ borderTop: '1px solid #E2D8C4' }}>
            <span className="flex-1">
              {orgById.get(g.funder_org_id)?.name ?? g.funder_org_id} &rarr; {orgById.get(g.ngo_org_id)?.name ?? g.ngo_org_id}
            </span>
            <button onClick={() => deleteGrant(g.id)} disabled={busy} title="Revoke grant"
              style={{ background: 'none', border: 'none', cursor: busy ? 'default' : 'pointer', color: '#8C3B23' }}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select value={funderOrgId} onChange={(e) => setFunderOrgId(e.target.value)} style={inputStyle}>
          <option value="">funder org...</option>
          {funders.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <span className="text-xs" style={{ color: '#8C7A62' }}>&rarr;</span>
        <select value={ngoOrgId} onChange={(e) => setNgoOrgId(e.target.value)} style={inputStyle}>
          <option value="">ngo org...</option>
          {ngos.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <button onClick={createGrant} disabled={busy || !funderOrgId || !ngoOrgId} className="flex items-center gap-1 text-xs font-display"
          style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#C07A1E', color: '#FBF6EC', cursor: busy ? 'default' : 'pointer' }}>
          <Plus size={12} /> Grant
        </button>
        {error && <span className="text-[10px]" style={{ color: '#8C3B23' }}>{error}</span>}
      </div>
    </section>
  );
}
