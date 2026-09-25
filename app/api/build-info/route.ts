import { execSync } from 'child_process';
import { NextRequest, NextResponse } from 'next/server';
import { visibleNotes, visibleUpdateTour } from '@/lib/release-notes';
import { RateLimiter, clientIp } from '@/lib/api-rate-limit';

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

// On Vercel, VERCEL_GIT_COMMIT_REF/SHA are always set, so this fallback never runs in production
// — but where it does run (local dev, self-hosting), it forked two `git` subprocesses on EVERY
// request. Neither answer can change for the life of this process (the running code is whatever
// commit started it), so compute each once and reuse it, the same way the env-var path already
// only ever reads process.env.
let cachedGitBranch: string | null | undefined;
let cachedGitSha: string | null | undefined;

function fallbackGitBranch(): string | null {
  if (cachedGitBranch === undefined) cachedGitBranch = safeGit('git branch --show-current');
  return cachedGitBranch;
}

function fallbackGitSha(): string | null {
  if (cachedGitSha === undefined) cachedGitSha = safeGit('git rev-parse HEAD');
  return cachedGitSha;
}

// This route is unauthenticated by design (the update banner and the admin build-source tooltip
// both need it signed out), forks a subprocess on the fallback path above, and returns on every
// page load — components/PWAUpdateNotifier.tsx alone polls it once a minute per open tab, and
// several farmers can share one address. The budget is generous so that never bites a real
// visitor; it exists to stop a script from hammering this route, not to police normal use.
const limiter = new RateLimiter(500);
const BUDGET = { limit: 120, windowMs: 5 * 60 * 1000 };

export async function GET(req: NextRequest) {
  const decision = limiter.check(clientIp(req), BUDGET);
  if (!decision.allowed) {
    return NextResponse.json(
      { error: 'Too many requests.' },
      { status: 429, headers: { 'Retry-After': String(decision.retryAfterSeconds) } },
    );
  }

  const branch =
    process.env.VERCEL_GIT_COMMIT_REF ||
    process.env.GITHUB_REF_NAME ||
    fallbackGitBranch() ||
    null;
  const sha =
    shortSha(process.env.VERCEL_GIT_COMMIT_SHA) ||
    shortSha(process.env.GITHUB_SHA) ||
    shortSha(fallbackGitSha()) ||
    null;

  return NextResponse.json(
    {
      branch,
      sha,
      // WHAT THE NEW BUILD CHANGED, from the new build. The banner used to render
      // visibleNotes() out of the bundle already running in the tab — so it announced a sha it
      // had just learned from here, and then described the release the farmer was already on.
      // Structurally one build stale, every time ("still show stale update info"). This route
      // runs on the deployment being announced, so its import of lib/release-notes is the new
      // one; the client prefers these and only falls back to its own copy if they are missing.
      notes: visibleNotes(),
      tour: visibleUpdateTour(),
      source: branch && sha ? (process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA ? 'env' : 'git') : 'fallback',
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    },
  );
}
