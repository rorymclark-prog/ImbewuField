import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleFullSiteReport } from '../lib/report-summary.ts';
import { DEMO_LOCATION } from '../lib/demo-site.ts';
import type { ReportSiteFacts } from '../lib/report-site-facts.ts';

test('the isiZulu sample report translates its fixed basis, inventory and evidence safeguards', () => {
  const report = sampleFullSiteReport(null, DEMO_LOCATION, 'zu');

  assert.match(report, /## Isisekelo sombiko/);
  assert.match(report, /Asikona ukuhlaziywa okusha kwe-AI/);
  assert.match(report, /Izibonelo zezimali, zomhlabathi nezasekhaya ziyizibonelo zokubonisa kuphela uma zibhalwe kanjalo/);
  assert.match(report, /akufakazeli ukuthi umsebenzi usuqediwe/);
  assert.match(report, /## Uhlu oluphelele lomklamo\n\nAkukho zinto ezibekiwe ezirekhodiwe/);
  assert.match(report, /## Izindawo zokukhiqiza\n\nAzikho izindawo zokukhiqiza ezirekhodiwe/);
  assert.match(report, /## Ubufakazi nemikhawulo/);
  assert.match(report, /asibona ubufakazi bendawo yangempela/);
  assert.match(report, /Izilinganiso, amanani noma amarekhodi angekho zihlala zingekho/);
  assert.match(report, /Buyekeza indawo, izinsuku nobufakazi nenhlangano ezosebenzisa uhlelo/);
  assert.match(report, /esinqumweni sokuxhasa ngezimali/);
  assert.doesNotMatch(report, /This ready-to-read sample|Full design inventory|Production spaces|Evidence and limitations|No placed elements recorded|No production spaces recorded/);
});

test('the isiZulu inventory labels mapped status and space kinds but retains farmer names', () => {
  const facts: ReportSiteFacts = {
    design: {
      beds: [
        { label: 'Upper bed', areaM2: 18.5, kind: 'bed' },
        { label: 'Maize plot', areaM2: 80, kind: 'plot' },
      ],
      bedCount: 1, bedAreaM2: 18.5, plotCount: 1, plotAreaM2: 80, growingAreaM2: 98.5,
      elements: [
        { name: 'Water tank', category: 'water', count: 1, status: 'existing' },
        { name: 'Compost bay', category: 'soil', count: 1, status: 'proposed' },
        { name: 'Fence', category: 'structure', count: 1, status: 'mixed' },
      ],
      routes: [], zones: [],
    },
  };
  const report = sampleFullSiteReport(facts, DEMO_LOCATION, 'zu');

  assert.match(report, /Water tank × 1 · okukhona/);
  assert.match(report, /Compost bay × 1 · okuhleliwe/);
  assert.match(report, /Fence × 1 · isimo esixubile/);
  assert.match(report, /Upper bed · 18[,.]5 m² · umbhede/);
  assert.match(report, /Maize plot · 80 m² · isiza/);
  assert.doesNotMatch(report, /· existing|· proposed|· mixed|· bed\b|· plot\b/);
});

test('the English sample keeps its established safeguards and empty-data wording', () => {
  const report = sampleFullSiteReport(null, DEMO_LOCATION, 'en');

  assert.match(report, /This ready-to-read sample is assembled from the saved site and design records/);
  assert.match(report, /not evidence of the real site/);
  assert.match(report, /Missing measurements, quotes or records remain missing/);
  assert.match(report, /No placed elements recorded/);
  assert.match(report, /No production spaces recorded/);
});
