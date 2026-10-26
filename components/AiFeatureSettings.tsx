'use client';
import { useEffect, useState } from 'react';
import { AI_FEATURES, type AiFeature } from '@/lib/ai-features';
import { disabledAiFeatures, saveDisabledAiFeatures } from '@/lib/ai-preferences';
import { useLanguage } from '@/lib/i18n';
export default function AiFeatureSettings() {
  const [disabled,setDisabled] = useState<AiFeature[]>([]), [error,setError] = useState(false);
  const { t } = useLanguage();
  useEffect(()=>setDisabled(disabledAiFeatures()),[]);
  const keys = Object.keys(AI_FEATURES) as AiFeature[];
  function save(next:AiFeature[]) { if(saveDisabledAiFeatures(next)){setDisabled(next);setError(false);}else setError(true); }
  const labels: Record<AiFeature, string> = {
    chat: 'settingsAiChat',
    receipts: 'settingsAiReceipts',
    reports: 'settingsAiReports',
    notes: 'settingsAiNotes',
    photos: 'settingsAiPhotos',
    designs: 'settingsAiDesigns',
  };
  return <section style={{marginBottom:28}}><h3 style={{fontSize:18,fontWeight:700}}>{t('settingsAiTitle')}</h3><p style={{fontSize:13,lineHeight:1.5,margin:'8px 0'}}>{t('settingsAiDescription')}</p>
    <label style={{display:'flex',alignItems:'center',gap:12,minHeight:48}}><input type="checkbox" checked={disabled.length===0} onChange={e=>save(e.target.checked?[]:keys)}/>{t('settingsAiAllowAll')}</label>
    {keys.map(key=><label key={key} style={{display:'flex',alignItems:'center',gap:12,minHeight:44,fontSize:14}}><input type="checkbox" checked={!disabled.includes(key)} onChange={e=>save(e.target.checked?disabled.filter(k=>k!==key):[...disabled,key])}/>{t(labels[key])}</label>)}
    {error&&<p role="alert">{t('settingsAiSaveError')}</p>}
  </section>;
}
