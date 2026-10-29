import { authenticateApiRequest } from '@/lib/api-auth';
import { callAiMapControls } from '@/lib/ai-render/server-access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(req: Request, write: boolean) {
  const auth = await authenticateApiRequest(req, 'ai-render/settings');
  if (!auth.uid) return Response.json({ error: 'Sign in to manage AI glossy maps.' }, { status: 401 });
  try {
    const body = write ? await req.json() : undefined;
    const upstream = await callAiMapControls(req, 'settings', body);
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return Response.json({ error: 'AI map settings could not be saved or checked. Please try again.' }, { status: 503 });
  }
}
export const GET = (req: Request) => handle(req, false);
export const POST = (req: Request) => handle(req, true);
