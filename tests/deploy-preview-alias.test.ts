import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function actualPreviewSlug(branch: string): string {
  const workflow = readFileSync(new URL('../.github/workflows/deploy-preview.yml', import.meta.url), 'utf8');
  const assignment = workflow.match(/slug=\$\([\s\S]*?\)(?=\n\s+vercel alias set)/)?.[0];
  assert.ok(assignment, 'run the workflow slug calculation, not a separate test implementation');
  return execFileSync('bash', ['-c', `${assignment}\nprintf '%s' "$slug"`], {
    env: { ...process.env, GITHUB_REF_NAME: branch }, encoding: 'utf8',
  });
}

test('a long Study branch whose fortieth character is a hyphen gets a valid preview hostname', () => {
  // PR966 built successfully but alias assignment failed after truncation recreated a trailing
  // hyphen. Checking the actual shell block catches that production failure at either trim.
  const slug = actualPreviewSlug('codex/regional-intro-full-ordinary-completion-20261006');
  assert.ok(slug.length > 0 && slug.length <= 40);
  assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
});

test('short existing preview branch addresses stay stable', () => {
  assert.equal(actualPreviewSlug('codex/reference-blueprint-quality'), 'reference-blueprint-quality');
  assert.equal(actualPreviewSlug('claude/soil_water'), 'soil-water');
});
