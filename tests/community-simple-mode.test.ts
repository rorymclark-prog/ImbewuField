import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// swarm/w4-community-simple: Community board, messages and profiles — Simple mode. Source-text
// guard style, same as tests/design-simple-mode.test.ts: these screens are not pure functions of
// exported data, so the guard reads the real shipped files and asserts the wiring a farmer would
// actually hit, rather than rendering the component tree.

const BOARD = readFileSync(new URL('../app/community/page.tsx', import.meta.url), 'utf8');
const THREAD = readFileSync(new URL('../app/community/messages/[threadId]/page.tsx', import.meta.url), 'utf8');
const PROFILE = readFileSync(new URL('../app/community/u/[uid]/page.tsx', import.meta.url), 'utf8');
const I18N = readFileSync(new URL('../lib/i18n.tsx', import.meta.url), 'utf8');
const ZU = readFileSync(new URL('../lib/locales/zu.ts', import.meta.url), 'utf8');

test('all three screens read Simple / All tools from lib/app-level.ts', () => {
  for (const [name, source] of [['board', BOARD], ['messages thread', THREAD], ['other farmer profile', PROFILE]] as const) {
    assert.match(source, /from '@\/lib\/app-level'/, `${name} must import useAppLevel`);
    assert.match(source, /const simple = useAppLevel\(\) === 'simple'/, `${name} must compute a \`simple\` flag from useAppLevel()`);
  }
});

