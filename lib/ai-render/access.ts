// Experimental map rendering is an explicit account grant, never a role, profile preference,
// percentage rollout or browser flag. Only the Admin SDK can issue this Firebase custom claim.
// Both Next routes (verified ID token) and the worker (current Auth record) use this decision.
export const AI_RENDER_TESTER_CLAIM = 'aiRenderTester';

export type AiRenderAccessReason = 'approved' | 'disabled' | 'not-approved' | 'sign-in-required' | 'unavailable';
export interface AiRenderAccess {
  allowed: boolean;
  reason: AiRenderAccessReason;
  message: string;
}

const MESSAGES: Record<AiRenderAccessReason, string> = {
  approved: 'Experimental AI map rendering is available for your account.',
  disabled: 'AI map rendering is currently turned off. Exact maps are still available.',
  'not-approved': 'AI map rendering is experimental and available only to approved testers. Exact maps are still available.',
  'sign-in-required': 'Sign in with an approved tester account to use experimental AI map rendering. Exact maps are still available.',
  unavailable: 'AI map access could not be checked. Try again later; exact maps are still available.',
};

export function aiRenderAccessState(reason: AiRenderAccessReason): AiRenderAccess {
  return { allowed: reason === 'approved', reason, message: MESSAGES[reason] };
}

export function decideAiRenderAccess(uid: unknown, verifiedClaims: unknown): AiRenderAccess {
  if (typeof uid !== 'string' || !uid.trim() || uid.length > 128) {
    return aiRenderAccessState('sign-in-required');
  }
  const claims = verifiedClaims && typeof verifiedClaims === 'object' && !Array.isArray(verifiedClaims)
    ? verifiedClaims as Record<string, unknown>
    : null;
  return aiRenderAccessState(claims?.[AI_RENDER_TESTER_CLAIM] === true ? 'approved' : 'not-approved');
}

// The worker reads the current Auth record rather than trusting a claim supplied in a job doc.
// A failed lookup must stop before quota or provider use, not fall back to a cached approval.
export async function readAiRenderTesterAccess(
  uid: unknown,
  loadVerifiedClaims: (uid: string) => Promise<unknown>,
): Promise<AiRenderAccess> {
  const identity = decideAiRenderAccess(uid, null);
  if (identity.reason === 'sign-in-required') return identity;
  try {
    return decideAiRenderAccess(uid, await loadVerifiedClaims(uid as string));
  } catch {
    return aiRenderAccessState('unavailable');
  }
}

export function aiRenderAccessHttpStatus(access: AiRenderAccess): number {
  if (access.allowed) return 200;
  if (access.reason === 'sign-in-required') return 401;
  if (access.reason === 'disabled' || access.reason === 'unavailable') return 503;
  return 403;
}
