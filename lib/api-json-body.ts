/**
 * sec-08: five AI routes called `await req.json()` with no try/catch, so a malformed body (bad
 * JSON, or no body at all) threw out of the handler and Next.js turned that into a bare 500 —
 * instead of the clear 400 every other route in this app already gives a bad request.
 *
 * One shared parse so the fix (and the wording) lives in one place.
 */
export async function parseJsonBody<T = unknown>(
  req: Request,
): Promise<{ data: T; response?: undefined } | { data?: undefined; response: Response }> {
  try {
    const data = (await req.json()) as T;
    return { data };
  } catch {
    return { response: Response.json({ error: 'Invalid request body.' }, { status: 400 }) };
  }
}
