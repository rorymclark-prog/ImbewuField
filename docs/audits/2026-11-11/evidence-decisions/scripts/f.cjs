// FDR-01 (Codex final review, 11 November 2026): the Atlas panel with complete, incomplete and unreceipted temperatures,
// and the record-low chip with and without its source tag.
//   node f.cjs > ../outputs/F.txt
// The Mapbox geocoder is stubbed (no token locally). /api/location-data is the app's own local route.
// For the "incomplete" case the route's REAL answer is fetched and only its temperature fields are replaced
// with what lib/nasa-power.ts sends when months are missing: 20 in every month and coverage 'incomplete'.
const L = require('./lib.cjs'); const { chromium, log, D } = L; const errs = [];
const [lon, lat, full, name] = [28.05, -26.20, 'Johannesburg, Gauteng, South Africa', 'Johannesburg'];
const CASES = [
  { id: 'complete-phone-light', incomplete: false, phone: true, dark: false },
  { id: 'complete-phone-dark', incomplete: false, phone: true, dark: true },
  { id: 'incomplete-phone-light', incomplete: true, phone: true, dark: false },
  { id: 'incomplete-phone-dark', incomplete: true, phone: true, dark: true },
  { id: 'incomplete-desktop', incomplete: true, phone: false, dark: false },
  { id: 'complete-desktop', incomplete: false, phone: false, dark: false },
  { id: 'no-receipt-phone-light', noReceipt: true, phone: true, dark: false },
  { id: 'complete-untagged-low-phone-light', untagged: true, phone: true, dark: false },
];
(async () => {
  const browser = await chromium.launch();
  for (const c of CASES) {
    log('\n== F ' + c.id);
    const ctx = await L.ctxOf(browser, { dark: c.dark, phone: c.phone }); const p = await ctx.newPage(); L.watch(p, 'F-' + c.id, errs);
    await p.route('https://api.mapbox.com/geocoding/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ features: [{ place_name: full, text: name, center: [lon, lat] }] }) }));
    await p.route('**/api/location-data**', async (route) => {
      const res = await route.fetch(); const body = await res.json();
      log('  location-data', res.status(), 'koppen', body?.climate?.koppen, 'coverage', JSON.stringify(body?.climate?.monthlyTempCoverage), 'coldest mean', Math.min(...(body?.climate?.monthlyTemp ?? [NaN])), 'minTemp', body?.climate?.minTemp);
      if (c.incomplete && body && body.climate) {
        body.climate.monthlyTemp = Array(12).fill(20); body.climate.meanTemp = 20; body.climate.maxTemp = 20; body.climate.minTemp = 20;
        delete body.climate.minTempSource; body.climate.monthlyTempCoverage = { source: 'nasa-power', status: 'incomplete' };
        log('  -> temperature fields replaced with the incomplete-year contract; koppen label left as the server sent it');
      }
      if (c.noReceipt && body && body.climate) { delete body.climate.monthlyTempCoverage; log('  -> coverage receipt removed; every number left as the server sent it'); }
      if (c.untagged && body && body.climate) { delete body.climate.minTempSource; log('  -> minTempSource tag removed; every number left as the server sent it'); }
      await route.fulfill({ status: res.status(), contentType: 'application/json', body: JSON.stringify(body) });
    });
    await p.goto(L.BASE + '/atlas', { waitUntil: 'networkidle', timeout: 300000 }).catch((e) => log('goto', e.message.slice(0, 100))); await p.waitForTimeout(3000);
    await L.settle(p);
    const input = p.getByLabel('Search anywhere on Earth…'); await input.fill(name); await p.waitForTimeout(1500);
    await p.getByText(full).first().click();
    await p.getByText(/mm\/yr/).first().waitFor({ timeout: 120000 }).catch(() => log('  rain chip not found'));
    await p.waitForTimeout(2500);
    const info = await p.evaluate(() => {
      const body = document.body.innerText;
      const notes = [...document.querySelectorAll('[data-atlas-temperature]')].map((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { text: e.textContent.trim(), px: cs.fontSize, color: cs.color, left: Math.round(r.left), right: Math.round(r.right), vw: innerWidth }; });
      return {
        notes,
        recordLow: [...document.querySelectorAll('[data-atlas-record-low]')].map((e) => { const r = e.getBoundingClientRect(); return { state: e.getAttribute('data-atlas-record-low'), text: e.innerText.replace(/\n/g, ' | '), left: Math.round(r.left), right: Math.round(r.right), vw: innerWidth }; }),
        frostWords: body.match(/[^\n]*frost[^\n]*/gi),
        climateType: body.match(/\b(Cwb|Cwa|Cfa|Cfb|BSh|BSk)\b[^\n]*/g),
        calendarChip: body.match(/Sowing calendar:[^\n]*/g),
        growCard: /What could grow here/i.test(body),
        temperatureLines: body.match(/[^\n]*°C[^\n]*/g),
        coldestHottest: body.match(/Coldest month|Hottest month/g),
        rain: body.match(/≈ \d+ mm ?\/ ?yr/g),
        wetDry: body.match(/Wet:[^\n]*|Dry:[^\n]*/g),
      };
    });
    log(JSON.stringify(info, null, 1)); log('overflow', JSON.stringify(await L.overflow(p)));
    await p.screenshot({ path: `${D}/F-atlas-${c.id}.png` });
    const note = p.locator('[data-atlas-temperature]').last();
    if (await note.count()) { await note.scrollIntoViewIfNeeded(); await p.waitForTimeout(500); await p.screenshot({ path: `${D}/F-atlas-${c.id}-temperature-card.png` }); }
    else { const t = p.getByText('Coldest month').first(); if (await t.count()) { await t.scrollIntoViewIfNeeded(); await p.waitForTimeout(500); await p.screenshot({ path: `${D}/F-atlas-${c.id}-temperature-card.png` }); } }
    await ctx.close();
  }
  log('\nERRORS', JSON.stringify(errs, null, 1)); await browser.close();
})().catch((e) => { console.error('FAIL', e.message.slice(0, 1500)); process.exit(1); });
