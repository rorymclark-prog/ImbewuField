import type { ReportGenerationSettings } from '@/lib/saved-reports';
import styles from '../ReportView.module.css';

export default function ReportVersionDetails({ settings, language, savedAt, reference, sample = false }: {
  settings?: ReportGenerationSettings; language: string; savedAt?: string; reference?: string; sample?: boolean;
}) {
  const wording = settings?.tone === 'simple' ? 'Simple' : settings?.tone === 'professional' ? 'Detailed' : 'Not recorded';
  const depth = settings ? { 'one-pager': 'Brief advice', standard: 'Standard', comprehensive: 'Comprehensive' }[settings.length] : 'Not recorded';
  const date = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' });
  return <details className={styles.versionDetails}>
    <summary>
      <strong>{savedAt ? `Saved report · ${date(savedAt)}` : sample ? 'Prepared sample report' : 'New report · not saved yet'}</strong>
      <span>Wording: {wording} · Depth: {depth} · Language: {language}</span>
    </summary>
    <dl>
      {reference && <div><dt>Report reference</dt><dd>{reference}</dd></div>}
      <div><dt>Generated</dt><dd>{settings ? date(settings.generatedAt) : 'Not recorded'}</dd></div>
      <div><dt>English alongside</dt><dd>{settings ? settings.bilingual ? 'Yes' : 'No' : 'Not recorded'}</dd></div>
      <div><dt>Sections requested</dt><dd>{settings ? `${settings.sections.length} · ${settings.sections.join(', ')}` : 'Not recorded'}</dd></div>
      <div><dt>AI provider / model</dt><dd>{sample && !settings ? 'Prepared sample; no new AI call' : [settings?.provider, settings?.model].filter(Boolean).join(' / ') || 'Not recorded'}</dd></div>
    </dl>
    {!settings && !sample && <p>This older report did not record its original settings. The controls are for your next report.</p>}
  </details>;
}
