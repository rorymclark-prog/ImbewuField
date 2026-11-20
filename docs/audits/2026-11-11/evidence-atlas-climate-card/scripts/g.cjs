// CP-114 and CP-115: the Atlas climate card in light and dark, phone and desktop.
//   node g.cjs > ../outputs/G.json
// Johannesburg. The place search is stubbed (no map token locally); /api/location-data is the app's own
// local route with its live provider calls. One case alters that answer (marked synthetic).
// For each named element the script records its text, computed colour and its box in screenshot pixels,
// so contrast-from-pixels.py can measure the rendered pixels.
const L = require('../../evidence-decisions/scripts/lib.cjs'); const { chromium } = L;
const OUT = require('path').resolve(__dirname, '../screenshots');
const [lon, lat, full, name] = [28.05, -26.20, 'Johannesburg, Gauteng, South Africa', 'Johannesburg'];
const CASES = [
  { id: 'complete-phone-light', phone: true, dark: false },
  { id: 'complete-phone-dark', phone: true, dark: true },
  { id: 'complete-desktop-light', phone: false, dark: false },
  { id: 'complete-desktop-dark', phone: false, dark: true },
  { id: 'incomplete-phone-dark', phone: true, dark: true, incomplete: true },
  { id: 'incomplete-phone-light', phone: true, dark: false, incomplete: true },
];
(async () => {
  const browser = await chromium.launch(); const results = [];
  for (const c of CASES) {
    const errs = []; const ctx = await L.ctxOf(browser, { dark: c.dark, phone: c.phone }); const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message.slice(0, 120)));
    await p.route('https://api.mapbox.com/geocoding/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ features: [{ place_name: full, text: name, center: [lon, lat] }] }) }));
    let routeAnswer = null;
    await p.route('**/api/location-data**', async (route) => {
      const res = await route.fetch(); const body = await res.json();
      routeAnswer = { status: res.status(), koppen: body?.climate?.koppen, koppenNote: body?.climate?.koppenNote, coverage: body?.climate?.monthlyTempCoverage, minTemp: body?.climate?.minTemp, minTempSource: body?.climate?.minTempSource };
      if (c.incomplete && body && body.climate) {
        body.climate.monthlyTemp = Array(12).fill(20); body.climate.meanTemp = 20; body.climate.maxTemp = 20; body.climate.minTemp = 20;
        delete body.climate.minTempSource; body.climate.monthlyTempCoverage = { source: 'nasa-power', status: 'incomplete' };
      }
      await route.fulfill({ status: res.status(), contentType: 'application/json', body: JSON.stringify(body) });
    });
    await p.goto(L.BASE + '/atlas', { waitUntil: 'networkidle', timeout: 300000 }).catch(() => {}); await p.waitForTimeout(3000);
    await L.settle(p);
    await p.getByLabel('Search anywhere on Earth…').fill(name); await p.waitForTimeout(1500);
    await p.getByText(full).first().click();
    await p.getByText(/mm\/yr/).first().waitFor({ timeout: 120000 }).catch(() => {});
    await p.waitForTimeout(2500);
    const scale = c.phone ? 2 : 1;
    const info = await p.evaluate((scale) => {
      const leaves = [...document.querySelectorAll('span, p, div')];
      const own = (e) => [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
      const pick = (label, test) => { const e = leaves.find((x) => test(own(x))); if (!e) return { label, found: false };
        const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
        return { label, found: true, text: own(e).slice(0, 140), color: cs.color, background: cs.backgroundColor, fontSizePx: cs.fontSize, fontWeight: cs.fontWeight,
          cssBox: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          pixelBox: { x: Math.floor(r.x * scale), y: Math.floor(r.y * scale), w: Math.ceil(r.width * scale), h: Math.ceil(r.height * scale) } }; };
      return {
        theme: { htmlClass: document.documentElement.className, dataTheme: document.documentElement.getAttribute('data-theme') },
        elements: [
          pick('climate code', (t) => /^(Cwb|Cwa|Cfb|Cfa|BSh|BSk)$/.test(t)),
          pick('climate name', (t) => /^Subtropical highland, dry winter$/.test(t)),
          pick('class note', (t) => /This climate type alone does not tell you whether there is frost\.$/.test(t)),
          pick('rain chip', (t) => /^≈ \d+ mm\/yr$/.test(t)),
          pick('calendar chip', (t) => /^Sowing calendar: /.test(t)),
          pick('record-low chip', (t) => /^(Modelled record low: |Record low: not known)/.test(t)),
          pick('incomplete note', (t) => /^Temperature records for this point are incomplete/.test(t)),
        ],
        oldWording: /mild all year|from altitude/.test(document.body.innerText),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    }, scale);
    const file = `G-atlas-${c.id}.png`;
    await p.screenshot({ path: `${OUT}/${file}` });
    results.push({ case: c.id, viewport: c.phone ? '390x844 @2x' : '1280x800 @1x', dark: c.dark, synthetic: c.incomplete ? 'temperature fields replaced with the incomplete-year contract' : null, routeAnswer, screenshot: file, capturedUtc: new Date().toISOString(), ...info, pageErrors: errs.length });
    await ctx.close();
  }
  await browser.close();
  console.log(JSON.stringify({ script: 'g.cjs', base: L.BASE, results }, null, 1));
})().catch((e) => { console.error('FAIL', e.message.slice(0, 1500)); process.exit(1); });
