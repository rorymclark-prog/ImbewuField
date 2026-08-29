import { getApps, getApp, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import {
  checkApiRateLimit,
  normaliseRouteName,
  rateLimitedResponse,
  type RateLimiter,
} from '@/lib/api-rate-limit';
import { SAMPLE_REQUEST_HEADER } from '@/lib/api-auth-shared';

/**
 * The body ceiling this app enforces for itself — and, on Vercel, NOT the ceiling that actually
 * bites first.
 *
 * Vercel refuses a serverless function request body over 4.5 MB at the platform edge, before any
 * code in this repo runs, and answers with its own non-JSON error. 5 MiB is above that, so in
 * production this constant is checked only in the band it can never see. Left as it is
 * deliberately: lowering it would start rejecting requests between 4.5 MB and 5 MiB that succeed
 * today (they do not exist — the platform eats them — but the reasoning should be written down
 * rather than rediscovered), and raising it would be meaningless. It still does real work in
 * self-hosted or local runs, where nothing else caps the body at all.
 *
 * The check is also HEADER-ONLY (see oversizedApiBodyResponse): a request that omits
 * content-length is never pre-flighted. That is the fail-open behaviour tests/api-auth.test.ts
 * pins on purpose, and the true byte ceiling in production is the platform's.
 */
export const MAX_API_BODY_BYTES = 5 * 1024 * 1024;

export type VerifyIdToken = (idToken: string) => Promise<{ uid: string }>;

export interface ApiAuthResult {
  uid: string | null;
  /**
   * Set only when the request was admitted through the guest lane — an anonymous sample-farm
   * visitor on a demo-safe route. Absent otherwise, deliberately: a route that does not know
   * about the lane sees exactly the `{ uid: null }` it has always seen.
   */
  guest?: true;
  response?: Response;
}

function hardAuthRequired(): boolean {
  return process.env.REQUIRE_API_AUTH === '1' || process.env.REQUIRE_API_AUTH === 'true';
}

/** Re-exported so server code has one import for the whole guard. Defined in api-auth-shared so
 *  the browser can read it without dragging firebase-admin into the bundle. */
export { SAMPLE_REQUEST_HEADER };

/* ── The guest lane ────────────────────────────────────────────────────────────────────────────
 *
 * THE PROBLEM IT SOLVES. Sample mode (lib/sample-mode.ts) lets anyone walk a fully-populated demo
 * farm with NO Firebase account at all — that is the entire point of it, and it is how the app is
 * shown to funders, NGOs and farmers who have not signed up. No account means no ID token, which
 * means that the moment REQUIRE_API_AUTH is set, every AI feature in the demo returns 401 and the
 * sample farm becomes a set of dead buttons. Turning on authentication must not cost the demo.
 *
 * WHAT THE LANE IS. lib/api-client-auth.ts attaches `x-imbewu-sample: 1` when sample mode is on
 * and nobody is signed in. A request carrying that header, and no valid token, is admitted — but
 * ONLY to the routes named in GUEST_LANE_ROUTES below.
 *
 * WHAT PROTECTS IT, SAID PLAINLY. Nothing about that header is a credential. Anyone can send it
 * with curl; there is no sample-mode "session" on the server to check it against, and inventing
 * one would be an authentication system with no user behind it. The lane's protection is therefore
 * two things and only two things:
 *
 *   1. THE ALLOWLIST IS A PICK, NEVER AN OMIT. A route is in the lane because someone decided it
 *      belongs there. A new route added tomorrow is OUTSIDE the lane by construction, so the
 *      failure mode of forgetting this file is a demo that 401s — visible, reported, fixed — and
 *      never a data route that silently opened itself to anonymous callers. (tests/api-guest-
 *      lane.test.ts asserts the direction of that default.)
 *   2. THE RATE LIMIT. lib/api-rate-limit.ts charges an anonymous caller twenty AI requests an
 *      hour per address, three reports an hour. Enough to walk the demo and hold a conversation
 *      with it; useless as a free API. The header buys a demo, not a budget.
 *
 * WHAT IS DELIBERATELY OUTSIDE THE LANE, and why each one:
 *
 *   • network/farmers, network/orgs — REAL farmer data under a POPIA consent projection. These are
 *     the reason the flag exists. They already refuse a null uid outright in lib/network-caller.ts
 *     regardless of the flag; keeping them out of this list means that refusal can never be
 *     weakened from here either. No demo needs them: lib/use-network-portfolio.ts serves the
 *     funder/NGO demo from DEMO_NETWORK on the client and never calls these routes signed out.
 *   • image-producer, ai-render, ai-render/poll — image generation, the most expensive calls in
 *     the app by an order of magnitude. The sample farm already declares them off: lib/render-jobs
 *     .ts throws "AI sheets are switched off in the sample farm" for the queued render path. An
 *     anonymous lane into gpt-image would be the worst trade in this file.
 *   • auto-design, design-detect, design-review, suggest-zones-ai, tree-id — guarded, deployed,
 *     and called from NO client code at all (tests/paid-api-auth-wiring.test.ts tracks exactly
 *     this list of orphans). Nothing in the demo can reach them, so admitting them would be adding
 *     anonymous attack surface to buy nothing.
 *
 * Every name here is a route the anonymous demo actually drives, and every one of them is
 * stateless: it reads the request body, calls a model, and returns text. None of them touches
 * stored data belonging to anybody.
 */
export const GUEST_LANE_ROUTES: ReadonlySet<string> = new Set([
  'chat',            // components/ChatPanel.tsx — the demo's centrepiece
  'ai-insights',     // components/InsightsPanel.tsx — the "AI" tab
  'area-profile',    // components/AreaPanel.tsx — what is around this pin
  'life-guide',      // components/LifeGuide.tsx — the "Nature" tab
  'analyse-photos',  // components/PhotoUpload.tsx + DataPanel — reads a photo the visitor supplied
  'design',          // components/SiteDesign.tsx — advice on a sketch
  'design-advice',   // components/design/DesignAdvisor.tsx
  'generate-report', // components/ReportView.tsx — the demo's payoff document
  'lima-vision',     // app/vision/page.tsx — identify/weigh from a photo
  'read-slip',       // app/finances/page.tsx — till-slip capture, part of the finances demo
]);

/** True when the client declares itself an anonymous sample-mode visitor. Forgeable by design. */
export function declaresSampleMode(req: Request): boolean {
  return req.headers.get(SAMPLE_REQUEST_HEADER) === '1';
}

/** Whether an unauthenticated request may proceed on this route as a demo visitor. */
export function guestLaneAdmits(req: Request, routeName: string): boolean {
  return declaresSampleMode(req) && GUEST_LANE_ROUTES.has(normaliseRouteName(routeName));
}

function logUnauthenticated(routeName: string, reason: string): void {
  console.warn(`[api-auth] ${routeName}: unauthenticated request (${reason})`);
}

/**
 * The project id the Admin SDK validates a token's `aud`/`iss` claims against.
 *
 * This MUST be passed explicitly. `initializeApp()` with no argument resolves the project from
 * Application Default Credentials or the GCP metadata server, and this app runs on Vercel, which
 * has neither. Reproduced with the real SDK in a clean environment: it throws
 * "Unable to detect a Project Id in the current environment." — *before* it looks at the token.
 * That throw lands in the catch below and returns `unauthorised()`, so with REQUIRE_API_AUTH=1
 * every request 401s, a perfectly valid farmer token included. The failure is total and it is
 * indistinguishable from correct behaviour when you test it the obvious way: an anonymous request
 * is *supposed* to 401, so a broken verifier and a working one give the identical answer.
 *
 * No service account is needed beyond this. verifyIdToken fetches Google's signing certificates
 * over public HTTPS; the project id is the only thing it cannot discover for itself.
 */
const ADMIN_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID
  ?? process.env.GOOGLE_CLOUD_PROJECT
  ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

async function verifyWithFirebaseAdmin(idToken: string): Promise<{ uid: string }> {
  const app = getApps().length > 0 ? getApp() : initializeApp({ projectId: ADMIN_PROJECT_ID });
  return getAuth(app).verifyIdToken(idToken);
}

function unauthorised(req: Request, routeName: string, reason: string): ApiAuthResult {
  logUnauthenticated(routeName, reason);
  // The guest lane is checked in BOTH modes, not only the hard one. In soft mode it changes no
  // outcome — an unauthenticated request proceeds either way — but it does mark the result, and
  // the mark is what tells the rate limiter to word its refusal for a demo visitor rather than
  // for a farmer. Deciding it here rather than at the flag means the lane is exercised by real
  // traffic long before the flag is flipped, instead of coming to life untested on cutover day.
  if (guestLaneAdmits(req, routeName)) return { uid: null, guest: true };
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
  if (!match) return unauthorised(req, routeName, 'missing bearer token');

  try {
    const decoded = await verifyToken(match[1]);
    if (!decoded?.uid) return unauthorised(req, routeName, 'token had no uid');
    return { uid: decoded.uid };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'token verification failed';
    return unauthorised(req, routeName, reason.slice(0, 160));
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

/**
 * Authentication, body ceiling and spend ceiling, composed — the single call every paid route
 * makes before it does anything else.
 *
 * ORDER, AND WHY IT IS THIS ORDER:
 *   1. AUTH. A caller we will not serve is told so first; nothing else about their request
 *      matters, and a 401 that arrived as a 413 or a 429 would be a puzzle rather than an answer.
 *   2. BODY SIZE. A header-only pre-flight, free to run.
 *   3. RATE LIMIT. Last, so a request that was going to be rejected as malformed does not also
 *      eat the caller's budget — a client bug sending oversized payloads should keep receiving the
 *      413 that tells it what is wrong, not degrade into 429s that do not. Nothing rejected at
 *      step 2 has cost a cent upstream, so nothing is at risk in deferring the count.
 *
 * THE RATE LIMIT IS LIVE NOW, unlike the authentication above it. There is no flag on it, because
 * it has no cutover to stage: it protects the same wallet whether or not REQUIRE_API_AUTH is set,
 * and today — with authentication log-only — it is the ONLY thing standing between a stranger with
 * curl and this app's model bills.
 */
export async function guardPaidApiRequest(
  req: Request,
  routeName: string,
  verifyToken?: VerifyIdToken,
  options: { limiter?: RateLimiter; now?: number } = {},
): Promise<ApiAuthResult> {
  const auth = await authenticateApiRequest(req, routeName, verifyToken);
  if (auth.response) return auth;

  const tooLarge = oversizedApiBodyResponse(req, routeName);
  if (tooLarge) return { ...auth, response: tooLarge };

  const decision = checkApiRateLimit(req, routeName, auth.uid, options);
  if (!decision.verdict.allowed) {
    console.warn(
      `[api-auth] ${routeName}: rate limited ${decision.key} `
      + `(${decision.budget.limit} per ${Math.round(decision.budget.windowMs / 60000)} min)`,
    );
    // The demo wording is keyed on the guest MARK, not merely on "no uid": an anonymous caller who
    // never claimed to be sampling should not be told about the sample farm's shared pool.
    return { ...auth, response: rateLimitedResponse(decision, auth.guest ? 'guest' : 'user') };
  }

  return auth;
}
