// Accept the Sites preview flags while keeping normal Next development options.
import { spawn } from 'node:child_process';
const args=process.argv.slice(2).flatMap(arg=>arg==='--strictPort'?[]:[arg==='--host'?'--hostname':arg]);
if(!args.some(arg=>['--port','-p'].includes(arg)))args.push('--port','4242');
if(!args.some(arg=>['--hostname','-H'].includes(arg)))args.push('--hostname','0.0.0.0');
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev',...args],{stdio:'inherit',env:process.env});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code??1));
