import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { WEATHER_ENGLISH_PENDING } from '../lib/i18n-pending.ts';
import { WEATHER_REGIONAL_DRAFTS,WEATHER_ZU_DRAFTS,WEATHER_ERROR_COPY,weatherText,weatherEnglish,weatherDayKey,weatherDescKey,weatherDraftNotice,fillWeather } from '../lib/weather-copy.ts';
import {describeWeatherCode} from '../lib/weather.ts';
import { renderWeatherWidget,weatherFixture,weatherVisibleText } from './helpers/weather-widget-harness.ts';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const raw=gunzipSync(readFileSync(new URL('./fixtures/weather-translation/before.json.gz',import.meta.url)));
const before=JSON.parse(raw.toString())as{sourceSha:string;files:Array<{file:string;source:string;sha256:string}>;forecast:typeof weatherFixture;rows:Array<{input:Parameters<typeof renderWeatherWidget>[0];html:string}>};
const languages=['zu','st','ts','ve']as const,regional=['st','ts','ve']as const;
const flat=(text:string)=>text.normalize('NFC').replace(/\s/g,'');
const placeholders=(s:string)=>s.match(/\{\w+\}/g)?.sort()??[];
const text=(input:Parameters<typeof renderWeatherWidget>[0])=>weatherVisibleText(renderWeatherWidget(input));

