import { redirect } from 'next/navigation';

/**
 * THE MONEY USED TO LIVE BEHIND TWO DOORS.
 *
 * A farmer's kilograms went in at "My Records" (/records) and her rands at "Finance"
 * (/finances) — two home tiles, two menu rows, two screens, and no single place that could
 * answer "how much did I make this season?". The Gogo Test audit (27 August, an isiZulu-speaking
 * KZN smallholder on a hand-me-down Android at 375 x 812) named that split as the one thing worth
 * fixing properly: "one book with three tabs: Picked, Sold, Spent. That's her mental model
 * already and it needs no translation."
 *
 * So there is one book now, at /records, and this route is the door that still opens onto it.
 * It is NOT deleted: /finances is a permanent tab-bar destination in every build a farmer has
 * already installed, it is linked from the Journal, the invoice tool and the vision mockups, and
 * it is what anyone who bookmarked their money screen will tap tomorrow. A 404 there would read
 * as "my books are gone".
 *
 * A server-side redirect rather than a client-side one, so the phone never paints a dead screen
 * first, and the query string is carried across by hand — nothing sends a farmer here with
 * parameters today, but a redirect that silently drops them is the kind of thing that only shows
 * up later, in someone else's link.
 */
export default async function FinancesRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((v) => query.append(key, v));
    else if (value !== undefined) query.append(key, value);
  }
  const qs = query.toString();
  redirect(qs ? `/records?${qs}` : '/records');
}
