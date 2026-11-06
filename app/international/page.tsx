import type { Metadata } from 'next';
import CountryReview from '@/components/international/countries/CountryReview';

export const metadata: Metadata = { title: 'Country evidence review — ImbewuField',
  description: 'Provisional country evidence dossiers and public reference checks. International crop planning remains unsupported.' };

export interface InternationalReviewPageProps {
  searchParams?: {
    country?: string | string[];
  };
}

export default function InternationalReviewPage(props: InternationalReviewPageProps = {}) {
  return <CountryReview countryHint={props.searchParams?.country} />;
}
