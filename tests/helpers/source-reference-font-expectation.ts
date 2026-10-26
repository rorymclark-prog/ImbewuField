import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const fixture=JSON.parse(readFileSync(new URL('../fixtures/source-reference-translation/native-font-before.json',import.meta.url),'utf8'))as{source:string;sha256:string;edit:{before:string;after:string}};
/** Keep the original whole-font guard. Only the observed marker-filter repair is declared. */
export function originalSourceReferenceFont(source:string):string {
 assert.equal(source.split(fixture.edit.after).length-1,1,'the marker repair must remain unique');
 return source.replace(fixture.edit.after,fixture.edit.before);
}
export const sourceReferenceFontBefore=fixture;
