import { assistantProxy } from '@/lib/assistant-proxy';
export const dynamic = 'force-dynamic';
export function GET(req: Request) { return assistantProxy(req, 'resource-metadata'); }
