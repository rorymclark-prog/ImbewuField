import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { extractDwdMosmixArchive, DWD_MOSMIX_ARCHIVE_LIMITS } from '../lib/international/providers/dwd-mosmix-archive.ts';

// These tiny archives were independently generated/CRC-checked with Python's
// stdlib zipfile/zlib. Their bytes are synthetic, deliberately not valid KML.
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/dwd-mosmix-archive-synthetic.json', import.meta.url),'utf8'));
const metadata = fixtures.metadata;
const fixture = (name = 'descriptor'): Uint8Array<ArrayBuffer> => new Uint8Array(Buffer.from(fixtures.cases[name],'base64'));
const source = () => ({ providerId:'dwd-mosmix-station-reference', expectedStationId:'01234', kind:'public-station', referenceOnly:true,
  endpoint:'https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/01234/kml/MOSMIX_L_LATEST_01234.kmz',
  fetchedAt:'2001-02-03T04:05:06.321Z' });
async function held(bytes = fixture(), reason?:string, context:unknown = source(), signal?:AbortSignal) {
 const result = await extractDwdMosmixArchive(bytes,context,signal); assert.equal(result.status,'failed');
 if(result.status!=='failed')throw Error('Damaged synthetic archive extracted');
 assert.ok(['invalid-provenance','invalid-archive','software-bound','unsupported-archive','aborted'].includes(result.reason));
 if(reason)assert.equal(result.reason,reason);assert.ok(Object.isFrozen(result));assert.equal('kml'in result,false);return result;
}
function changed(write:(view:DataView,bytes:Uint8Array)=>void) { const bytes=fixture();write(new DataView(bytes.buffer),bytes);return bytes; }

for(const name of ['descriptor','withoutDescriptor'])test('an independent '+name+' archive yields exact immutable bytes, not decoded weather',async()=>{
 const bytes=fixture(name),before=bytes.slice(),context=source();const result=await extractDwdMosmixArchive(bytes,context);
 assert.equal(result.status,'extracted');if(result.status!=='extracted')throw Error('Valid independent archive held');
 assert.equal(result.filename,metadata.filename);assert.ok(result.kml instanceof Blob);assert.equal(result.kml.size,metadata.bodyBytes);
 assert.deepEqual(new Uint8Array(await result.kml.arrayBuffer()),new TextEncoder().encode(metadata.bodyUtf8));
 assert.deepEqual(bytes,before);assert.deepEqual(result.provenance,context);assert.notEqual(result.provenance,context);assert.ok(Object.isFrozen(result));assert.ok(Object.isFrozen(result.provenance));
 context.expectedStationId='99999';bytes.fill(0);assert.equal(result.provenance.expectedStationId,'01234');assert.equal(await result.kml.text(),metadata.bodyUtf8);
 assert.equal('periods'in result,false);assert.equal('temperature'in result,false);
});
test('the archive byte snapshot ignores ordinary view hooks and preserves the source input',async()=>{
 let reads=0;const bytes=fixture();const before=bytes.slice(); const backing=bytes.buffer; const offset=bytes.byteOffset; const length=bytes.byteLength;
 for(const name of ['byteLength','buffer','byteOffset','length','constructor','toJSON'])Object.defineProperty(bytes,name,{get(){reads++;throw Error('Must not execute ordinary input hook');}});
 Object.defineProperty(bytes,Symbol.iterator,{get(){reads++;throw Error('Must not iterate input');}});
 const result=await extractDwdMosmixArchive(bytes,source());assert.equal(result.status,'extracted');assert.equal(reads,0);
 assert.deepEqual(new Uint8Array(backing,offset,length),before);
});
test('invalid source context is rejected before inspecting unsafe input',async()=>{
 let reads=0;const bytes=fixture();Object.defineProperty(bytes,'byteLength',{get(){reads++;throw Error('Unsafe byte field');}});
 const result=await held(bytes,'invalid-provenance',{...source(),referenceOnly:false});assert.equal(result.provenance,null);assert.equal(reads,0);
});
for(const name of ['extraEntry','duplicateEntry','pathEntry','traversalEntry','newlineSuffix','wrongCase','wrongStation','storedMethod','symlinkEntry'])test('the '+name+' profile never yields a KML Blob',async()=>{await held(fixture(name));});
test('CRC validation checks actual decompressed data even when directory and descriptor agree on the same wrong CRC',async()=>{
 const bytes=changed(v=>{v.setUint32(metadata.offsets.centralCrc,metadata.crc32^1,true);v.setUint32(metadata.offsets.descriptorCrc,metadata.crc32^1,true);});await held(bytes,'invalid-archive');
});
test('a descriptor CRC differing from the directory is held even though actual body CRC matches the directory',async()=>{
 await held(changed(v=>v.setUint32(metadata.offsets.descriptorCrc,metadata.crc32^1,true)),'invalid-archive');
});
test('local and directory filenames must agree before a station-specific file can be returned',async()=>{
 const bytes=changed((_v,b)=>{const name=new TextEncoder().encode(metadata.filename.replace('01234','01235'));b.set(name,metadata.offsets.localName);});await held(bytes,'invalid-archive');
});
for(const cut of [0,1,10,22])test('truncated archive cut '+cut+' cannot become partial success',async()=>{
 const full=fixture();const bytes=cut===0?full.slice(0,metadata.offsets.central):full.slice(0,full.length-cut);await held(bytes,'invalid-archive');
});
test('an empty archive payload is explicitly held',async()=>{await held(new Uint8Array(),'invalid-archive');});
test('a compressed payload above the engineering ceiling is held before copying or codec work',async()=>{
 let reads=0;const bytes=new Uint8Array(DWD_MOSMIX_ARCHIVE_LIMITS.compressedBytes+1);Object.defineProperty(bytes,'byteLength',{get(){reads++;return 1;}});
 await held(bytes,'software-bound');assert.equal(reads,0);
});
test('oversized declared output is held before decompression rather than trusted for allocation',async()=>{
 const size=DWD_MOSMIX_ARCHIVE_LIMITS.uncompressedBytes+1;
 await held(changed(v=>{v.setUint32(metadata.offsets.centralUncompressedSize,size,true);v.setUint32(metadata.offsets.descriptorUncompressedSize,size,true);}),'software-bound');
});
test('declared-small output cannot be published after actual decoded size disagrees',async()=>{
 await held(changed(v=>{v.setUint32(metadata.offsets.centralUncompressedSize,1,true);v.setUint32(metadata.offsets.descriptorUncompressedSize,1,true);}),'invalid-archive');
});
test('an encrypted flag is unsupported rather than an invitation to request or guess a password',async()=>{
 await held(changed(v=>{v.setUint16(6,0x809,true);v.setUint16(metadata.offsets.central+8,0x809,true);}),'unsupported-archive');
});
test('an already aborted attempt cannot start an extraction',async()=>{
 const controller=new AbortController();controller.abort();await held(fixture(),'aborted',source(),controller.signal);
});
test('an immediate abort after starting a pending extraction cannot publish a Blob',async()=>{
 const controller=new AbortController();const pending=extractDwdMosmixArchive(fixture(),source(),controller.signal);controller.abort();
 const result=await pending;assert.equal(result.status,'failed');if(result.status!=='failed')throw Error('Aborted attempt extracted');assert.equal(result.reason,'aborted');assert.equal('kml'in result,false);
});

