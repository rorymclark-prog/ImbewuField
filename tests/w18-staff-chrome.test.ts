import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(p, 'utf8');

test('w18-27: mentor tab bar points at Assessments, and tabsForRole filters through the role gate', () => {
  const src = read('components/TabBar.tsx');
  const mentor = src.match(/mentor: \[([\s\S]*?)\],\n  ngo/)![1];
  assert.doesNotMatch(mentor, /\/network/);
  assert.match(mentor, /href: '\/assessments'[^}]*ClipboardList/);
  assert.match(src, /canSeeNavLink\(navigationRole as UserRole \| null, href\)/);
});

test('w18-27: /network title is neutral', () => {
  assert.doesNotMatch(read('app/network/page.tsx'), /funder portfolio'/);
});
