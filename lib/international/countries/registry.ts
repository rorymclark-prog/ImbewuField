import { unknown, type CountryProfile, type CountrySource, type EvidenceCategory, type Known } from './types';
import { NWS_OBSERVATION_PROVIDER, SONOMA_NWS_REFERENCE } from '../providers/nws-observation';

const DATE = '2026-11-01';
const unreviewed = () => ({ status: 'not-reviewed' as const, regionId: null, reviewedOn: null, validThrough: null, sourceIds: [], reviewer: null });
const known = (value: string): Known<string> => ({ status: 'known', value });
/** These are source-discovery records, not copied agronomic datasets. Unknown
 * licences and cadence deliberately remain visible until dataset-level review. */
function source(id: string, category: EvidenceCategory, authority: string, url: string, coverage: string,
  verifiedClaim: string, extra: Partial<CountrySource> = {}): CountrySource {
  return { id, category, authority, title: authority, url, coverage,
    resolution: unknown('No dataset resolution was established from this source page.'),
    units: unknown('No measurement dataset is imported from this page.'),
    updateCadence: unknown('Dataset update cadence has not been verified.'),
    licence: unknown('Dataset reuse terms have not been verified; public access is not a reuse licence.'),
    attribution: authority, accessRequirements: known('Public source page read without an account; downstream data access not established.'),
    missingDataBehavior: 'No adapter is connected to this source. Missing content remains a review gap, never a default measurement.',
    verification: 'content-read', accessedOn: DATE, publishedOn: null, reviewDueOn: null, verifiedClaim,
    limitations: 'An authority page or reference source does not establish locally reviewed crop-plan support or species-level permission.', ...extra };
}
const unavailable = (reason: string): Partial<CountrySource> => ({ verification: 'unavailable',
  accessRequirements: unknown(reason), verifiedClaim: 'Full content could not be read in this verification run.', limitations: reason });

