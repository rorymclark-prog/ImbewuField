import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Lighter update notes (swarm/w3-report-notes, task 2).
//
// PWAUpdateNotifier and UpdateGuide are mounted on every route via app/layout.tsx. Statically
// importing visibleNotes()/visibleUpdateTour() as runtime values pulled the whole 2,400+ line
// lib/release-notes.ts RELEASE_NOTES array into the shared layout bundle, even though only the
// latest few lines are ever shown. Both now load lib/release-notes.ts through a dynamic import()
// inside the effect/handler that actually needs it, so the full changelog ships as its own chunk.
// A source-text guard, in the same spirit as tests/nav-simple-track.test.ts: this is checking the
// *shape* of the import (static vs dynamic), which a runtime render wouldn't distinguish.

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const PWA_NOTIFIER = read('../components/PWAUpdateNotifier.tsx');
const UPDATE_GUIDE = read('../components/UpdateGuide.tsx');

// A static value import of the form `import { x } from '@/lib/release-notes'` — but not
// `import type { X } from '@/lib/release-notes'`, which is erased at build and fine to keep.
const STATIC_VALUE_IMPORT = /^import\s+\{[^}]*\}\s+from\s+'@\/lib\/release-notes';/m;

test('PWAUpdateNotifier no longer statically imports runtime values from lib/release-notes', () => {
  assert.doesNotMatch(PWA_NOTIFIER, STATIC_VALUE_IMPORT,
    'visibleNotes must not be a static, eagerly-bundled import');
  assert.doesNotMatch(PWA_NOTIFIER, /^import \{ visibleNotes/m);
  // The type-only import is fine — it is erased at build and does not pull in RELEASE_NOTES.
  assert.match(PWA_NOTIFIER, /import type \{ UpdateTourStop \} from '@\/lib\/release-notes';/);
  // The fallback notes are fetched lazily, once an update actually needs them.
  assert.match(PWA_NOTIFIER, /import\('@\/lib\/release-notes'\)/,
    'the fallback notes must be loaded via a dynamic import()');
  assert.match(PWA_NOTIFIER, /visibleNotes\(\)/);
});

test('UpdateGuide no longer statically imports runtime values from lib/release-notes', () => {
  assert.doesNotMatch(UPDATE_GUIDE, STATIC_VALUE_IMPORT,
    'visibleUpdateTour must not be a static, eagerly-bundled import');
  assert.doesNotMatch(UPDATE_GUIDE, /^import \{ visibleUpdateTour/m);
  assert.match(UPDATE_GUIDE, /import\('@\/lib\/release-notes'\)/,
    'the tour stops must be loaded via a dynamic import() when the guide opens');
  assert.match(UPDATE_GUIDE, /visibleUpdateTour\(\)/);
});

test('neither component renders a note/tour list before its lazily-loaded data has resolved', () => {
  // PWAUpdateNotifier: the notes list must stay gated on a nullable value (not a plain array
  // defaulted to []), so a still-loading fallback renders nothing rather than an empty list that
  // then pops in once the chunk arrives.
  assert.match(PWA_NOTIFIER, /const \[fallbackNotes, setFallbackNotes\] = useState<string\[\] \| null>\(null\)/);
  assert.match(PWA_NOTIFIER, /notes && notes\.length > 0 &&/,
    'the notes list must be gated on notes being loaded, not just non-empty');

  // UpdateGuide: guide starts at null and is only set once visibleUpdateTour() resolves, so the
  // component's existing `if (!guide ...) return null;` guard already covers the loading window.
  assert.match(UPDATE_GUIDE, /const \[guide, setGuide\] = useState<UpdateGuideState \| null>\(null\)/);
  assert.match(UPDATE_GUIDE, /if \(!guide \|\| !guide\.stops\.length\) return null;/);
});
