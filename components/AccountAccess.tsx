'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { startRolePreview, useSampleRole } from '@/lib/use-role-navigation';
import { accountText,accountRoleName,fillAccountText,isAccountDraftLanguage,type AccountCopy } from '@/lib/account-copy';
import AccountErrorText from './AccountErrorText';
import { useLanguage } from '@/lib/i18n';
import { inlineDraft, inlineText, inlineTemplate } from '@/lib/xh-inline';
import styles from './MelDashboard.module.css';

export default function AccountAccess() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const sampleRole = useSampleRole();
  const { lang,t } = useLanguage();
  // isiXhosa is an unreviewed machine draft too: it keeps the English source beside it like the
  // account-table languages, but its wording comes from the isiXhosa inline drafts.
  const isXhosa = lang === 'xh';
  // Afrikaans reads the same English-keyed inline drafts (lib/xh-inline.ts).
  const inlineDraftLang = isXhosa || lang === 'af';
  const draft = isAccountDraftLanguage(lang) || inlineDraftLang;
  const text:AccountCopy=(english,zulu,values)=>inlineDraftLang?fillAccountText(inlineText(lang,english),values):accountText(lang,english,zulu,t,values);
  const [message, setMessage] = useState('');
  const copy = (english: string, zulu: string) => draft ? <><span lang={lang}>{text(english,zulu)}</span><br /><small lang="en"><span lang={lang}>{t('offlineSourceLabel')}: </span>{english}</small></> : english;
  const label = (english: string, zulu: string) => draft ? `${text(english,zulu)} (${english})` : english;
  // Status messages stay English for AccountErrorText (it repaints the account-table languages);
  // isiXhosa shows its draft with the English source under it instead.
  const status = (source: string) => inlineDraftLang && inlineDraft(lang, source) ? <><bdi lang={lang}>{inlineText(lang, source)}</bdi><small lang="en" style={{display:'block',fontSize:12,lineHeight:1.4}}><span lang={lang}>{t('offlineSourceLabel')}: </span>{source}</small></> : <AccountErrorText source={source}/>;

  if (sampleRole) return <section lang={lang} className={`${styles.root} ${styles.card}`}>
    <h2>{copy('Explore role views', 'Hlola izikrini zezindima')}</h2>
    <p>{copy('Your account permissions stay unchanged.', 'Izimvume ze-akhawunti yakho zihlala zinjalo.')}</p>
    <a href="/samples" aria-label={text('Choose a view','Khetha isikrini')}>{label('Choose a view', 'Khetha isikrini')} →</a>
  </section>;

  const destinations = [
    ['Farmer', 'Umlimi', '/farmer'],
    ['Student', 'Umfundi', '/student'],
    ['Mentor', 'Umeluleki', '/mentor'],
    ['Organisation', 'Inhlangano', '/ngo'],
    ['Funder', 'Umxhasi wezimali', '/funder'],
  ] as const;

  return <section lang={lang} className={`${styles.root} ${styles.card}`}>
    <h2>{copy('Your app access', 'Ukungena kwakho kuhlelo lokusebenza')}</h2>
    <p>
      <strong>{profile?.role === 'admin' ? label('Platform administrator', 'Umlawuli wohlelo') : profile?.role ? accountRoleName(profile.role,text) : label('Profile not loaded','Iphrofayela ayikalayishwa')}</strong>
      {profile?.org_id
        ? label(' · linked to an organisation',' · kuxhunywe enhlanganweni')
        : label(' · no organisation linked',' · ayikho inhlangano exhunyiwe')}
    </p>
    {isXhosa && <p role="note">{inlineText(lang, 'The isiXhosa text is a draft awaiting review by a fluent isiXhosa speaker.')} (The isiXhosa text is a draft awaiting review by a fluent isiXhosa speaker.)</p>}
    {lang === 'af' && <p role="note">{inlineText(lang, 'The Afrikaans text is a draft awaiting review by a fluent Afrikaans speaker.')} (The Afrikaans text is a draft awaiting review by a fluent Afrikaans speaker.)</p>}
    <p>{profile?.role === 'admin'
      ? copy('Your account can open every role dashboard. Choose the relevant organisation inside the portfolio.', 'I-akhawunti yakho ingavula izikrini zazo zonke izindima. Khetha inhlangano efanele ngaphakathi kohlu lwamaphrojekthi.')
      : copy('Your normal login stays the same. A platform administrator must enable owner access on the correct account; choosing a dashboard does not change your permissions.', 'Indlela yakho evamile yokungena ihlala injalo. Umlawuli wohlelo kufanele avule ukufinyelela komnikazi ku-akhawunti efanele; ukukhetha isikrini akuzishintshi izimvume zakho.')}</p>
    <button aria-label={text('Refresh my access','Buyekeza ukufinyelela kwami')} onClick={async () => { try { await refreshProfile(); setMessage('Access refreshed.'); } catch { setMessage('Could not refresh access. Try again.'); } }}>
      {label('Refresh my access', 'Buyekeza ukufinyelela kwami')}
    </button>
    <p className={styles.muted}>{text('Signed in as ','Ungene ngemvume njengo-')}<bdi lang="">{user?.email ?? text('your linked account','i-akhawunti yakho exhunyiwe')}</bdi></p>
    {profile?.role === 'admin' && <div className={styles.row}>{destinations.map(([name, zulu, href]) => <a key={href} href={href} aria-label={`${text(name,zulu)} ${text('dashboard','isikrini')}`}>{label(name, zulu)} {text('dashboard','isikrini')}</a>)}</div>}
    {(profile?.role === 'ngo' || profile?.role === 'admin') && <>
      <h3 style={{ marginTop: 24 }}>{copy('Explore with demonstration records', 'Hlola ngamarekhodi okubonisa')}</h3>
      <a href="/samples" aria-label={text('Choose a practice view','Khetha isikrini sokuzilolonga')}>{label('Choose a practice view', 'Khetha isikrini sokuzilolonga')} →</a>
      <p>{copy('Try each role using the Ubhejane farm. Your account role stays the same and practice changes do not affect real projects.', 'Zama indima ngayinye usebenzisa ipulazi lase-Ubhejane. Indima ye-akhawunti yakho ihlala injalo, futhi izinguquko zokuzilolonga azithinti amaphrojekthi angempela.')}</p>
      <div className={styles.row}>{destinations.map(([name, zulu, href]) => <button key={href} aria-label={inlineDraftLang ? `${inlineTemplate(lang, 'Open {name} practice view', null, { name: inlineText(lang, name) })} (Open ${name} practice view)` : text(`Open ${name} practice view`, `Vula isikrini sokuzilolonga: ${zulu}`)} onClick={() => { if (startRolePreview(name.toLowerCase())) router.push(href); else setMessage('Tour mode could not start.'); }}>{label(name, zulu)}</button>)}</div>
    </>}
    {message && <p role="status">{status(message)}</p>}
  </section>;
}
