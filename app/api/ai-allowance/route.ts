import { authenticateApiRequest } from '@/lib/api-auth';
import { clientIp } from '@/lib/api-rate-limit';
import { loadAiBudget } from '@/lib/ai-budget';

export const runtime = 'nodejs';

/** How much of this month's AI allowance is left — read by the Account page. Costs nothing upstream. */
export async function GET(req: Request) {
  const auth = await authenticateApiRequest(req, 'ai-allowance');
  if (auth.response) return auth.response;
  const who = auth.uid ? { kind: 'user' as const, uid: auth.uid } : { kind: 'guest' as const, ip: clientIp(req) };
  const { allowance } = await loadAiBudget(who, 'ai-allowance');
  return Response.json(allowance, { headers: { 'Cache-Control': 'private, no-store' } });
}
