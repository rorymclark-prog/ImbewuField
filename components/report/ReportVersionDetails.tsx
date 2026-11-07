'use client';
import { reportOriginLabel, type ReportGenerationSettings, type ReportOrigin } from '@/lib/saved-reports';
import { siteReportPurposeLabel } from '@/lib/site-survey';
import { useLanguage } from '@/lib/i18n';
import { reportUiText, reportUiDate } from '@/lib/report-localisation';
import styles from '../ReportView.module.css';
import { xhInlineDraft } from '@/lib/xh-inline';

export default function ReportVersionDetails({ settings, language, savedAt, reference, origin }: {
  settings?: ReportGenerationSettings; language: string; savedAt?: string; reference?: string; sample?: boolean; origin?: ReportOrigin;
}) {
  const { lang, t: appT } = useLanguage();
  // isiXhosa: the draft keyed by the exact English (lib/locales/xh-inline), else the dictionary.
  const t = (english: string) => (lang === 'xh' ? xhInlineDraft(english) : null) ?? reportUiText(english, lang, appT);
  const sample = origin === 'prepared-example';
  const wording = settings?.tone === 'simple' ? t('Simple') : settings?.tone === 'professional' ? t('Detailed') : t('Not recorded');
  const depth = settings ? t({ 'one-pager': 'Brief advice', standard: 'Standard', comprehensive: 'Comprehensive' }[settings.length]) : t('Not recorded');
  const date = (iso: string) => reportUiDate(lang, iso);
  return <details lang={lang} className={styles.versionDetails}>
    <summary>
      <strong>{savedAt ? t('Saved report · {date}').replace('{date}', date(savedAt)) : sample ? t('Prepared report') : t('New report · not saved yet')}</strong>
      <span>{t('Wording: {wording} · Depth: {depth} · Language: {language}').replace('{wording}', wording).replace('{depth}', depth).replace('{language}', language)}</span>
    </summary>
    <dl>
      <div><dt>{t('Purpose')}</dt><dd>{settings?.purpose ? siteReportPurposeLabel(settings.purpose, lang) : sample ? t('Prepared example') : t('Not recorded')}</dd></div>
      <div><dt>{t('Report origin')}</dt><dd>{reportOriginLabel(origin, lang)}</dd></div>
      {reference && <div><dt>{t('Report reference')}</dt><dd>{reference}</dd></div>}
      <div><dt>{t('Generated')}</dt><dd>{settings ? date(settings.generatedAt) : t('Not recorded')}</dd></div>
      <div><dt>{t('English alongside')}</dt><dd>{settings ? settings.bilingual ? t('Yes') : t('No') : t('Not recorded')}</dd></div>
      <div><dt>{t('Sections requested')}</dt><dd>{settings ? `${settings.sections.length} · ${settings.sections.map(t).join(', ')}` : t('Not recorded')}</dd></div>
      <div><dt>{t('AI provider / model')}</dt><dd>{sample && !settings ? t('Prepared report; no AI charge') : [settings?.provider, settings?.model].filter(Boolean).join(' / ') || t('Not recorded')}</dd></div>
    </dl>
    {!settings && !sample && <p>{t('This older report did not record its original settings. The controls are for your next report.')}</p>}
  </details>;
}
