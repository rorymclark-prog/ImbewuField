import { aiRenderAccessState, type AiRenderAccess } from './access';

// The Firebase service owns its database credentials. Vercel forwards the caller's verified
// identity, never an Admin key or an organization id supplied as authorization.
export async function callAiMapControls(req: Request, mode: 'access' | 'settings', body?: unknown): Promise<Response> {
  const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!project || !/^[a-z0-9-]+$/.test(project)) throw new Error('AI map controls are unavailable.');
  const url = new URL(`https://europe-west1-${project}.cloudfunctions.net/aiMapAccess`);
  url.searchParams.set('mode', mode);
  const org = new URL(req.url).searchParams.get('org');
  if (org) url.searchParams.set('org', org);
  return fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: req.headers.get('authorization') ?? '', 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store', signal: AbortSignal.timeout(15_000),
  });
}

export async function resolveAiRenderAccess(req: Request, uid: string | null): Promise<AiRenderAccess> {
  if (!uid) return aiRenderAccessState('sign-in-required');
  try {
    const response = await callAiMapControls(req, 'access');
    if (!response.ok) return aiRenderAccessState('unavailable');
    const access = await response.json() as AiRenderAccess;
    if (access.allowed === true && access.reason === 'approved') return aiRenderAccessState('approved');
    if (access.allowed === false && ['disabled', 'not-approved', 'personal-off', 'organization-disabled', 'sign-in-required'].includes(access.reason)) {
      return aiRenderAccessState(access.reason);
    }
  } catch { /* An unavailable control service must never open the spending path. */ }
  return aiRenderAccessState('unavailable');
}
