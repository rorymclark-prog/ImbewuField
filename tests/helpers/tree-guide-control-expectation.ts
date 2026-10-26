import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const packet=JSON.parse(readFileSync(new URL('../../docs/translation/four-language-completion/tree-guide-control-drafts.json',import.meta.url),'utf8'))as{sourceEdits:Array<{file:string;before:string;after:string;count:number}>};
/** Earlier source-byte guards still compare the whole file. Only these captured
 * display edits are reversed; a changed callback, date calculation or model remains visible. */
export function restoreTreeGuideControlSource(file:string,source:string):string {
 for(const edit of packet.sourceEdits.filter(edit=>edit.file===file).toReversed()){
  assert.equal(source.split(edit.after).length-1,edit.count,'declared UI replacement must still occupy exactly its captured positions');
  source=source.replaceAll(edit.after,edit.before);
 }
 return source;
}
