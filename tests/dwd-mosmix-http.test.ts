import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate as turn } from 'node:timers/promises';
import { fetchDwdMosmixArchive, DWD_MOSMIX_HTTP_LIMITS, type DwdMosmixHttpOptions,
  type DwdMosmixHttpResult } from '../lib/international/providers/dwd-mosmix-http.ts';

// Opaque synthetic transport bytes. They are deliberately not a valid KMZ or
// forecast: receiving bytes must never pretend archive/XML checks have passed.
const bytes = new Uint8Array([80, 75, 3, 4, 1, 2, 3, 4]);
const endpoint = 'https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/A051/kml/MOSMIX_L_LATEST_A051.kmz';
const mime = 'application/vnd.google-earth.kmz';
const clock = () => new Date('2001-02-03T04:05:06.321Z');
const response = (body: BodyInit | null = bytes, headers: HeadersInit = { 'content-type': mime }) => new Response(body, { headers });
const fetcher = (run: (url: string, init: RequestInit) => Response | Promise<Response>): typeof fetch =>
  async (url, init) => run(String(url), init ?? {});
function failure(result: DwdMosmixHttpResult, reason: string) {
  assert.equal(result.status, 'failed');
  if (result.status !== 'failed') throw Error('Damaged transport input was retrieved');
  assert.equal(result.reason, reason); assert.equal(result.provenance, null); assert.ok(Object.isFrozen(result));
  assert.equal('archive' in result, false); return result;
}

test('one canonical public-station request returns immutable bytes and an explicit receipt, never decoded weather', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const result = await fetchDwdMosmixArchive({ stationId: 'A051' }, { now: clock,
    fetcher: fetcher((url, init) => { calls.push({ url, init }); return response(); }) });
  assert.equal(result.status, 'retrieved');
  if (result.status !== 'retrieved') throw Error('Synthetic transport control was held');
  assert.equal(calls.length, 1); assert.equal(calls[0].url, endpoint);
  assert.equal(calls[0].init.redirect, 'error'); assert.equal(calls[0].init.credentials, 'omit'); assert.equal(calls[0].init.cache, 'no-store');
  assert.ok(calls[0].init.signal instanceof AbortSignal);
  assert.match(new Headers(calls[0].init.headers).get('accept')!, /application\/vnd\.google-earth\.kmz/);
  assert.deepEqual(result.provenance, { providerId: 'dwd-mosmix-station-reference', endpoint,
    fetchedAt: '2001-02-03T04:05:06.321Z', expectedStationId: 'A051', kind: 'public-station', referenceOnly: true });
  assert.deepEqual(new Uint8Array(await result.archive.arrayBuffer()), bytes);
  assert.equal(result.archive.type, mime); assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.provenance));
  assert.deepEqual(Object.keys(result).sort(), ['archive','provenance','status']);
  assert.equal('periods' in result, false); assert.equal('country' in result, false);
});

for (const [stationId, expected] of [['01001','01001'],['A051','A051'],['A0001','A0001'],['AB123','AB123']]) {
  test(`the transport preserves station spelling ${stationId} without a default`, async () => {
    let called = '';
    const result = await fetchDwdMosmixArchive({ stationId }, { now: clock, fetcher: fetcher(url => { called = url; return response(); }) });
    assert.equal(result.status, 'retrieved');
    assert.equal(called, `https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/${expected}/kml/MOSMIX_L_LATEST_${expected}.kmz`);
  });
}
for (const input of [null, {}, { stationId: 'a051' }, { stationId: 'A051\n' }, { stationId: '../A051' },
  { stationId: 'A051', url: 'https://other.example' }, { stationId: '1234' }]) {
  test(`invalid station selection ${JSON.stringify(input)} never inspects options or makes a request`, async () => {
    let reads = 0;
    const options = Object.defineProperty({}, 'fetcher', { get() { reads++; throw Error('Must not read options'); } });
    failure(await fetchDwdMosmixArchive(input, options), 'invalid-station'); assert.equal(reads, 0);
  });
}
for (const [key,value] of [['fetcher',1],['now',1],['timeoutMs',0],['timeoutMs',-1],['timeoutMs',NaN],['timeoutMs',Infinity]]) {
  test(`invalid own ${key} option is held before provider access`, async () => {
    let calls = 0;
    const options = { fetcher: fetcher(() => { calls++; return response(); }), [key]: value };
    failure(await fetchDwdMosmixArchive({ stationId:'A051' }, options as DwdMosmixHttpOptions), 'invalid-options'); assert.equal(calls,0);
  });
}
test('ordinary option accessors are held without invoking them', async () => {
  let calls = 0, reads = 0;
  const options = { fetcher: fetcher(() => { calls++; return response(); }) };
  Object.defineProperty(options, 'now', { get() { reads++; return clock; } });
  failure(await fetchDwdMosmixArchive({ stationId:'A051' }, options), 'invalid-options');
  assert.equal(reads,0); assert.equal(calls,0);
});

