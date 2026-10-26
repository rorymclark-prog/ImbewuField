import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { actualCommunityConversation } from './community-conversations-renderer.ts';
import { actualCommunityMember } from './community-member-renderer.ts';
import { communityNodeText } from './community-profile-renderer.ts';
import { controlT, type ControlLanguage } from './control-icon-renderers.ts';
import { communityTimeAgo } from '../lib/community-time.ts';

// Simple is a visibility/action contract, not a particular div, English literal or helper name.
// Render the shipped components with isolated services so native labels and associated labels can evolve.
const langs:ControlLanguage[]=['en','zu','st','ts','ve'];
const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('all three screens read Simple / All tools from lib/app-level.ts',()=>{
 for(const file of['app/community/page.tsx','app/community/messages/[threadId]/page.tsx','app/community/u/[uid]/page.tsx']){const source=read(file);assert.match(source,/from '@\/lib\/app-level'/,file);assert.match(source,/const simple = useAppLevel\(\) === 'simple'/,file);}
});
test('Board: Simple leads with the posts (defaults to the board tab) and drops Messages from the tab bar',async()=>{
 for(const lang of langs){const h=await actualCommunityConversation(lang,'hub',{simple:true});try{const tabs=()=>h.renderer.root.findAllByProps({role:'tab'});assert.deepEqual(tabs().map(n=>n.props.id),['community-tab-board','community-tab-nearby']);assert.equal(tabs()[0].props['aria-selected'],true);await h.level(false);assert.deepEqual(tabs().map(n=>n.props.id),['community-tab-nearby','community-tab-board','community-tab-messages']);await h.tab('messages');await h.level(true);assert.equal(h.renderer.root.findByProps({id:'community-tab-board'}).props['aria-selected'],true);}finally{await h.dispose();}}
});
test('Board: the New post button (Post) is not gated by simple — it is the one clear primary action in both modes',async()=>{
 for(const lang of langs)for(const simple of[false,true]){const h=await actualCommunityConversation(lang,'hub',{simple}),t=controlT(lang);try{await h.tab('board');await h.button(t('communityBoardNewPost'));assert.equal(h.renderer.root.findAllByType('textarea').length,1);assert.ok(h.renderer.root.findAllByType('button').some(n=>communityNodeText(n).trim()===t('communityBoardPost')));}finally{await h.dispose();}}
});
test('Board: the new-post form keeps only the essentials in Simple — description, photo, Post — and defaults Type/Category/Area behind one disclosure',async()=>{
 for(const lang of langs){const h=await actualCommunityConversation(lang,'hub',{simple:true}),t=controlT(lang);try{await h.button(t('communityBoardNewPost'));assert.equal(h.renderer.root.findAllByProps({id:'community-board-description'}).length,1);assert.equal(h.renderer.root.findAllByProps({id:'community-board-area'}).length,0);assert.equal(h.renderer.root.findAllByType('select').length,0);assert.equal(h.renderer.root.findAllByType('button').filter(n=>n.props['aria-pressed']!==undefined).length,0);assert.ok(h.renderer.root.findAllByType('button').some(n=>communityNodeText(n).trim()===t('communityBoardAddPhoto')));await h.button('+ '+t('communityBoardMoreOptions'));assert.equal(h.renderer.root.findByProps({id:'community-board-area'}).props.value,'QA Own district');assert.equal(h.renderer.root.findByType('select').props.value,'seed');assert.equal(h.renderer.root.findAllByType('button').filter(n=>n.props['aria-pressed']!==undefined).length,3);await h.change('community-board-description','QA simple post');await h.button(t('communityBoardPost'));assert.deepEqual(h.calls.posts,[{category:'seed',kind:'have',description:'QA simple post',photo_url:null,area_text:'QA Own district'}]);}finally{await h.dispose();}}
});
test('Messages thread: Simple keeps the conversation and the send box, and tucks report/block behind a small More disclosure that never removes it',async()=>{
 for(const lang of langs){const h=await actualCommunityConversation(lang,'thread',{simple:true}),t=controlT(lang);try{assert.ok(h.text().includes('QA received message'));assert.equal(h.renderer.root.findAllByProps({'aria-label':t('communityReportButton')}).length,0);assert.equal(h.renderer.root.findAllByProps({type:'text'}).length,1);await h.button(t('communityMoreLabel'));await h.button(t('communityReportButton'));assert.equal(h.renderer.root.findAllByType('textarea').length,1);await h.body('QA simple reply');await h.button(t('communitySend'));assert.deepEqual(h.calls.sends,[{id:'qa-thread',text:'QA simple reply'}]);await h.level(false);assert.ok(h.renderer.root.findAllByProps({'aria-label':t('communityReportButton')}).some(n=>typeof n.props.onClick==='function'));}finally{await h.dispose();}}
});
test('Messages thread: per-message timestamps (metadata not needed to read and reply) are hidden in Simple',async()=>{
 for(const lang of langs){const h=await actualCommunityConversation(lang,'thread',{simple:true}),t=controlT(lang);try{const time=communityTimeAgo(h.messages[0].created_at,lang,t,true,h.now);assert.ok(!h.text().includes(time));assert.ok(h.text().includes(h.messages[0].body));await h.level(false);assert.ok(h.text().includes(time));assert.equal(h.renderer.root.findAllByProps({type:'text'}).length,1);}finally{await h.dispose();}}
});
test('Other farmer profile: Simple shows name, place and crops plainly, with a clear Send action, and tucks bio/photos/report behind one More disclosure',async()=>{
 for(const lang of langs){const h=await actualCommunityMember(lang,{simple:true}),t=controlT(lang);try{assert.ok(h.text().includes(h.profile.display_name));assert.ok(h.text().includes(h.profile.area_text));assert.ok(h.text().includes(h.profile.crops[0]));assert.ok(h.renderer.root.findAllByType('button').some(n=>communityNodeText(n).trim()===t('communityMessageButton')));assert.ok(!h.text().includes(h.profile.bio));assert.equal(h.renderer.root.findAllByType('img').length,1);assert.ok(!h.renderer.root.findAllByType('button').some(n=>communityNodeText(n).trim()===t('communityReportButton')));await h.button(t('communityMoreLabel'));assert.ok(h.text().includes(h.profile.bio));assert.equal(h.renderer.root.findAllByType('img').length,h.profile.photos.length+1);await h.button(t('communityReportButton'));assert.equal(h.renderer.root.findAllByType('textarea').length,1);await h.button(t('communityLessLabel'));assert.ok(!h.text().includes(h.profile.bio));assert.ok(h.text().includes(h.profile.crops[0]));}finally{await h.dispose();}}
});
test('the new shared More/Less labels exist in English and have an isiZulu draft',()=>{
 for(const key of['communityMoreLabel','communityLessLabel']){assert.match(read('lib/i18n.tsx'),new RegExp(`^  ${key}: '[^']+',`,'m'));assert.match(read('lib/locales/zu.ts'),new RegExp(`^  ${key}: "[^"]+",`,'m'));assert.notEqual(controlT('zu')(key),controlT('en')(key));}
});
