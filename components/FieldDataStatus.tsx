'use client';
import { fieldDataReportNote } from '@/lib/field-request-model';
import { useLanguage } from '@/lib/i18n';
export default function FieldDataStatus({data}:{data:unknown}) {
  const { t } = useLanguage();
  const note=fieldDataReportNote(data);
  if(!note)return null;
  return <p role="status" style={{padding:'10px 12px',border:'1px solid var(--border)',borderRadius:10,fontSize:14,color:'var(--text-primary)'}}>{note} <a href="/offline">{t('navOfflineSync')}</a></p>;
}
