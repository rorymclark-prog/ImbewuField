'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { startRolePreview } from '@/lib/use-role-navigation';
import styles from './MelDashboard.module.css';

export default function AccountAccess() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [message, setMessage] = useState('');
  const destinations = [['Farmer', '/farmer'], ['Student', '/student'], ['Mentor', '/mentor'], ['NGO', '/ngo'], ['Funder', '/funder']] as const;
  return <section className={`${styles.root} ${styles.card}`}><h2>Your app access</h2><p><strong>{profile?.role === 'admin' ? 'Platform administrator' : profile?.role ?? 'Profile not loaded'}</strong>{profile?.org_id ? ' · linked to an organisation' : ' · no organisation linked'}</p>
    <p>{profile?.role === 'admin' ? 'Your account can open every role dashboard. Choose the relevant organisation inside the portfolio.' : 'Your normal login stays the same. A platform administrator must enable owner access on the correct account; choosing a dashboard does not change your permissions.'}</p>
    <button onClick={async () => { try { await refreshProfile(); setMessage('Access refreshed.'); } catch { setMessage('Could not refresh access. Try again.'); } }}>Refresh my access</button>
    <p className={styles.muted}>Signed in as {user?.email ?? 'your linked account'}</p>
    {profile?.role === 'admin' && <div className={styles.row}>{destinations.map(([name, href]) => <a key={href} href={href}>{name} dashboard</a>)}</div>}
    {(profile?.role === 'ngo' || profile?.role === 'admin') && <><h3 style={{ marginTop: 24 }}>Explore with sample data</h3><a href="/samples">Open sample chooser →</a><p>Try each role using the sample farm. Your account role stays the same and sample changes do not affect real projects.</p>
    <div className={styles.row}>{destinations.map(([name, href]) => <button key={href} onClick={() => { if (startRolePreview(name.toLowerCase())) router.push(href); else setMessage('Sample mode could not start.'); }}>{name}</button>)}</div></>}{message && <p role="status">{message}</p>}
  </section>;
}
