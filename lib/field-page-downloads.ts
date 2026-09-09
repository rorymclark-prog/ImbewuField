'use client';
export type FieldPageStatus = { path: string; ready: boolean; error?: string };
export const FIELD_PAGE_NAMES: Record<string,string> = { '/home':'Home', '/offline':'Offline & sync', '/farmer':'Garden & site survey', '/student':'Lessons', '/records':'Money book & harvests', '/invoice':'Invoices', '/journal':'Field journal', '/facilitator/crops':'Crop plan', '/cropplan':'Garden tasks', '/reports':'Saved reports', '/design':'Design studio', '/calendar':'Planting calendar', '/assessments':'Assessments', '/mentor':'Mentor fieldwork', '/ngo':'Organisation', '/funder':'Funder reports', '/network':'Garden portfolio' };
export async function fieldPageDownloads(prepare: boolean, paths: string[], onStatus: (status: FieldPageStatus)=>void) {
  if (!('serviceWorker' in navigator)) throw Error('This browser cannot prepare the app for offline use.');
  const registration = await navigator.serviceWorker.getRegistration('/');
  const worker = registration?.active;
  if (!worker) throw Error('The app is still preparing its first offline start. Keep it open with a connection and try again.');
  return new Promise<void>((resolve,reject)=>{
    const channel=new MessageChannel();let timer:ReturnType<typeof setTimeout>;
    const finish=(error?:string)=>{clearTimeout(timer);channel.port1.close();error?reject(Error(error)):resolve();};
    const reset=()=>{clearTimeout(timer);timer=setTimeout(()=>finish('Preparation timed out. Keep the app open with a connection and retry.'),90000);};reset();
    channel.port1.onmessage=event=>{reset();if(event.data.done){finish(event.data.error);return;}onStatus(event.data);};
    worker.postMessage({type:prepare?'PREPARE_FIELD_PAGES':'FIELD_PAGE_STATUS',paths},[channel.port2]);
  });
}
