import { MANUAL_LANGS, isManualLang } from '@/lib/manual';
import { manualSearchIndex } from '@/lib/manual-search-index';

export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
  return MANUAL_LANGS.map(lang => ({ lang }));
}

export function GET(_request: Request, { params }: { params: { lang: string } }) {
  if (!isManualLang(params.lang)) return new Response(null, { status: 404 });
  return Response.json(manualSearchIndex(params.lang));
}
