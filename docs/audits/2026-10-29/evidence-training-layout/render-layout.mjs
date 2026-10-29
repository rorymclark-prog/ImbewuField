import fs from 'node:fs';
import { buildProgrammePdf } from '../../../../lib/programme-report-pdf.ts';
import { freshEvidenceData, validTrainingRecord } from '../../../../lib/programme-evidence.ts';

const out = process.argv[2] ?? '/tmp/imbewu-training-layout';
fs.mkdirSync(out, { recursive: true });
const session = structuredClone(freshEvidenceData().sessions[0]);
session.title = 'Community learning and practical observation workshop with participants and facilitators from neighbouring gardens, including a review of records and next steps';
const candidate = session.photos[0].image;
session.photos = [{ image: '', caption: 'A recorded photograph of the workshop with participants discussing the activity and reviewing their notes together. The caption records only the activity shown, without claiming assessed competence or later adoption of the practice.' }];
// Use an existing demonstration photograph; no real attendance or new field claim.
session.photos[0].image = candidate.startsWith('data:') ? candidate : 'data:image/jpeg;base64,' + fs.readFileSync(new URL('../../../../public' + candidate, import.meta.url)).toString('base64');
session.photos = Array.from({ length: 8 }, (_, index) => ({ ...session.photos[0], caption: `${index + 1}. ` + session.photos[0].caption }));
session.photoCount = session.photos.length;
if (!validTrainingRecord(session, '2026-10-29')) throw new Error('The export fixture exceeds the real saved-record limits');
for (const language of ['en', 'zu']) for (const ink of [false, true]) for (const format of ['summary', 'full']) {
 const pdf = await buildProgrammePdf('Training session report', true, [{ title: 'Session delivery', lines: [session.report] }], format, undefined, session.photos, 'Training evidence', undefined, { session, language, ink, date: '2026-10-29' });
 const path = `${out}/session-${language}-${ink ? 'ink' : 'colour'}-${format}.pdf`;
 fs.writeFileSync(path, Buffer.from(pdf.output('arraybuffer')));
 console.log(JSON.stringify({ path, pages: pdf.getNumberOfPages(), titleLength: session.title.length, validSession: validTrainingRecord(session, '2026-10-29') }));
}