test('input bytes are detached before the first asynchronous codec step',async()=>{
 const bytes=fixture();const pending=extractDwdMosmixArchive(bytes,source());bytes.fill(0);
 const result=await pending;assert.equal(result.status,'extracted');if(result.status!=='extracted')throw Error('Input mutation changed the detached archive');
 assert.equal(await result.kml.text(),metadata.bodyUtf8);
});
test('a filename digit field is not claimed as validated XML issue time',async()=>{
 const result=await extractDwdMosmixArchive(fixture('nonCalendarIssue'),source());
 assert.equal(result.status,'extracted');if(result.status!=='extracted')throw Error('Filename calendar interpretation duplicated the XML authority');
 assert.equal(result.filename,metadata.filename.replace('2024022911','2024999911'));assert.equal(await result.kml.text(),metadata.bodyUtf8);
});

test('invalid provenance takes precedence over the compressed engineering ceiling',async()=>{
 const oversized=new Uint8Array(DWD_MOSMIX_ARCHIVE_LIMITS.compressedBytes+1);
 await held(oversized,'invalid-provenance',{...source(),referenceOnly:false});
});

// A controlled codec-output contract double reaches timing/chunk branches that
// the pinned real codec's own declared-size check rejects before output. It is
// deliberately not evidence of ZIP decoding; the independent ZIP cases above are.
async function codecContract(scenario: 'after-output-abort' | 'after-enumeration-abort' | 'oversized-chunk' | 'codec-error' | 'reused-chunk' | 'during-close-abort') {
  const { registerHooks } = await import('node:module');
  const key = '__dwdArchiveContract_' + scenario.replaceAll('-','_');
  const controller = new AbortController();
  const control = { controller, calls:0, closed:0, getterCalls:0, signal:null as AbortSignal | null, abortedAtClose:null as boolean | null };
  Object.defineProperty(globalThis,key,{ value:control, configurable:true });
  const moduleSource = `
    const control = globalThis[${JSON.stringify(key)}];
    export class Uint8ArrayReader { constructor(bytes) { this.bytes=bytes; } }
    export class ZipReader {
      constructor(reader, options) {}
      async *getEntriesGenerator() {
        yield { filename:'MOSMIX_L_2024022911_01234.kml', directory:false, symlink:false, encrypted:false,
          zip64:false, compressionMethod:8, compressedSize:1, uncompressedSize:${scenario === 'reused-chunk' ? 4 : 2},
          async getData(sink, options) {
            control.calls++; control.signal=options.signal;
            if (${JSON.stringify(scenario)} === 'codec-error') throw Error('PRIVATE codec body must not escape');
            const writer=sink.getWriter();
            try {
              if (${JSON.stringify(scenario)} === 'oversized-chunk') {
                const bytes=new Uint8Array(2097153);
                Object.defineProperty(bytes,'byteLength',{get(){control.getterCalls++;return 1;}});
                await writer.write(bytes);
              } else {
                const bytes=new Uint8Array([65,66]); await writer.write(bytes);
                if (${JSON.stringify(scenario)} === 'reused-chunk') { bytes[0]=67; await writer.write(bytes); bytes.fill(0); }
                await writer.close();
                if (${JSON.stringify(scenario)} === 'after-output-abort') control.controller.abort();
              }
            } finally { writer.releaseLock(); }
          }
        };
        if (${JSON.stringify(scenario)} === 'after-enumeration-abort') control.controller.abort();
      }
      async close() { control.closed++; control.abortedAtClose=control.signal?.aborted ?? null; if (${JSON.stringify(scenario)} === 'during-close-abort') { await Promise.resolve(); control.controller.abort(); } }
    }
  `;
  const codecUrl='data:text/javascript,'+encodeURIComponent(moduleSource);
  const url=new URL('../lib/international/providers/dwd-mosmix-archive.ts?contractCase='+scenario,import.meta.url);
  const hooks=registerHooks({resolve(specifier,context,nextResolve){
    if(specifier==='@zip.js/zip.js/index-native.js' && context.parentURL===url.href) return {url:codecUrl,shortCircuit:true};
    return nextResolve(specifier,context);
  }});
  try {
    const isolated = await import(url.href) as { extractDwdMosmixArchive: typeof extractDwdMosmixArchive };
    const result = await isolated.extractDwdMosmixArchive(new Uint8Array([1]),source(),controller.signal);
    return {result,control};
  } finally { hooks.deregister(); Reflect.deleteProperty(globalThis,key); }
}