test('weather display changes preserve original provider models, thresholds, source copy and every existing isiZulu draft',()=>{
 const manifest=JSON.parse(read('tests/fixtures/weather-translation/capture-manifest.json'));assert.equal(createHash('sha256').update(raw).digest('hex'),manifest.uncompressedSha256);assert.equal(before.sourceSha,manifest.sourceSha);assert.equal(before.rows.length,36);
 for(const file of['lib/weather.ts','lib/i18n-pending.ts','components/IsiZuluDraftSource.tsx','tests/w22-weather.test.ts'])assert.equal(createHash('sha256').update(read(file)).digest('hex'),before.files.find(row=>row.file===file)!.sha256,'weather facts, pending English authority and existing source-pair behavior remain original');
 const originalCopy=before.files.find(row=>row.file==='lib/weather-copy.ts')!.source;const originalZu=Object.fromEntries([...originalCopy.matchAll(/^  (weather\w+): '([^']*)',/gm)].map(m=>[m[1],m[2]]));assert.deepEqual(WEATHER_ZU_DRAFTS,originalZu);assert.deepEqual(weatherFixture,before.forecast);
 const packet=JSON.parse(read('docs/translation/four-language-completion/weather-drafts.json'));assert.match(packet.status,/IN PROGRESS/);assert.equal(packet.rows.length,24);assert.deepEqual(packet.rows.map((row:{key:string})=>row.key).sort(),Object.keys(WEATHER_ENGLISH_PENDING).sort());
 for(const row of packet.rows){assert.deepEqual(WEATHER_REGIONAL_DRAFTS[row.key],{english:row.english,st:row.st,ts:row.ts,ve:row.ve});assert.equal(row.english,WEATHER_ENGLISH_PENDING[row.key]);for(const lang of regional){assert.notEqual(row[lang],row.english);assert.deepEqual(placeholders(row[lang]),placeholders(row.english));assert.deepEqual(row[lang].match(/\d+(?:\.\d+)?/g)??[],row.english.match(/\d+(?:\.\d+)?/g)??[]);assert.equal(weatherText(lang,row.key),row[lang]);}}
});

test('English, existing isiZulu and unsupported weather keep the complete original text and values through all captured states',()=>{
 for(const row of before.rows)assert.equal(weatherVisibleText(renderWeatherWidget(row.input)),weatherVisibleText(row.html),JSON.stringify(row.input));
});

test('native hazards and irrigation pair complete filled source sentences while dates, warnings and water quantities stay unchanged',()=>{
 for(const lang of languages)for(const compact of[false,true]){const body=text({lang,compact}),expectedDays=(native:boolean,index:number)=>weatherText(native?lang:'en',weatherDayKey(new Date(2026,9,25+index).getDay(),index===0));for(const[key,index]of[['weatherFrostBanner',0],['weatherHeatBanner',1],['weatherHeavyRainBanner',2]]as const){for(const native of[false,true])assert.ok(flat(body).includes(flat(fillWeather(weatherText(native?lang:'en',key),{days:expectedDays(native,index)}))),'a partial label cannot stand in for a full warning and its real provider day');}
  for(const code of[lang,'en'])assert.ok(flat(body).includes(flat(fillWeather(weatherText(code,'weatherWaterLoss'),{mm:'3.2'}))));assert.ok(body.includes(weatherDraftNotice(lang)));for(const expected of['23°C','12 km/h','38°','-1°','30mm','80%'])assert.ok(body.includes(expected),'forecast values retain original rounding and dimensions: '+expected);
  const paragraph=fillWeather(weatherText(lang,'weatherHeatBanner'),{days:expectedDays(true,1)});const requireHeat=(value:string)=>assert.ok(flat(value).includes(flat(paragraph)),'both morning watering and seedling shade must survive');assert.throws(()=>requireHeat(body.replace(paragraph,'')),'keeping the English or other hazards must not conceal loss of the native source condition');
 }
});

test('regional weather error states retain the home/report distinction and show the complete native draft beside its source',()=>{
 for(const lang of languages)for(const context of['home','report']as const){const body=text({lang,status:'error',context}),key=context==='home'?'weatherErrorHome':'weatherErrorReport';assert.ok(body.includes(weatherText(lang,key)));assert.ok(body.includes(weatherEnglish(key)));assert.ok(body.includes(weatherDraftNotice(lang)));if(context==='home'){assert.ok(!body.includes(weatherEnglish('weatherErrorReport')));assert.ok(!body.includes(weatherText(lang,'weatherErrorReport')),'Home cannot promise a climate panel below it');}assert.equal(weatherText('xx',key),WEATHER_ERROR_COPY[key].english);}
});

test('weather descriptions and accessible no-rain words use the chosen language while null and zero water loss remain distinct',()=>{
 for(const lang of languages){for(const code of[0,1,3,45,51,61,71,80,85,95,90]){const forecast={...weatherFixture,current:{...weatherFixture.current,weatherCode:code}},body=text({lang,forecast});const key=weatherDescKey(describeWeatherCode(code).label);assert.ok(key,'exercise each real provider description branch');assert.ok(flat(body).includes(flat(weatherText(lang,key))),'the actual condition description must use the selected language');assert.ok(body.includes(weatherDraftNotice(lang)));assert.ok(!/\{(?:mm|days)\}/.test(body));}
  const html=renderWeatherWidget({lang});assert.ok(html.includes(`class="sr-only" lang="${lang}">${weatherText(lang,'weatherNoRain')}</span>`),'a visual no-rain dash needs the same native screen-reader meaning');
  const withEt0=(et0Mm:number|null)=>({...weatherFixture,daily:weatherFixture.daily.map((d,i)=>i===0?{...d,et0Mm}:d)});assert.ok(!text({lang,forecast:withEt0(null)}).includes(fillWeather(weatherText(lang,'weatherWaterLoss'),{mm:'3.2'})));assert.ok(text({lang,forecast:withEt0(0)}).includes(fillWeather(weatherText(lang,'weatherWaterLoss'),{mm:'0.0'})),'zero must not be hidden as missing');
 }
});

test('changed English and broken placeholder drafts fall back honestly, and inserted weather values stay literal',()=>{
 const key='weatherFrostBanner',english=WEATHER_ENGLISH_PENDING[key],row=WEATHER_REGIONAL_DRAFTS[key];try{WEATHER_ENGLISH_PENDING[key]='New source condition {days}';for(const lang of regional)assert.equal(weatherText(lang,key),WEATHER_ENGLISH_PENDING[key],'a draft cannot survive a changed source unnoticed');}finally{WEATHER_ENGLISH_PENDING[key]=english;}
 for(const lang of regional){const original=row[lang];try{row[lang]=original.replace('{days}','');assert.equal(weatherText(lang,key),english,'a lost provider day must refuse the draft');row[lang]=original+' {invented}';assert.equal(weatherText(lang,key),english,'an invented placeholder must refuse the draft');}finally{row[lang]=original;}}
 assert.equal(fillWeather('{days}; {mm}',{days:'{mm} $&',mm:'0.0'}),'{mm} $&; 0.0');assert.equal(fillWeather('{days} {mm}',{days:'Today'}),'Today {mm}');
});


test('native forecast weekdays remain tied to every source ISO day across a week boundary',()=>{
 for(const lang of languages)for(let shift=0;shift<7;shift++){
  const forecast={...weatherFixture,daily:weatherFixture.daily.map((day,index)=>({...day,date:new Date(Date.UTC(2026,9,25+shift+index)).toISOString().slice(0,10)}))};const body=text({lang,forecast});
  assert.ok(body.includes(weatherText(lang,'weatherToday')));
  for(let index=1;index<7;index++)assert.ok(body.includes(weatherText(lang,weatherDayKey((shift+index)%7,false))),'a translated day cannot drift away from its original provider date');
 }
});

test('offscreen no-rain meanings stay inside their scroll context rather than widening the phone document',()=>{
 const observed=JSON.parse(read('tests/fixtures/weather-translation/no-rain-overflow-before.json'))as{width:number;documentWidth:number;html:string};assert.ok(observed.documentWidth>observed.width,'retain the real failed phone measurement');
 const requireClippedMeaning=(html:string)=>{const stack:Array<{tag:string;clips:boolean;positioned:boolean}>=[];let meanings=0;for(const match of html.matchAll(/<(\/?)([a-z][a-z0-9]*)([^>]*)>/gi)){const[,close,tag,attrs]=match;if(close){const at=stack.map(item=>item.tag).lastIndexOf(tag);if(at>=0)stack.splice(at);continue;}const classes=(/class="([^"]*)"/.exec(attrs)?.[1]??'').split(/\s+/);if(classes.includes('sr-only')){meanings++;const clip=stack.map(item=>item.clips).lastIndexOf(true),position=stack.map(item=>item.positioned).lastIndexOf(true);assert.ok(clip>=0&&position>=clip,'an absolute accessible label must be positioned within its scrolling/clipping ancestor');}if(!['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'].includes(tag))stack.push({tag,clips:classes.some(name=>['overflow-hidden','overflow-x-auto','overflow-auto','overflow-x-hidden'].includes(name)),positioned:classes.some(name=>['relative','absolute','sticky','fixed'].includes(name))||/position:(relative|absolute|sticky|fixed)/.test(attrs)});}assert.ok(meanings>0,'exercise actual no-rain meanings, not an empty frame');};
 assert.throws(()=>requireClippedMeaning(observed.html),'the captured bad DOM must fail without deleting its accessible words');
 for(const lang of['en',...languages])for(const compact of[false,true])requireClippedMeaning(renderWeatherWidget({lang,compact}));
});
