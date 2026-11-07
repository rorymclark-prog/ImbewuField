'use client';
import { useEffect, useState } from 'react';
import { AI_FEATURES, type AiFeature } from '@/lib/ai-features';
import { disabledAiFeatures, saveDisabledAiFeatures } from '@/lib/ai-preferences';
import { useLanguage } from '@/lib/i18n';
import { inlineText } from '@/lib/xh-inline';
export default function AiFeatureSettings() {
  const [disabled,setDisabled] = useState<AiFeature[]>([]), [error,setError] = useState(false);
  const { lang, t } = useLanguage();
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
  // isiXhosa has no settingsAi* dictionary entries yet; it reads the inline drafts keyed by the English.
  const ui = (key: string, english: string) => lang === 'xh' ? inlineText(lang, english) : t(key);
  return <section style={{marginBottom:28}}><h3 style={{fontSize:18,fontWeight:700}}>{ui('settingsAiTitle', 'Paid AI features')}</h3><p style={{fontSize:13,lineHeight:1.5,margin:'8px 0'}}>{ui('settingsAiDescription', 'Choose which AI tools this account can use on this device. Typing, phone dictation, photos and saving records still work when AI is off.')}</p>
    <label style={{display:'flex',alignItems:'center',gap:12,minHeight:48}}><input type="checkbox" checked={disabled.length===0} onChange={e=>save(e.target.checked?[]:keys)}/>{ui('settingsAiAllowAll', 'Allow all paid AI tools')}</label>
    {keys.map(key=><label key={key} style={{display:'flex',alignItems:'center',gap:12,minHeight:44,fontSize:14}}><input type="checkbox" checked={!disabled.includes(key)} onChange={e=>save(e.target.checked?disabled.filter(k=>k!==key):[...disabled,key])}/>{ui(labels[key], AI_FEATURES[key])}</label>)}
    {error&&<p role="alert">{ui('settingsAiSaveError', 'These settings could not be saved.')}</p>}
  </section>;
}
