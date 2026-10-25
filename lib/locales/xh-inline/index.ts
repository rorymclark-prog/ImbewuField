// The isiXhosa drafts for the inline isiZulu branches (see lib/xh-inline.ts), one shard per
// component group. Keys are the exact English the screen shows; tests/xh-inline.test.ts checks
// each key still appears in the source and keeps its {placeholders}.
import g01 from './g01-survey';
import g02 from './g02-account-settings';
import g03 from './g03-community-contact';
import g04 from './g04-atlas-network-map';
import g05 from './g05-programme-mel';
import g06 from './g06-reports';
import g07 from './g07-exchange-prices';
import g08 from './g08-records-money-crops';
import g09 from './g09-farmer-design-home';
import g10 from './g10-journal-samples-consent';
import g11 from './g11-records-charts';
import g13 from './g13-dates-feedback';
import g14 from './g14-studies-deck';
import g15 from './g15-programme-evidence';
import g16 from './g16-programme-reports';
import g17 from './g17-waves-19-21';
import g18 from './g18-programme-report-body';
import g19 from './g19-crop-production';
import g20 from './g20-study-components';
import g21 from './g21-staff-misc';
import g22 from './g22-production-data';
import g23 from './g23-funder-charts';
import s01 from './s01-mel-templates';
import s02 from './s02-study-tracks';

const SHARDS: Record<string, string>[] = [g01, g02, g03, g04, g05, g06, g07, g08, g09, g10, g11, g13, g14, g15, g16, g17, g18, g19, g20, g21, g22, g23, s01, s02];

export const XH_INLINE_SOURCE: Record<string, string> = Object.assign({}, ...SHARDS);
