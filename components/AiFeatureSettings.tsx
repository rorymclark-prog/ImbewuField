'use client';
import { useEffect, useState } from 'react';
import { AI_FEATURES, type AiFeature } from '@/lib/ai-features';
import { disabledAiFeatures, saveDisabledAiFeatures } from '@/lib/ai-preferences';
import { useLanguage } from '@/lib/i18n';
export default function AiFeatureSettings() {
  const [disabled,setDisabled] = useState<AiFeature[]>([]), [error,setError] = useState(false);
  const { lang } = useLanguage();
  const zu = lang === 'zu';
  useEffect(()=>setDisabled(disabledAiFeatures()),[]);
  const keys = Object.keys(AI_FEATURES) as AiFeature[];
  function save(next:AiFeature[]) { if(saveDisabledAiFeatures(next)){setDisabled(next);setError(false);}else setError(true); }
  const labels: Record<AiFeature, string> = {
    chat: 'Ingxoxo nezeluleko zikaLima',
    receipts: 'Ukuskena amarisidi',
    reports: 'Ukubhala imibiko',
    notes: 'Ukuhlela amanothi okuvakasha',
    photos: 'Ukuhlaziya izithombe nezitshalo',
    designs: 'Imiklamo nezithombe ze-AI',
  };
  return <section style={{marginBottom:28}}><h3 style={{fontSize:18,fontWeight:700}}>{zu ? 'Amathuluzi e-AI akhokhelwayo' : 'Paid AI features'}</h3><p style={{fontSize:13,lineHeight:1.5,margin:'8px 0'}}>{zu ? 'Khetha amathuluzi e-AI le akhawunti engawasebenzisa kule divayisi. Ukuthayipha, ukubiza umbhalo ngocingo, izithombe nokulondoloza amarekhodi kusasebenza noma i-AI ivaliwe.' : 'Choose which AI tools this account can use on this device. Typing, phone dictation, photos and saving records still work when AI is off.'}</p>
    <label style={{display:'flex',alignItems:'center',gap:12,minHeight:48}}><input type="checkbox" checked={disabled.length===0} onChange={e=>save(e.target.checked?[]:keys)}/>{zu ? 'Vumela wonke amathuluzi e-AI akhokhelwayo' : 'Allow all paid AI tools'}</label>
    {keys.map(key=><label key={key} style={{display:'flex',alignItems:'center',gap:12,minHeight:44,fontSize:14}}><input type="checkbox" checked={!disabled.includes(key)} onChange={e=>save(e.target.checked?disabled.filter(k=>k!==key):[...disabled,key])}/>{zu ? labels[key] : AI_FEATURES[key]}</label>)}
    {error&&<p role="alert">{zu ? 'Lezi zilungiselelo azikwazanga ukulondolozwa.' : 'These settings could not be saved.'}</p>}
  </section>;
}
