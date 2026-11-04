const { randomBytes, createHash } = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const base='http://127.0.0.1:5101', resource='http://127.0.0.1:4246/api/assistant/mcp';
(async()=>{
  const verifier=randomBytes(32).toString('base64url'), state=randomBytes(20).toString('hex');
  const client=await (await fetch(base+'/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_name:'Browser consent demonstration',redirect_uris:['http://127.0.0.1:7777/callback'],token_endpoint_auth_method:'none',grant_types:['authorization_code','refresh_token'],response_types:['code']})})).json();
  const query=new URLSearchParams({client_id:client.client_id,response_type:'code',code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',redirect_uri:'http://127.0.0.1:7777/callback',resource,scope:'field:read field:write',state});
  const authz=await fetch(base+'/authorize?'+query,{redirect:'manual'});
  fs.writeFileSync('/tmp/imbewu-connector-browser-url.json',JSON.stringify({url:authz.headers.get('location')}),{mode:0o600});
  const server=http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://127.0.0.1:7777');
      if(url.pathname!='/callback'){res.writeHead(404).end();return;}
      if(url.searchParams.get('state')!==state)throw Error('Callback state mismatch');
      if(url.searchParams.get('error')){res.end('Connection cancelled. No access was granted.');console.log('Browser cancellation verified.');server.close();return;}
      const response=await fetch(base+'/token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({grant_type:'authorization_code',client_id:client.client_id,code:url.searchParams.get('code'),code_verifier:verifier,redirect_uri:'http://127.0.0.1:7777/callback',resource})});
      if(!response.ok)throw Error('Callback token exchange failed');
      const tokens=await response.json();
      const sdk=new Client({name:'browser-demonstration',version:'1.0.0'});
      try{
        await sdk.connect(new StreamableHTTPClientTransport(new URL(base+'/mcp'),{requestInit:{headers:{Authorization:'Bearer '+tokens.access_token}}}));
        const identity=await sdk.callTool({name:'get_profile',arguments:{}}),sites=await sdk.callTool({name:'list_sites',arguments:{}});
        const result={identity:identity.structuredContent,sites:sites.structuredContent,tools:(await sdk.listTools()).tools.map(t=>t.name),browserConsentVerified:true};
        fs.writeFileSync('/tmp/imbewu-connector-browser-outcome.json',JSON.stringify(result,null,2));
        res.setHeader('Content-Type','text/plain');res.end('ImbewuField connected. The selected account and sites are available to the assistant.');
        console.log(JSON.stringify({browserConsentVerified:true,selectedSites:result.sites.sites.length,toolCount:result.tools.length}));
      }finally{await sdk.close();server.close();}
    }catch(e){res.statusCode=500;res.end(e.message);console.error(e);server.close();process.exitCode=1;}
  });
  server.listen(7777,'127.0.0.1',()=>console.log('Browser consent callback ready on 7777. Pending request saved locally.'));
})().catch(e=>{console.error(e);process.exitCode=1;});
