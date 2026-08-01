import { getApps, getApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export const MAX_API_BODY_BYTES = 5 * 1024 * 1024;

export type VerifyIdToken = (idToken: string) => Promise<{ uid: string }>;

export interface ApiAuthResult {
  uid: string | null;
  response?: Response;
}

function hardAuthRequired(): boolean {
  return process.env.REQUIRE_API_AUTH === '1' || process.env.REQUIRE_API_AUTH === 'true';
}

function logUnauthenticated(routeName: string, reason: string): void {
  console.warn(`[api-auth] ${routeName}: unauthenticated request (${reason})`);
}

async function verifyWithFirebaseAdmin(idToken: string): Promise<{ uid: string }> {
  const app = getApps().length > 0 ? getApp() : initializeApp();
  return getAuth(app).verifyIdToken(idToken);
}

function unauthorised(routeName: string, reason: string): ApiAuthResult {
  logUnauthenticated(routeName, reason);
  if (!hardAuthRequired()) return { uid: null };
  return {
    uid: null,
    response: new Response(JSON.stringify({ error: 'Authentication required.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }),
  };
}

/**
 * Authenticate a paid API request. Authentication is deliberately log-only
 * until REQUIRE_API_AUTH=1 so the owner can smoke-test the cutover safely.
 * The verifier argument keeps the policy unit-testable without real Firebase
 * credentials.
 */
export async function authenticateApiRequest(
  req: Request,
  routeName: string,
  verifyToken: VerifyIdToken = verifyWithFirebaseAdmin,
): Promise<ApiAuthResult> {
  const header = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return unauthorised(routeName, 'missing bearer token');

  try {
    const decoded = await verifyToken(match[1]);
    if (!decoded?.uid) return unauthorised(routeName, 'token had no uid');
    return { uid: decoded.uid };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'token verification failed';
    return unauthorised(routeName, reason.slice(0, 160));
  }
}

/** Reject oversized requests before any route consumes the request body. */
export function oversizedApiBodyResponse(req: Request, routeName: string): Response | undefined {
  const contentLength = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_API_BODY_BYTES) {
    console.warn(`[api-auth] ${routeName}: request body exceeds ${MAX_API_BODY_BYTES} bytes`);
    return new Response(JSON.stringify({ error: 'Request body is too large.' }), {
      status: 413,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return undefined;
}

export async function guardPaidApiRequest(
  req: Request,
  routeName: string,
  verifyToken?: VerifyIdToken,
): Promise<ApiAuthResult> {
  const auth = await authenticateApiRequest(req, routeName, verifyToken);
  if (auth.response) return auth;
  const tooLarge = oversizedApiBodyResponse(req, routeName);
  return tooLarge ? { uid: auth.uid, response: tooLarge } : auth;
}
