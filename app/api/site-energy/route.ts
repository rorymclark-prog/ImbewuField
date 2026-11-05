import { handleSiteEnergyRequest } from '@/lib/site-energy-route';

export const runtime = 'nodejs';
export async function POST(req: Request) { return handleSiteEnergyRequest(req); }
