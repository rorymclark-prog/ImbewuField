import type InternationalReviewPage from '../app/international/page';

// Next14's generated page guard infers the first argument using this conditional.
// A defaulted implementation parameter made it include undefined: ordinary tsc
// passed until the preview generated its route checks, leaving no usable page.
type FirstArg<T extends Function> = T extends (...args: [infer T, any]) => any ? unknown extends T ? any : T : never;
interface PageProps { params?: any; searchParams?: any }
type AcceptsPageProps<T extends PageProps> = T;
export type CountryEvidencePageContract = AcceptsPageProps<FirstArg<typeof InternationalReviewPage>>;
