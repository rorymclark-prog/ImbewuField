/*
 * The two halves of the guest lane have to agree on one string, and they live on opposite sides of
 * the server/client line.
 *
 * lib/api-auth.ts (server) imports firebase-admin. lib/api-client-auth.ts ('use client') must never
 * pull that into the browser bundle — the Admin SDK in a browser is both a build failure and, if it
 * somehow built, a credential leak. So the one thing both files need — the name of the header a
 * sample-mode visitor sends — lives here, in a module that imports nothing.
 *
 * The alternative, writing 'x-imbewu-sample' twice, is the failure this file exists to prevent:
 * two spellings of one fact, where a typo on either side does not break a build or a test but
 * quietly closes the demo lane for every anonymous visitor on cutover day.
 */

/**
 * Declares "this request comes from an anonymous sample-farm visitor".
 *
 * NOT A CREDENTIAL. Anyone can send it. See the guest-lane trust model in lib/api-auth.ts for what
 * actually protects the routes it opens (an explicit allowlist, and a small per-address budget in
 * lib/api-rate-limit.ts).
 */
export const SAMPLE_REQUEST_HEADER = 'x-imbewu-sample';