export const COUNTRY_PROFILES: readonly CountryProfile[] = [
  { code: 'KE', name: 'Kenya', stage: 'engineering-pilot', jurisdictionNote: 'National and county responsibilities require separate review; forestry, seed and phytosanitary authorities are not interchangeable.', regions: [], agronomyReview: unreviewed(), sources: [
    source('ke-kefri', 'biodiversity', 'Kenya Forestry Research Institute (KEFRI)', 'https://www.kefri.org/home.html', 'Kenya forestry research', 'The official page links forestry biodiversity research, a GBIF publishing toolkit and eco-region programmes; none is an approval to plant.'),
    source('ke-kalro', 'agricultural-extension', 'Kenya Agricultural & Livestock Research Organisation (KALRO)', 'https://kalro.ecitizen.go.ke/', 'Kenya agricultural research', 'The official eCitizen page identifies KALRO’s research and information role; services use eCitizen. No crop production guide was imported.', { accessRequirements: known('Public introduction; service applications and payments require eCitizen. No account was opened.') }),
    source('ke-kmd', 'weather-frost', 'Kenya Meteorological Department', 'https://meteo.go.ke/', 'Kenya weather and climate services', 'The official portal links forecasts, agrometeorology, climate data and stations; a frost-data contract was not verified.'),
    source('ke-soil-nrf', 'soils', 'National Research Fund: Rongo University soil laboratory listing', 'https://risp.nrf.go.ke/facility/1', 'Listed facility in Kisii, Kenya; not a national soil map', 'The official facility page describes soil analysis; equipment information is absent. This is a service lead, not a spatial soil dataset.'),
    source('ke-kephis', 'plant-legality', 'Kenya Plant Health Inspectorate Service (KEPHIS)', 'https://kephis.go.ke/', 'Kenya plant health, seed certification and phytosanitary services', 'The official page identifies plant-health regulatory functions and services; it is not a complete invasive-species or propagation-permission register.'),
  ] },
  { code: 'GB', name: 'United Kingdom', stage: 'engineering-pilot', jurisdictionNote: 'England, Scotland, Wales and Northern Ireland require jurisdiction-specific legal and agricultural review. Great Britain evidence does not automatically cover Northern Ireland.', regions: [], agronomyReview: unreviewed(), sources: [
    source('gb-jncc', 'biodiversity', 'Joint Nature Conservation Committee (JNCC)', 'https://jncc.gov.uk/', 'UK nature conservation evidence and advice', 'The official site describes nature-conservation evidence and advice; species occurrences and conservation status are separate from planting permission.'),
    source('gb-nbn', 'biodiversity', 'National Biodiversity Network (NBN Atlas)', 'https://nbn.org.uk/the-nbn-atlas/', 'Candidate biodiversity portal; coverage unverified', '', unavailable('Full page unavailable through the browsing tool; no NBN dataset, licence or API contract was verified.')),
    source('gb-extension', 'agricultural-extension', 'Farming Advice Service candidate', 'https://www.gov.uk/guidance/farming-advice-service', 'Candidate England advice route; scope unverified', '', unavailable('The candidate GOV.UK URL could not be read; the current advice provider and devolved equivalents need verification.')),
    source('gb-metoffice', 'weather-frost', 'Met Office', 'https://www.metoffice.gov.uk/services/data', 'UK and global products, each with its own scope', 'The official page distinguishes open datasets, licensed services and Weather DataHub APIs. This does not verify frost dates or a single licence for every product.'),
    source('gb-ukceh', 'soils', 'UK Centre for Ecology & Hydrology (UKCEH)', 'https://www.ceh.ac.uk/data/web-based-apps', 'Great Britain for the listed soil-health tool', 'The official catalogue links the Countryside Survey Soil Health Tool. Its dataset resolution, terms and API were not reviewed.'),
    source('gb-defra', 'plant-legality', 'UK Plant Health Information Portal / Defra', 'https://planthealthportal.defra.gov.uk/', 'Portal with jurisdiction-specific links; Great Britain import guidance is explicitly linked', 'The portal links legislation, plant health, seeds and import-rule checks. It is not blanket permission to propagate or plant; Northern Ireland needs separate checks.'),
  ] },
  { code: 'US', name: 'United States', stage: 'engineering-pilot', jurisdictionNote: 'Federal, state, tribal and local requirements differ; an APHIS contact or federal dataset cannot settle every local permission.', regions: [], agronomyReview: unreviewed(), sources: [
    source('us-itis', 'biodiversity', 'Integrated Taxonomic Information System (ITIS)', 'https://www.itis.gov/', 'North America and world taxonomy', 'The official site provides taxonomic names and relationships, not planting recommendations, occurrence completeness or legal permission.'),
    source('us-extension', 'agricultural-extension', 'USDA National Institute of Food and Agriculture: Cooperative Extension', 'https://www.nifa.usda.gov/about-nifa/how-we-work/extension', 'US federal/state/county extension network', 'The official page describes federal, land-grant and local extension roles. A state-specific production guide remains unreviewed.'),
    source('us-nifa-land-grant-directory', 'agricultural-extension', 'USDA NIFA Land-grant University Website Directory',
      'https://www.nifa.usda.gov/grants/land-grant-university-website-directory', 'US land-grant institutions listed by NIFA',
      'The public directory lists land-grant institutions and links to their websites.', {
        accessedOn: '2026-11-04', publishedOn: null, lastModifiedOn: '2025-04-23',
        licence: unknown('Website reuse terms have not been verified from the public directory page.'),
        accessRequirements: known('Public directory read without an account. Access to linked institution sites and automated access remain unverified.'),
        missingDataBehavior: 'The dossier keeps the directory as an external referral link.',
        limitations: 'County office locations, current contacts, appointments, fees, advisory services and local crop guidance remain unverified.',
      }),
    source('us-noaa', 'weather-frost', 'NOAA National Centers for Environmental Information', 'https://www.ncei.noaa.gov/access/us-climate-normals/', 'US climate normals portal', 'The public portal identifies US Climate Normals. Its dynamic product details, station selection and frost interpretation were not verified.'),
    source('us-nws-observation', 'weather-frost', 'NOAA National Weather Service station observations', NWS_OBSERVATION_PROVIDER.docsUrl,
      NWS_OBSERVATION_PROVIDER.coverage, 'Official documentation, schema and public station/observation responses were read. The opt-in example preserves published station identity, units, quality-control flags and missing readings; it supplies no local farming approval.', {
        accessedOn: '2026-11-03',
        resolution: known(`Point reference at ${SONOMA_NWS_REFERENCE.label}; station and observation publish separate geometries, both retained. No farm-scale resolution is established.`),
        units: known('Provider WMO unit codes are retained. The decoder accepts Celsius, percent, kilometres per hour, angle degrees and millimetres; missing or unsupported units remain unknown.'),
        updateCadence: unknown(NWS_OBSERVATION_PROVIDER.cadence), licence: known(NWS_OBSERVATION_PROVIDER.licence),
        attribution: NWS_OBSERVATION_PROVIDER.attribution, accessRequirements: known(NWS_OBSERVATION_PROVIDER.authentication),
        missingDataBehavior: 'The bounded opt-in adapter preserves missing and invalid measurements as unknown. Errors supply no replacement readings; a successful request does not establish freshness.',
        limitations: NWS_OBSERVATION_PROVIDER.limitations,
      }),
    source('us-nrcs', 'soils', 'USDA NRCS Web Soil Survey', 'https://www.nrcs.usda.gov/resources/data-and-reports/web-soil-survey', 'US National Cooperative Soil Survey; available survey coverage must be checked', 'The official page describes downloadable soil survey data and an annual refresh; map interpretation still needs local assessment.', { updateCadence: known('Annual Soils Refresh updates survey data and interpretations once a year, per the source page.'), attribution: 'Soil Survey Staff. Web Soil Survey. USDA Natural Resources Conservation Service; include access date.' }),
    source('us-aphis', 'plant-legality', 'USDA Animal and Plant Health Inspection Service (APHIS)', 'https://www.aphis.usda.gov/contact/plant-health', 'Federal plant health and state contacts', 'The official page directs state plant-health and interstate movement questions to state directors. This does not replace state noxious-weed law or other permissions.', { lastModifiedOn: '2026-10-02' }),
  ] },
  { code: 'BR', name: 'Brazil', stage: 'engineering-pilot', jurisdictionNote: 'Federal and state rules and Portuguese source review are required; biodiversity data does not establish native status, invasive status or permission.', regions: [], agronomyReview: unreviewed(), sources: [
    source('br-sibbr', 'biodiversity', 'Sistema de Informação sobre a Biodiversidade Brasileira (SiBBr)', 'https://sibbr.gov.br/', 'Candidate Brazil biodiversity portal; coverage unverified', '', unavailable('Browsing access was restricted; no SiBBr dataset content, API or reuse terms were verified.')),
    source('br-embrapa', 'agricultural-extension', 'Embrapa', 'https://www.embrapa.br/', 'Brazil agricultural research candidate', '', unavailable('The official homepage returned HTTP 403 to the browsing tool. Production guidance and local extension delivery remain unreviewed.')),
    source('br-inmet', 'weather-frost', 'Instituto Nacional de Meteorologia (INMET)', 'https://portal.inmet.gov.br/', 'Brazil weather and climate services', 'The official portal links forecasts, stations, climatological normals and frost maps; no crop frost threshold or automated local contract was verified.'),
    source('br-embrapa-soils', 'soils', 'Embrapa: Sistema de Informação de Solos Brasileiros', 'https://www.sisolos.cnptia.embrapa.br/', 'Brazil soil-profile data repository link', 'The official page directs morphological and analytical soil-profile data to Redape DOI 10.48432/DDBVFO and states CC BY-NC 4.0; no dataset was copied.', { licence: known('The source page states Embrapa CC BY-NC 4.0 for linked soil-profile data; commercial reuse needs separate review.') }),
    source('br-mapa', 'plant-legality', 'Ministério da Agricultura e Pecuária: Sanidade Vegetal', 'https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/sanidade-vegetal', 'Brazil federal plant-health portal', 'The official page describes plant-health protection and links import/export and risk-analysis functions. This is not a complete state/federal plant-legality register.', { publishedOn: '2016-11-18' }),
  ] },
];

export function countryProfile(code: string): CountryProfile | undefined {
  return COUNTRY_PROFILES.find((profile) => profile.code === code.toUpperCase());
}

export const COUNTRY_RESEARCH_QUEUE = [
  { group: 'East Africa', countries: ['Kenya', 'Uganda', 'Tanzania', 'Rwanda', 'Ethiopia'] },
  { group: 'South and Southeast Asia', countries: ['India', 'Nepal', 'Bangladesh', 'Indonesia'] },
  { group: 'Latin America', countries: ['Brazil', 'Colombia', 'Peru', 'Mexico'] },
  { group: 'Additional national dossiers', countries: ['United Kingdom', 'United States', 'Canada', 'Australia', 'New Zealand'] },
] as const;
export const EUROPE_RESEARCH_NOTE = 'Europe is a research grouping, not a country, agricultural region or legal jurisdiction. Build separate national and subnational dossiers; no European crop-plan or legal support is enabled.';
