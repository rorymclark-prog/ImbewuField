import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import CountryReview from '@/components/international/countries/CountryReview';

export const metadata: Metadata = { title: 'Country evidence review — ImbewuField',
  description: 'Provisional country evidence dossiers and public reference checks. International crop planning remains unsupported.' };

export interface InternationalReviewPageProps {
  searchParams?: {
    country?: string | string[];
  };
}

// Next checks the last overload's props; the bare review entry remains callable.
export default function InternationalReviewPage(): ReactElement;
export default function InternationalReviewPage(props: InternationalReviewPageProps): ReactElement;
export default function InternationalReviewPage(props: InternationalReviewPageProps = {}) {
  return <CountryReview countryHint={props.searchParams?.country} />;
}
