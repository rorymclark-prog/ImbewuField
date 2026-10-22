'use client';
import{useEffect,useRef}from'react';
import{usePathname}from'next/navigation';
import{useLanguage}from'@/lib/i18n';
import{keepsDocumentTitleOwner,resolvePageTitle,type PresentedPageTitle}from'@/lib/page-titles';

/** Next replaces metadata after navigation; translating only on a language change leaves it English. */
export default function LocalizedPageTitle(){
 const{lang,t}=useLanguage();
 const path=usePathname();
 const previous=useRef<PresentedPageTitle|null>(null);
 useEffect(()=>{
  if(keepsDocumentTitleOwner(path??'')){
   if(previous.current&&document.title===previous.current.value)document.title=previous.current.source;
   previous.current=null;
   return;
  }
  const present=()=>{
   const result=resolvePageTitle(document.title,previous.current,lang,t);
   previous.current=result;
   // A title write queues this observer too. Equality makes that callback a no-op.
   if(result&&document.title!==result.value)document.title=result.value;
  };
  const observer=new MutationObserver(present);
  observer.observe(document.head,{childList:true,subtree:true,characterData:true});
  present();
  return()=>observer.disconnect();
 },[lang,t,path]);
 return null;
}
