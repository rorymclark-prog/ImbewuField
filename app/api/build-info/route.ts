import { execSync } from 'child_process';
import { NextResponse } from 'next/server';
import { visibleNotes } from '@/lib/release-notes';

export const dynamic = 'force-dynamic';

function safeGit(cmd: string): string | null {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch {
    return null;
  }
}

function shortSha(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 7);
}

export async function GET() {
  const branch =
    process.env.VERCEL_GIT_COMMIT_REF ||
    process.env.GITHUB_REF_NAME ||
    safeGit('git branch --show-current') ||
    null;
  const sha =
    shortSha(process.env.VERCEL_GIT_COMMIT_SHA) ||
    shortSha(process.env.GITHUB_SHA) ||
    shortSha(safeGit('git rev-parse HEAD')) ||
    null;
  const repoRoot = safeGit('git rev-parse --show-toplevel');

  return NextResponse.json(
    {
      branch,
      sha,
      repoRoot,
      // WHAT THE NEW BUILD CHANGED, from the new build. The banner used to render
      // visibleNotes() out of the bundle already running in the tab — so it announced a sha it
      // had just learned from here, and then described the release the farmer was already on.
      // Structurally one build stale, every time ("still show stale update info"). This route
      // runs on the deployment being announced, so its import of lib/release-notes is the new
      // one; the client prefers these and only falls back to its own copy if they are missing.
      notes: visibleNotes(),
      source: branch && sha ? (process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA ? 'env' : 'git') : 'fallback',
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    },
  );
}
