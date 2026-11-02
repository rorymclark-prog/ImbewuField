import type { Metadata } from 'next';
import CountryReview from '@/components/international/countries/CountryReview';

export const metadata: Metadata = { title: 'Country evidence review — ImbewuField',
  description: 'Provisional country evidence dossiers and public reference checks. International crop planning remains unsupported.' };

export default function InternationalReviewPage() {
  return <CountryReview />;
}
