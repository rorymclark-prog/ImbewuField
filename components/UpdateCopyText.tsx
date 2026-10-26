import { isUpdateCopyLanguage,updateDescription,type UpdateCopy } from '@/lib/update-copy';
export default function UpdateCopyText({source,lang,copy,sourceLabel}:{source:string;lang:string;copy:UpdateCopy;sourceLabel:string}) {
  const text=updateDescription(copy,source),translated=text!==source;
  return <><span lang={translated?lang:'en'}>{text}</span>{translated&&isUpdateCopyLanguage(lang)&&<small lang="en" style={{display:'block',fontSize:12,lineHeight:1.4,marginTop:4}}><span lang={lang}>{sourceLabel}: </span>{source}</small>}</>;
}
