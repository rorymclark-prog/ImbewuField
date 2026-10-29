// Experimental map rendering is an explicit account grant, never a role, profile preference,
// percentage rollout or browser flag. Only the Admin SDK can issue this Firebase custom claim.
// Both Next routes (verified ID token) and the worker (current Auth record) use this decision.
export const AI_RENDER_TESTER_CLAIM = 'aiRenderTester';

export type AiRenderAccessReason = 'approved' | 'disabled' | 'not-approved' | 'sign-in-required' | 'unavailable' | 'personal-off' | 'organization-disabled';
export interface AiRenderAccess {
  allowed: boolean;
  reason: AiRenderAccessReason;
  message: string;
}

const MESSAGES: Record<AiRenderAccessReason, string> = {
  'personal-off': 'AI glossy maps are off in your Settings. Turn them on when you want to generate a paid map.',
  'organization-disabled': 'AI glossy maps are not enabled for your organisation. Your organisation cannot override the platform switch. Exact maps remain available.',
  approved: 'Experimental AI map rendering is available for your account.',
  disabled: 'AI map rendering is currently turned off. Exact maps are still available.',
  'not-approved': 'AI glossy maps are not enabled for your account. Ask your organisation or the platform owner for access. Exact maps remain available.',
  'sign-in-required': 'Sign in with an approved tester account to use experimental AI map rendering. Exact maps are still available.',
  unavailable: 'AI map access could not be checked. Try again later; exact maps are still available.',
};

export function aiRenderAccessState(reason: AiRenderAccessReason): AiRenderAccess {
  return { allowed: reason === 'approved', reason, message: MESSAGES[reason] };
}

export const AI_MAP_ROLES = ['farmer', 'mentor', 'student', 'ngo', 'funder'] as const;
export type AiMapRole = typeof AI_MAP_ROLES[number];
export interface AiMapPolicyContext {
  uid: string | null;
  master: boolean;
  tester: boolean;
  enabled: boolean;
  personalEnabled: boolean;
  personalGranted: boolean;
  role: string | null;
  orgId: string | null;
  orgEnabled: boolean;
  orgRoles: readonly string[];
  memberGrant: boolean | null;
}

// A tenant suspension beats both role and individual grants. Personal consent is independent:
// neither an organisation nor an old tester claim may silently turn a person's spending on.
export function decideManagedAiRenderAccess(c: AiMapPolicyContext): AiRenderAccess {
  if (!c.uid) return aiRenderAccessState('sign-in-required');
  if (!c.enabled) return aiRenderAccessState('disabled');
  if (!c.master) {
    if (c.orgId) {
      if (!c.orgEnabled) return aiRenderAccessState('organization-disabled');
      if (c.memberGrant === false || !(c.memberGrant === true || (c.role && c.orgRoles.includes(c.role)))) {
        return aiRenderAccessState('not-approved');
      }
    } else if (!c.personalGranted && !c.tester) return aiRenderAccessState('not-approved');
  }
  if (!c.personalEnabled) return aiRenderAccessState('personal-off');
  return aiRenderAccessState('approved');
}

export function canManageAiMapOrganization(master: boolean, actor: { role: string | null; orgId: string | null; people: boolean }, orgId: string): boolean {
  return master || (actor.role === 'ngo' && actor.orgId === orgId && actor.people);
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
