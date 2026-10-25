import type { ReportGenerationSettings } from '@/lib/saved-reports';
import styles from '../ReportView.module.css';
import { useLanguage } from '@/lib/i18n';
import { inlineTemplate, inlineText } from '@/lib/xh-inline';

export default function ReportVersionDetails({ settings, language, savedAt, reference, sample = false }: {
  settings?: ReportGenerationSettings; language: string; savedAt?: string; reference?: string; sample?: boolean;
}) {
  const { lang } = useLanguage();
  const tx = (en: string) => inlineText(lang, en);
  const wording = settings?.tone === 'simple' ? tx('Simple') : settings?.tone === 'professional' ? tx('Detailed') : tx('Not recorded');
  const depth = settings ? { 'one-pager': tx('Brief advice'), standard: tx('Standard'), comprehensive: tx('Comprehensive') }[settings.length] : tx('Not recorded');
  const date = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' });
  return <details className={styles.versionDetails}>
    <summary>
      <strong>{savedAt ? inlineTemplate(lang, 'Saved report · {date}', null, { date: date(savedAt) }) : sample ? tx("Prepared report") : tx('New report · not saved yet')}</strong>
      <span>{inlineTemplate(lang, 'Wording: {wording} · Depth: {depth} · Language: {language}', null, { wording, depth, language })}</span>
    </summary>
    <dl>
      {reference && <div><dt>{tx('Report reference')}</dt><dd>{reference}</dd></div>}
      <div><dt>{tx('Generated')}</dt><dd>{settings ? date(settings.generatedAt) : tx('Not recorded')}</dd></div>
      <div><dt>{tx('English alongside')}</dt><dd>{settings ? settings.bilingual ? tx('Yes') : tx('No') : tx('Not recorded')}</dd></div>
      <div><dt>{tx('Sections requested')}</dt><dd>{settings ? `${settings.sections.length} · ${settings.sections.join(', ')}` : tx('Not recorded')}</dd></div>
      <div><dt>{tx('AI provider / model')}</dt><dd>{sample && !settings ? tx('Prepared report; no AI charge') : [settings?.provider, settings?.model].filter(Boolean).join(' / ') || tx('Not recorded')}</dd></div>
    </dl>
    {!settings && !sample && <p>{tx('This older report did not record its original settings. The controls are for your next report.')}</p>}
  </details>;
}
