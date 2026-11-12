import { worldvegKenyaCowpeaSpacing, worldvegKenyaCowpeaSpacingReference } from './worldveg-kenya-cowpea';
import { USDA_CABBAGE_SPACING, usdaGreatLakesCabbageReference, usdaGreatLakesRegionMatches } from './usda-great-lakes-cabbage';

export type RegionalSpacingConditions = {
  purpose: '' | 'leaves' | 'pods-or-grain' | 'cabbage-transplants';
  habit: '' | 'spreading' | 'erect-or-semi-erect' | 'not-applicable';
};
/** One code-owned applicability/range lookup for resolver, persisted origin and
 * export. A matching country is insufficient for the regional US guide. */
export function regionalSpacingReference(country: string | null, crop: string, region: string | null,
  conditions: RegionalSpacingConditions) {
  if (country === 'US' && usdaGreatLakesCabbageReference(country, crop) && usdaGreatLakesRegionMatches(region)
    && conditions.purpose === 'cabbage-transplants' && conditions.habit === 'not-applicable') {
    return { ...USDA_CABBAGE_SPACING, establishment: 'transplant' as const };
  }
  if (!['', 'leaves', 'pods-or-grain'].includes(conditions.purpose)
    || !['', 'spreading', 'erect-or-semi-erect'].includes(conditions.habit)) return null;
  const cowpea = conditions as Parameters<typeof worldvegKenyaCowpeaSpacingReference>[2];
  const reference = worldvegKenyaCowpeaSpacingReference(country, crop, cowpea);
  return reference ? { ...reference, display: worldvegKenyaCowpeaSpacing(cowpea)!, establishment: 'direct' as const } : null;
}
