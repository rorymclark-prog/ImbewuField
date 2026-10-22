import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

interface DictionaryPacket {
  entries: Array<{ key: string; [field: string]: unknown }>;
  supplementalEntries?: Array<{ key: string; [field: string]: unknown }>;
  notices?: Record<string, Record<string, string>>;
  beforeValues?: Record<string, Record<string, string | null>>;
}

/** Historical object checks need the same bounded UI exception as source-byte checks. */
export function beforeUiDictionary(actual: unknown, locale: string, packet: DictionaryPacket): unknown {
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return actual;
  const original = actual;
  actual = beforeControlIconDictionary(beforeConsentDictionary(beforeOfflineDeviceDictionary(beforeUpdateNoticeDictionary(beforeAccountDictionary(beforeCommunityProfileDictionary(beforeCommunityMemberDictionary(beforeCommunityThreadDictionary(beforePhotoViewerDictionary(actual,locale),locale),locale),locale),locale),locale),locale),locale),locale);
  const expected: Record<string, string> = {};
  for (const entry of [...packet.entries, ...(packet.supplementalEntries ?? [])]) {
    if (typeof entry[locale] === 'string') expected[entry.key] = entry[locale];
  }
  Object.assign(expected, packet.notices?.[locale] ?? {});
  assert.ok(Object.keys(expected).length, `${locale}: a declared dictionary batch cannot be empty`);
  const beforeValues = packet.beforeValues?.[locale];
  assert.ok(beforeValues, `${locale}: exact prior UI values must be recorded`);
  assert.deepEqual(Object.keys(beforeValues).sort(), Object.keys(expected).sort(), `${locale}: record only and every declared change`);
  const dict = actual as Record<string, unknown>;
  // Older snapshots and altered callers must remain visible to the original full-object guard.
  // Project only the complete exact draft layer, never a partial or corrupted approximation.
  if (!Object.entries(expected).every(([key, value]) => Object.hasOwn(dict, key) && dict[key] === value)) return original;
  const before = { ...dict };
  for (const key of Object.keys(expected)) {
    if (beforeValues[key] === null) delete before[key];
    else before[key] = beforeValues[key];
  }
  return before;
}

// Fixed app controls may change presentation without rewriting a calibrated Study dictionary.
// Reverse only the complete exact declared layer; partial/altered layers remain visible to hashes.
interface ControlIconPacket extends DictionaryPacket {
  beforeLines: Record<string, Record<string, Array<{file:string;text:string}>>>;
}
let controlIcons: ControlIconPacket | undefined;
function controlIconPacket(): ControlIconPacket {
  return controlIcons ??= JSON.parse(readFileSync(new URL('../docs/translation/four-language-completion/control-icon-drafts.json',import.meta.url),'utf8'));
}
const iconOpening='\n  // Native design controls: unreviewed drafts; control-icon-drafts.json.\n';
const iconClosing='  // End native design controls.\n';
function beforeExactUiDictionary(actual:unknown,locale:string,packet:ControlIconPacket):unknown {
  if(!actual||typeof actual!=='object'||Array.isArray(actual))return actual;
  const entries=packet.entries.filter(row=>typeof row[locale]==='string');
  if(!entries.length)return actual;
  const dict=actual as Record<string,unknown>;
  if(!entries.every(row=>Object.hasOwn(dict,row.key)&&dict[row.key]===row[locale]))return actual;
  const before={...dict};
  for(const row of entries){const value=packet.beforeValues![locale][row.key];if(value===null)delete before[row.key];else before[row.key]=value;}
  return before;
}
function beforeExactUiSource(source:string,locale:string,packet:ControlIconPacket,opening:string,closing:string):string {
  const entries=packet.entries.filter(row=>typeof row[locale]==='string');
  if(!entries.length)return source;
  const lines=packet.beforeLines[locale];
  const added=entries.filter(row=>!lines[row.key].length);
  const block=opening+added.map(row=>`  ${row.key}: ${JSON.stringify(row[locale])},\n`).join('')+closing;
  const inline=entries.filter(row=>lines[row.key].length);
  if(added.length&&!source.includes(block))return source;
  if(!inline.every(row=>source.split(`  ${row.key}: ${JSON.stringify(row[locale])},\n`).length===2))return source;
  let before=added.length?source.replace(block,'\n'):source;
  for(const row of inline){assert.equal(lines[row.key].length,1,'each replaced control has exactly one recorded source line');before=before.replace(`  ${row.key}: ${JSON.stringify(row[locale])},\n`,lines[row.key][0].text);}
  return before;
}
export function beforeControlIconDictionary(actual:unknown,locale:string):unknown {
  return beforeExactUiDictionary(actual,locale,controlIconPacket());
}
export function beforeControlIconTranslations(source:string,locale:string):string {
  return beforeExactUiSource(source,locale,controlIconPacket(),iconOpening,iconClosing);
}

let consent: ControlIconPacket | undefined;
function consentPacket():ControlIconPacket {
  return consent ??= JSON.parse(readFileSync(new URL('../docs/translation/four-language-completion/consent-drafts.json',import.meta.url),'utf8'));
}
export function beforeConsentDictionary(actual:unknown,locale:string):unknown {
  return beforeExactUiDictionary(actual,locale,consentPacket());
}
export function beforeConsentTranslations(source:string,locale:string):string {
  return beforeExactUiSource(source,locale,consentPacket(),'\n  // Consent controls: unreviewed drafts; consent-drafts.json.\n','  // End consent controls.\n');
}