for (const type of [mime,'application/zip','application/octet-stream','APPLICATION/VND.GOOGLE-EARTH.KMZ; charset=binary']) {
  test(`a supported binary content type ${type} stays an undecoded retrieval`, async () => {
    const result = await fetchDwdMosmixArchive({ stationId:'A051' }, { now:clock, fetcher:fetcher(() => response(bytes,{'content-type':type})) });
    assert.equal(result.status,'retrieved'); assert.equal('periods' in result,false);
  });
}
for (const type of [null,'text/html','application/json','application/vnd.google-earth.kml+xml']) {
  test(`an absent or non-archive content type ${type} does not become weather data`, async () => {
    let cancelled = 0;
    const stream = new ReadableStream<Uint8Array>({ cancel() { cancelled++; } });
    const headers: Record<string,string> = type === null ? {} : { 'content-type':type };
    failure(await fetchDwdMosmixArchive({ stationId:'A051' }, { fetcher:fetcher(() => response(stream,headers)) }), 'malformed-response');
    await turn(); assert.equal(cancelled,1);
  });
}
for (const status of [404,500]) {
  test(`HTTP ${status} is reported once without retry or replacement bytes`, async () => {
    let calls = 0;
    const result = await fetchDwdMosmixArchive({ stationId:'A051' }, { fetcher:fetcher(() => { calls++; return new Response('source error',{status}); }) });
    assert.equal(failure(result,'http-error').httpStatus,status); assert.equal(calls,1);
  });
}
for (const [header, expected] of [['0',0],['60',60],['tomorrow',null],['9007199254740993',null]] as const) {
  test(`rate limiting retains a known whole-second delay or unknown for ${header}`, async () => {
    let calls = 0;
    const result = await fetchDwdMosmixArchive({ stationId:'A051' }, { fetcher:fetcher(() => { calls++; return new Response(null,{status:429,headers:{'retry-after':header}}); }) });
    assert.equal(failure(result,'rate-limited').retryAfterSeconds,expected); assert.equal(calls,1);
  });
}
for (const field of ['redirected','url']) {
  test(`a substituted ${field} cannot authorize a second network destination`, async () => {
    let calls = 0;
    const result = await fetchDwdMosmixArchive({ stationId:'A051' }, { fetcher:fetcher(() => {
      calls++; const r = response(); Object.defineProperty(r,field,{value:field==='redirected'?true:'https://other.example/archive.kmz'}); return r;
    }) });
    failure(result,field==='redirected'?'http-error':'malformed-response'); assert.equal(calls,1);
  });
}
for (const value of ['-1','1.2','unknown']) {
  test(`a malformed declared byte count ${value} is held`, async () => {
    failure(await fetchDwdMosmixArchive({ stationId:'A051' }, { fetcher:fetcher(() => response(bytes,{'content-type':mime,'content-length':value})) }), 'malformed-response');
  });
}
test('a declared oversized body is cancelled before stream consumption', async () => {
  let pulls = 0, cancelled = 0;
  const stream = new ReadableStream<Uint8Array>({ pull() { pulls++; }, cancel() { cancelled++; } },{highWaterMark:0});
  failure(await fetchDwdMosmixArchive({ stationId:'A051' }, { fetcher:fetcher(() => response(stream,{'content-type':mime,'content-length':String(DWD_MOSMIX_HTTP_LIMITS.responseBytes+1)})) }), 'response-too-large');
  await turn(); assert.equal(pulls,0); assert.equal(cancelled,1);
});
test('an absent or falsely small length cannot bypass the actual streamed-byte bound', async () => {
  for (const length of [null,'1']) {
    let step = 0, cancelled = 0;
    const stream = new ReadableStream<Uint8Array>({ pull(c) {
      if(step===0){step++;c.enqueue(new Uint8Array(DWD_MOSMIX_HTTP_LIMITS.responseBytes));}
      else if(step===1){step++;c.enqueue(new Uint8Array([0]));}else c.close();
    }, cancel() { cancelled++; } },{highWaterMark:0});
    const headers: Record<string,string> = {'content-type':mime}; if(length!==null)headers['content-length']=length;
    failure(await fetchDwdMosmixArchive({stationId:'A051'},{fetcher:fetcher(()=>response(stream,headers))}),'response-too-large');
    await turn(); assert.equal(cancelled,1); assert.equal(step,2);
  }
});
test('a genuine streamed byte view cannot hide an oversized internal length behind an ordinary property', async () => {
  let reads = 0, cancelled = 0;
  const oversized = new Uint8Array(DWD_MOSMIX_HTTP_LIMITS.responseBytes+1);
  Object.defineProperty(oversized,'byteLength',{ get() { reads++; return 1; } });
  let supplied = false;
  const stream = new ReadableStream<Uint8Array>({pull(c){if(!supplied){supplied=true;c.enqueue(oversized);}else c.close();},cancel(){cancelled++;}},{highWaterMark:0});
  failure(await fetchDwdMosmixArchive({stationId:'A051'},{now:clock,fetcher:fetcher(()=>response(stream))}),'response-too-large');
  assert.equal(reads,0,'the actual byte bound must not execute an ordinary view getter');
  await turn(); assert.equal(cancelled,1);
});
test('the exact engineering byte boundary can be retrieved without treating the archive as decoded', async () => {
  const result = await fetchDwdMosmixArchive({stationId:'A051'},{now:clock,fetcher:fetcher(()=>response(new Uint8Array(DWD_MOSMIX_HTTP_LIMITS.responseBytes)))});
  assert.equal(result.status,'retrieved'); if(result.status!=='retrieved')throw Error('Exact byte boundary was held');
  assert.equal(result.archive.size,DWD_MOSMIX_HTTP_LIMITS.responseBytes); assert.equal('periods'in result,false);
});
test('reused stream buffers cannot mutate previously received bytes in the returned Blob', async () => {
  const shared = new Uint8Array([1,2]); let step = 0;
  const stream = new ReadableStream<Uint8Array>({ pull(c) {
    if(step++===0)c.enqueue(shared); else if(step===2){shared.fill(9);c.enqueue(new Uint8Array([3]));}else c.close();
  } },{highWaterMark:0});
  const result = await fetchDwdMosmixArchive({stationId:'A051'},{now:clock,fetcher:fetcher(()=>response(stream))});
  assert.equal(result.status,'retrieved'); if(result.status!=='retrieved')throw Error('Synthetic stream control was held');
  assert.deepEqual(new Uint8Array(await result.archive.arrayBuffer()),new Uint8Array([1,2,3]));
  shared.fill(8); assert.deepEqual(new Uint8Array(await result.archive.arrayBuffer()),new Uint8Array([1,2,3]));
});
test('empty or missing bodies are held instead of emitting a successful blank archive', async () => {
  for(const body of [null,new Uint8Array()])failure(await fetchDwdMosmixArchive({stationId:'A051'},{fetcher:fetcher(()=>response(body))}),'malformed-response');
});
test('a provider failure and a body failure remain separate from decoded source data', async () => {
  failure(await fetchDwdMosmixArchive({stationId:'A051'},{fetcher:fetcher(()=>Promise.reject(Error('private failure text')))}),'network-error');
  const stream = new ReadableStream<Uint8Array>({pull(c){c.error(Error('private stream text'));}});
  const result = failure(await fetchDwdMosmixArchive({stationId:'A051'},{fetcher:fetcher(()=>response(stream))}),'network-error');
  assert.ok(!JSON.stringify(result).includes('private'));
});
test('a stalled fetch cannot hold delivery past the total deadline and its late response is cancelled', async () => {
  let settle!: (r:Response)=>void, calls = 0, cancelled = 0, signal!:AbortSignal;
  const promise = fetchDwdMosmixArchive({stationId:'A051'},{timeoutMs:5,fetcher:fetcher((_url,init)=>{
    calls++; signal=init.signal!; return new Promise<Response>(resolve=>{settle=resolve;});
  })});
  failure(await promise,'timeout'); assert.equal(signal.aborted,true); assert.equal(calls,1);
  settle(response(new ReadableStream<Uint8Array>({cancel(){cancelled++;}})));
  await turn(); await turn(); assert.equal(cancelled,1); assert.equal(calls,1);
});
test('a stalled body is cancelled even when its cancellation acknowledgement never settles', async () => {
  let cancelled = 0;
  const stream = new ReadableStream<Uint8Array>({pull(){return new Promise<void>(()=>{});},cancel(){cancelled++;return new Promise<void>(()=>{});}});
  failure(await fetchDwdMosmixArchive({stationId:'A051'},{timeoutMs:5,fetcher:fetcher(()=>response(stream))}),'timeout');
  assert.equal(cancelled,1);
});
test('invalid receipt clocks do not create a provenance timestamp or substitute the current time', async () => {
  for(const now of [()=>new Date(NaN),()=>{throw Error('clock failed');}]) {
    const result = failure(await fetchDwdMosmixArchive({stationId:'A051'},{now,fetcher:fetcher(()=>response())}),'invalid-options');
    assert.equal(result.provenance,null); assert.ok(!JSON.stringify(result).includes('clock failed'));
  }
});

for (const type of ['application/zip, text/html','application/zip; charset=binary, text/html','application/zip; profile="a,b"']) {
  test(`a combined or comma-parameter content type ${type} is held before reading payload`, async () => {
    let reads = 0, cancelled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) { reads++; controller.enqueue(bytes); controller.close(); },
      cancel() { cancelled++; },
    }, { highWaterMark: 0 });
    const result = await fetchDwdMosmixArchive({ stationId:'A051' }, { fetcher:fetcher(() => response(stream,{'content-type':type})) });
    failure(result,'malformed-response'); assert.equal(reads,0); await turn(); assert.equal(cancelled,1);
  });
}
