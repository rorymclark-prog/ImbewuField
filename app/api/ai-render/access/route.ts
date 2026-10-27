import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest } from '@/lib/api-auth';
import { aiRenderEnabled } from '@/lib/ai-render/flag';
import { aiRenderAccessState } from '@/lib/ai-render/access';
import { resolveAiRenderAccess } from '@/lib/ai-render/server-access';

export const dynamic = 'force-dynamic';

// This endpoint returns only the caller's eligibility; it exposes no tester list or claims.
// Authentication verifies Google's token signature and needs no Firestore credentials on Vercel.
export async function GET(req: NextRequest) {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!aiRenderEnabled()) {
    return NextResponse.json(aiRenderAccessState('disabled'), { headers });
  }
  const auth = await authenticateApiRequest(req, '/api/ai-render/access');
  // Signed-out is a normal locked UI state even when other APIs enforce strict authentication.
  const access = await resolveAiRenderAccess(req, auth.uid);
  return NextResponse.json(access, { headers });
}