let offlineDevice: ControlIconPacket | undefined;
function offlineDevicePacket():ControlIconPacket {
  return offlineDevice ??= JSON.parse(readFileSync(new URL('../docs/translation/four-language-completion/offline-device-drafts.json',import.meta.url),'utf8'));
}
export function beforeOfflineDeviceDictionary(actual:unknown,locale:string):unknown {
  return beforeExactUiDictionary(actual,locale,offlineDevicePacket());
}
export function beforeOfflineDeviceTranslations(source:string,locale:string):string {
  return beforeExactUiSource(source,locale,offlineDevicePacket(),'\n  // Offline device controls: unreviewed drafts; offline-device-drafts.json.\n','  // End offline device controls.\n');
}

let updateNotices: ControlIconPacket | undefined;
function updateNoticePacket():ControlIconPacket {
  return updateNotices ??= JSON.parse(readFileSync(new URL('../docs/translation/four-language-completion/update-notice-drafts.json',import.meta.url),'utf8'));
}
export function beforeUpdateNoticeDictionary(actual:unknown,locale:string):unknown {
  return beforeExactUiDictionary(actual,locale,updateNoticePacket());
}
export function beforeUpdateNoticeTranslations(source:string,locale:string):string {
  return beforeExactUiSource(source,locale,updateNoticePacket(),'\n  // Update notices: unreviewed drafts; update-notice-drafts.json.\n','  // End update notices.\n');
}

let accountControls: ControlIconPacket | undefined;
function accountPacket():ControlIconPacket {
  return accountControls ??= JSON.parse(readFileSync(new URL('../docs/translation/four-language-completion/account-drafts.json',import.meta.url),'utf8'));
}
export function beforeAccountDictionary(actual:unknown,locale:string):unknown {
  return beforeExactUiDictionary(actual,locale,accountPacket());
}
export function beforeAccountTranslations(source:string,locale:string):string {
  return beforeExactUiSource(source,locale,accountPacket(),'\n  // Account controls: unreviewed drafts; account-drafts.json.\n','  // End account controls.\n');
}

let communityProfileControls: ControlIconPacket | undefined;
function communityProfilePacket():ControlIconPacket {
  return communityProfileControls ??= JSON.parse(readFileSync(new URL('../docs/translation/four-language-completion/community-profile-drafts.json',import.meta.url),'utf8'));
}
export function beforeCommunityProfileDictionary(actual:unknown,locale:string):unknown {
  return beforeExactUiDictionary(actual,locale,communityProfilePacket());
}
export function beforeCommunityProfileTranslations(source:string,locale:string):string {
  return beforeExactUiSource(source,locale,communityProfilePacket(),'\n  // Community profile controls: unreviewed drafts; community-profile-drafts.json.\n','  // End community profile controls.\n');
}

let communityMemberControls: ControlIconPacket | undefined;
function communityMemberPacket():ControlIconPacket {
  return communityMemberControls ??= JSON.parse(readFileSync(new URL('../docs/translation/four-language-completion/community-member-drafts.json',import.meta.url),'utf8'));
}
export function beforeCommunityMemberDictionary(actual:unknown,locale:string):unknown {
  return beforeExactUiDictionary(actual,locale,communityMemberPacket());
}
export function beforeCommunityMemberTranslations(source:string,locale:string):string {
  return beforeExactUiSource(source,locale,communityMemberPacket(),'\n  // Community member controls: unreviewed drafts; community-member-drafts.json.\n','  // End community member controls.\n');
}

let communityThreadControls: ControlIconPacket | undefined;
function communityThreadPacket():ControlIconPacket {
  return communityThreadControls ??= JSON.parse(readFileSync(new URL('../docs/translation/four-language-completion/community-thread-drafts.json',import.meta.url),'utf8'));
}
export function beforeCommunityThreadDictionary(actual:unknown,locale:string):unknown {
  return beforeExactUiDictionary(actual,locale,communityThreadPacket());
}
export function beforeCommunityThreadTranslations(source:string,locale:string):string {
  return beforeExactUiSource(source,locale,communityThreadPacket(),'\n  // Community conversations and hub: unreviewed drafts; community-thread-drafts.json.\n','  // End community conversations and hub.\n');
}

let photoViewer:ControlIconPacket|undefined;
function photoViewerPacket():ControlIconPacket {
  return photoViewer??=JSON.parse(readFileSync(new URL('../docs/translation/four-language-completion/photo-viewer-drafts.json',import.meta.url),'utf8'));
}
export function beforePhotoViewerDictionary(actual:unknown,locale:string):unknown {
  return beforeExactUiDictionary(actual,locale,photoViewerPacket());
}
export function beforePhotoViewerTranslations(source:string,locale:string):string {
  return beforeExactUiSource(source,locale,photoViewerPacket(),'\n  // Photo viewer: unreviewed drafts; photo-viewer-drafts.json.\n','  // End photo viewer.\n');
}
