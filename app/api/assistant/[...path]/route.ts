import { assistantProxy } from '@/lib/assistant-proxy';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;
function handle(req: Request, { params }: { params: { path: string[] } }) { return assistantProxy(req, params.path.join('/')); }
export { handle as GET, handle as POST, handle as PUT, handle as DELETE, handle as OPTIONS };