test('contract double: caller abort after the last written chunk prevents Blob publication',async()=>{
 const {result,control}=await codecContract('after-output-abort');
 assert.equal(result.status,'failed');if(result.status!=='failed')throw Error('Post-output abort published bytes');
 assert.equal(result.reason,'aborted');assert.equal('kml'in result,false);assert.equal(control.calls,1);assert.equal(control.closed,1);
});
test('contract double: an abort as enumeration ends prevents starting decompression',async()=>{
 const {result,control}=await codecContract('after-enumeration-abort');
 assert.equal(result.status,'failed');if(result.status!=='failed')throw Error('Aborted enumeration published bytes');
 assert.equal(result.reason,'aborted');assert.equal(control.calls,0);assert.equal(control.closed,1);
});
test('contract double: output accounting uses intrinsic size before copying a deceptive oversized chunk',async()=>{
 const {result,control}=await codecContract('oversized-chunk');
 assert.equal(result.status,'failed');if(result.status!=='failed')throw Error('Oversized output published bytes');
 assert.equal(result.reason,'software-bound');assert.equal(control.getterCalls,0);assert.equal(control.closed,1);assert.equal(control.signal?.aborted,true);
});
test('contract double: failure aborts owned codec work before closing and never exposes raw errors',async()=>{
 const {result,control}=await codecContract('codec-error');
 assert.equal(result.status,'failed');if(result.status!=='failed')throw Error('Codec failure published bytes');
 assert.equal(result.reason,'invalid-archive');assert.equal(control.signal?.aborted,true);assert.equal(control.closed,1);assert.equal(control.abortedAtClose,true);
 assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
});
test('contract double: retained chunks survive reuse and later mutation of a codec buffer',async()=>{
 const {result,control}=await codecContract('reused-chunk');
 assert.equal(result.status,'extracted');if(result.status!=='extracted')throw Error('Valid detached chunks held');
 assert.equal(await result.kml.text(),'ABCB');assert.equal(control.calls,1);assert.equal(control.closed,1);
});

test('contract double: caller cancellation during asynchronous cleanup cannot publish a successful Blob',async()=>{
 const {result,control}=await codecContract('during-close-abort');
 assert.equal(result.status,'failed');if(result.status!=='failed')throw Error('Cleanup-time caller abort published bytes');
 assert.equal(result.reason,'aborted');assert.equal(control.calls,1);assert.equal(control.closed,1);assert.equal('kml' in result,false);
});