test('Board: Simple leads with the posts (defaults to the board tab) and drops Messages from the tab bar', () => {
  assert.match(
    BOARD,
    /const TABS: Tab\[\] = simple \? \['board', 'nearby'\] : \['nearby', 'board', 'messages'\]/,
    'Simple must show only the board and nearby tabs; All tools must keep all three, unchanged',
  );
  assert.match(BOARD, /const \[tab, setTab\] = useState<Tab>\(simple \? 'board' : 'nearby'\)/, 'Simple must open on the board, not nearby');
  assert.match(BOARD, /\{TABS\.map\(\(tb\) => \(/, 'the tab bar must render the mode-aware TABS list, not a hardcoded three-tab array');
  assert.match(
    BOARD,
    /useEffect\(\(\) => \{ if \(simple && tab === 'messages'\) setTab\('board'\); \}, \[simple, tab\]\)/,
    'switching to Simple mid-session while on Messages must land somewhere still reachable, not a panel with no highlighted tab',
  );
});

test('Board: the New post button (Post) is not gated by simple — it is the one clear primary action in both modes', () => {
  assert.match(BOARD, /onClick=\{onToggleNewPost\}[\s\S]{0,300}<Plus size=\{14\} \/> \{tr\('communityBoardNewPost'\)\}/, 'the New post toggle must render unconditionally');
  assert.doesNotMatch(BOARD, /\{!simple &&[\s\S]{0,80}communityBoardNewPost/, 'New post must not be hidden behind All tools');
});

test('Board: the new-post form keeps only the essentials in Simple — description, photo, Post — and defaults Type/Category/Area behind one disclosure', () => {
  assert.match(BOARD, /function NewBoardPostForm\(\{ myAreaText, simple, onPosted, onCancel \}/, 'NewBoardPostForm must accept a simple prop');
  assert.match(BOARD, /const optionsExpanded = !simple \|\| showMoreOptions/, 'Type/Category/Area must expand for All tools or once Simple asks for more options');
  assert.match(BOARD, /\{optionsExpanded && \(\s*<div>\s*<div className="font-sans uppercase tracking-widest"[^>]*>\{tr\('communityBoardKind'\)\}/, 'the Type (have/want/free) picker must be gated by optionsExpanded');
  assert.match(BOARD, /\{optionsExpanded && \(\s*<div>\s*<div className="font-sans uppercase tracking-widest"[^>]*>\{tr\('communityBoardCategory'\)\}/, 'the Category picker must be gated by optionsExpanded');
  assert.match(BOARD, /\{optionsExpanded && \(\s*<div>\s*<div className="font-sans uppercase tracking-widest"[^>]*>\{tr\('communityAreaLabel'\)\}/, 'the Area field must be gated by optionsExpanded');
  assert.match(BOARD, /\{!optionsExpanded && \(\s*<button[\s\S]{0,120}onClick=\{\(\) => setShowMoreOptions\(true\)\}/, 'a "More options" opener must exist for Simple');
  // Description (what) and the photo picker stay outside the optionsExpanded gate — always visible.
  assert.doesNotMatch(BOARD, /\{optionsExpanded && \([\s\S]{0,40}tr\('communityBoardDescription'\)/, 'the description field must not be gated — it is one of the kept essentials');
  assert.match(BOARD, /copyCommunity\('Add photo \(optional\)', lang\)/, 'the photo picker must still exist unconditionally');
  assert.match(BOARD, /onClick=\{handlePost\} disabled=\{posting \|\| !description\.trim\(\)\}/, 'the Post button (send) must remain reachable and ungated by simple in both modes');
});

test('Messages thread: Simple keeps the conversation and the send box, and tucks report/block behind a small More disclosure that never removes it', () => {
  assert.match(
    THREAD,
    /\{simple \? \(\s*<button\s*\n\s*onClick=\{\(\) => setMoreOpen\(\(s\) => !s\)\}/,
    'Simple must show a More control in the header instead of the direct Flag/report button',
  );
  assert.match(
    THREAD,
    /\) : \(\s*<button\s*\n\s*onClick=\{\(\) => setReportOpen\(\(s\) => !s\)\}\s*\n\s*aria-label=\{t\('communityReportButton'\)\}/,
    'All tools must keep the direct Flag/report button exactly as before',
  );
  assert.match(
    THREAD,
    /\{simple && moreOpen && \(\s*<div className="flex justify-end"[\s\S]{0,400}<Flag size=\{13\} \/> \{t\('communityReportButton'\)\}/,
    'the More disclosure must reveal a real Report control, not just a label',
  );
  // The send box itself (input + Send button) must not be gated by simple at all.
  assert.doesNotMatch(THREAD, /\{!simple[\s\S]{0,60}placeholder=\{t\('communityMessageInputPlaceholder'\)\}/, 'the message input must not be hidden in Simple');
  assert.match(THREAD, /onClick=\{handleSend\}[\s\S]{0,40}aria-label=\{sending/, 'the Send button must remain reachable and ungated by simple in both modes');
});

test('Messages thread: per-message timestamps (metadata not needed to read and reply) are hidden in Simple', () => {
  assert.match(
    THREAD,
    /\{!simple && \(\s*<div className="font-sans" style=\{\{ fontSize: 10\.5,[\s\S]{0,200}\{timeAgo\(m\.created_at, lang\)\}/,
    'per-message timeAgo must be gated by !simple',
  );
});

test('Other farmer profile: Simple shows name, place and crops plainly, with a clear Send action, and tucks bio/photos/report behind one More disclosure', () => {
  assert.match(PROFILE, /\{simple && \(\s*<button\s*\n\s*type="button"\s*\n\s*onClick=\{\(\) => setMoreOpen\(\(s\) => !s\)\}/, 'a More toggle must exist, shown only in Simple');
  assert.match(PROFILE, /\{\(!simple \|\| moreOpen\) && profile\.bio && \(/, 'bio must be gated behind the More disclosure in Simple');
  assert.match(PROFILE, /\{\(!simple \|\| moreOpen\) && profile\.photos\?\.length > 0 && \(/, 'photos must be gated behind the More disclosure in Simple');
  assert.match(PROFILE, /\{\(!simple \|\| moreOpen\) && \(\s*<button\s*\n\s*onClick=\{\(\) => setReportOpen\(\(s\) => !s\)\}/, 'the Report button must be gated behind the More disclosure in Simple, never removed');
  // Crops and the Send-a-message action must not be gated by simple/moreOpen at all.
  assert.doesNotMatch(PROFILE, /\{\(!simple \|\| moreOpen\)[\s\S]{0,40}profile\.crops/, 'crops must always be visible, not tucked behind More');
  assert.match(PROFILE, /onClick=\{handleMessage\}[\s\S]{0,40}disabled=\{messaging\}/, 'the Send a message button must remain reachable and ungated by simple in both modes');
});

test('the new shared More/Less labels exist in English and have an isiZulu draft', () => {
  for (const key of ['communityMoreLabel', 'communityLessLabel']) {
    assert.match(I18N, new RegExp(`^  ${key}: '[^']+',`, 'm'), `${key} must exist in the English dictionary`);
    assert.match(ZU, new RegExp(`^  ${key}: "[^"]+",`, 'm'), `${key} must have an isiZulu draft`);
  }
});
