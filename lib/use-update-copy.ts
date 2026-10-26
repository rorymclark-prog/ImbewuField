'use client';
import { useEffect,useState } from 'react';
import { isUpdateCopyLanguage,loadUpdateCopy,type UpdateCopy } from './update-copy';
const EMPTY:UpdateCopy=Object.freeze({});
export function useUpdateCopy(lang:string,enabled:boolean,load=loadUpdateCopy) {
  const [state,setState]=useState<{lang:string;copy:UpdateCopy;failed:boolean}>({lang:'',copy:EMPTY,failed:false});
  useEffect(()=>{
    if(!enabled||!isUpdateCopyLanguage(lang))return;
    let active=true;
    load(lang).then(copy=>{if(active)setState({lang,copy,failed:false});}).catch(()=>{if(active)setState({lang,copy:EMPTY,failed:true});});
    return()=>{active=false;};
  },[lang,enabled,load]);
  const current=enabled&&state.lang===lang;
  return{copy:current?state.copy:EMPTY,pending:enabled&&isUpdateCopyLanguage(lang)&&!current,failed:current&&state.failed};
}
