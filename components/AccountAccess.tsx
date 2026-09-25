'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { startRolePreview, useSampleRole } from '@/lib/use-role-navigation';
import { useLanguage } from '@/lib/i18n';
import styles from './MelDashboard.module.css';

export default function AccountAccess() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const sampleRole = useSampleRole();
  const { lang } = useLanguage();
  const isZulu = lang === 'zu';
  const [message, setMessage] = useState('');
  const copy = (english: string, zulu: string) => isZulu ? <>{zulu}<br /><small>English source: {english}</small></> : english;
  const label = (english: string, zulu: string) => isZulu ? `${zulu} (${english})` : english;

  if (sampleRole) return <section className={`${styles.root} ${styles.card}`}>
    <h2>{copy('Explore role views', 'Hlola izikrini zezindima')}</h2>
    <p>{copy('Your account permissions stay unchanged.', 'Izimvume ze-akhawunti yakho zihlala zinjalo.')}</p>
    <a href="/samples">{label('Choose a view', 'Khetha isikrini')} →</a>
  </section>;

  const destinations = [
    ['Farmer', 'Umlimi', '/farmer'],
    ['Student', 'Umfundi', '/student'],
    ['Mentor', 'Umeluleki', '/mentor'],
    ['Organisation', 'Inhlangano', '/ngo'],
    ['Funder', 'Umxhasi wezimali', '/funder'],
  ] as const;

  return <section className={`${styles.root} ${styles.card}`}>
    <h2>{copy('Your app access', 'Ukungena kwakho kuhlelo lokusebenza')}</h2>
    <p>
      <strong>{profile?.role === 'admin' ? label('Platform administrator', 'Umlawuli wohlelo') : profile?.role ?? (isZulu ? 'Iphrofayela ayikalayishwa (Profile not loaded)' : 'Profile not loaded')}</strong>
      {profile?.org_id
        ? (isZulu ? ' · kuxhunywe enhlanganweni (linked to an organisation)' : ' · linked to an organisation')
        : (isZulu ? ' · ayikho inhlangano exhunyiwe (no organisation linked)' : ' · no organisation linked')}
    </p>
    {isZulu && <p role="note">Umbhalo wesiZulu uwuhlaka olusazobuyekezwa isikhulumi sesiZulu esinekhono. (The isiZulu text is a draft awaiting review by a fluent isiZulu speaker.)</p>}
    <p>{profile?.role === 'admin'
      ? copy('Your account can open every role dashboard. Choose the relevant organisation inside the portfolio.', 'I-akhawunti yakho ingavula izikrini zazo zonke izindima. Khetha inhlangano efanele ngaphakathi kohlu lwamaphrojekthi.')
      : copy('Your normal login stays the same. A platform administrator must enable owner access on the correct account; choosing a dashboard does not change your permissions.', 'Indlela yakho evamile yokungena ihlala injalo. Umlawuli wohlelo kufanele avule ukufinyelela komnikazi ku-akhawunti efanele; ukukhetha isikrini akuzishintshi izimvume zakho.')}</p>
    <button onClick={async () => { try { await refreshProfile(); setMessage(isZulu ? 'Ukufinyelela kubuyekeziwe. (Access refreshed.)' : 'Access refreshed.'); } catch { setMessage(isZulu ? 'Ayikwazanga ukubuyekeza ukufinyelela. Zama futhi. (Could not refresh access. Try again.)' : 'Could not refresh access. Try again.'); } }}>
      {label('Refresh my access', 'Buyekeza ukufinyelela kwami')}
    </button>
    <p className={styles.muted}>{isZulu ? 'Ungene ngemvume njengo-' : 'Signed in as '}{user?.email ?? (isZulu ? 'i-akhawunti yakho exhunyiwe (your linked account)' : 'your linked account')}</p>
    {profile?.role === 'admin' && <div className={styles.row}>{destinations.map(([name, zulu, href]) => <a key={href} href={href}>{label(name, zulu)} {isZulu ? 'isikrini' : 'dashboard'}</a>)}</div>}
    {(profile?.role === 'ngo' || profile?.role === 'admin') && <>
      <h3 style={{ marginTop: 24 }}>{copy('Explore with demonstration records', 'Hlola ngamarekhodi okubonisa')}</h3>
      <a href="/samples">{label('Choose a practice view', 'Khetha isikrini sokuzilolonga')} →</a>
      <p>{copy('Try each role using the Ubhejane farm. Your account role stays the same and practice changes do not affect real projects.', 'Zama indima ngayinye usebenzisa ipulazi lase-Ubhejane. Indima ye-akhawunti yakho ihlala injalo, futhi izinguquko zokuzilolonga azithinti amaphrojekthi angempela.')}</p>
      <div className={styles.row}>{destinations.map(([name, zulu, href]) => <button key={href} aria-label={label(`Open ${name} practice view`, `Vula isikrini sokuzilolonga: ${zulu}`)} onClick={() => { if (startRolePreview(name.toLowerCase())) router.push(href); else setMessage(isZulu ? 'Imodi yokuvakasha ayikwazanga ukuqala. (Tour mode could not start.)' : 'Tour mode could not start.'); }}>{label(name, zulu)}</button>)}</div>
    </>}
    {message && <p role="status">{message}</p>}
  </section>;
}
