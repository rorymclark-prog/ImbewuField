'use client';
import { useLanguage } from '@/lib/i18n';
import { accountErrorText } from '@/lib/account-copy';
export default function AccountErrorText({source}:{source:string}) {
 const {lang,t}=useLanguage(),result=accountErrorText(lang,source,t),translated=result.text!==source;
 return <><bdi lang={result.known?(translated?lang:'en'):''}>{result.text}</bdi>{translated&&<small lang="en" style={{display:'block',fontSize:12,lineHeight:1.4}}><span lang={lang}>{t('offlineSourceLabel')}: </span>{source}</small>}</>;
}
