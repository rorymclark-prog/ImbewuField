// CP-116: the Atlas panel's cards below the climate card, at phone width, in both themes and both modes.
//   node h-atlas.cjs > ../outputs/H-atlas.json
// Johannesburg. The place search is stubbed (no map token locally); /api/location-data is the app's own
// local route with its live provider calls, unaltered. An element is measured only when it lies fully inside
// the open sheet below its "This point" heading and above the bottom bar, so nothing hidden is read. Output has the same shape as the earlier G.json so
// the same contrast-from-pixels.cjs can measure the rendered pixels.
const L = require('../../evidence-decisions/scripts/lib.cjs'); const { chromium } = L;
const OUT = require('path').resolve(__dirname, '../screenshots');
const [lon, lat, full, name] = [28.05, -26.20, 'Johannesburg, Gauteng, South Africa', 'Johannesburg'];
const CASES = [['earth', false], ['earth', true], ['slate', false], ['slate', true]];
(async () => {
  const browser = await chromium.launch(); const results = [];
  for (const [theme, dark] of CASES) {
    const id = `${theme}-${dark ? 'dark' : 'light'}`; const errs = [];
    const ctx = await L.ctxOf(browser, { dark, phone: true }); await ctx.addInitScript((t) => { try { localStorage.setItem('fp-theme', t); } catch {} }, theme);
    const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message.slice(0, 80)));
    await p.route('https://api.mapbox.com/geocoding/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ features: [{ place_name: full, text: name, center: [lon, lat] }] }) }));
    await p.goto(L.BASE + '/atlas', { waitUntil: 'networkidle', timeout: 300000 }).catch(() => {}); await p.waitForTimeout(3000); await L.settle(p);
    await p.getByLabel('Search anywhere on Earth…').fill(name); await p.waitForTimeout(1500); await p.getByText(full).first().click();
    await p.getByText(/mm\/yr/).first().waitFor({ timeout: 120000 }).catch(() => {}); await p.waitForTimeout(2500);
    const themeSeen = await p.evaluate(() => ({ htmlClass: document.documentElement.className, dataTheme: document.documentElement.getAttribute('data-theme') }));
    // Two views: scrolled to the soil card, and scrolled to the crop list.
    for (const [view, anchor] of [['soil', /^Sand$/], ['grow', /^From our crop catalog/]]) {
      const target = p.getByText(anchor).first(); if (!(await target.count())) continue;
      await target.scrollIntoViewIfNeeded(); await p.evaluate(() => { const s = [...document.querySelectorAll('*')].find((e) => e.scrollHeight > e.clientHeight + 40 && getComputedStyle(e).overflowY !== 'visible' && e.querySelector('[data-atlas-record-low]')); if (s) s.scrollBy(0, 120); }); await p.waitForTimeout(700);
      const elements = await p.evaluate(() => {
        const vh = innerHeight; const head = [...document.querySelectorAll('*')].find((e) => /^This point$/i.test((e.textContent || '').trim()) && e.children.length === 0); const sheetTop = head ? head.getBoundingClientRect().bottom : 200; const own = (e) => [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
        const all = [...document.querySelectorAll('span, p, div, b')];
        const pick = (label, test) => { const e = all.find((x) => { if (!test(own(x))) return false; const r = x.getBoundingClientRect(); return r.top >= sheetTop + 50 && r.bottom <= vh - 130 && r.width > 0; }); if (!e) return { label, found: false };
          const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
          return { label, found: true, text: own(e).slice(0, 80), color: cs.color, fontSizePx: cs.fontSize, fontWeight: cs.fontWeight, pixelBox: { x: Math.floor(r.x * 2), y: Math.floor(r.y * 2), w: Math.ceil(r.width * 2), h: Math.ceil(r.height * 2) } }; };
        return [
          pick('section label', (t) => /^(Soil|Terrain|Temperature|What could grow here)$/i.test(t)),
          pick('mini-stat value', (t) => /^(Loam|Sandy loam|Clay loam|Sandy clay loam|Clay|Sand|Silt loam|\d+(\.\d+)?°C|\d+ m)$/.test(t)),
          pick('mini-stat label', (t) => /^(Texture|Organic C|Mean|Elevation|Slope)$/.test(t)),
          pick('sand name', (t) => t === 'Sand'), pick('silt name', (t) => t === 'Silt'),
          pick('percentage', (t) => /^\d+%$/.test(t)),
          pick('soil caution title', (t) => /^(Not a reading|Modelled — SoilGrids|Measured|Source not recorded)/i.test(t) && t.length < 40),
          pick('soil caution text', (t) => t.length > 80 && /soil test/i.test(t)),
          pick('month letter', (t) => /^[JFMASOND]$/.test(t)),
          pick('crop catalog note', (t) => /^From our crop catalog/.test(t)),
          pick('crop name', (t) => /^(Maize|Tomatoes|Green beans|Swiss chard|Carrots|Cabbage|Beetroot|Lettuce|Spinach|Onions|Pumpkin|Butternut|Sweetcorn)$/.test(t)),
        ];
      });
      const file = `H-atlas-${id}-${view}.png`; await p.screenshot({ path: `${OUT}/${file}` });
      results.push({ case: `${id}-${view}`, viewport: '390x844 @2x', dark, theme, themeSeen, screenshot: file, capturedUtc: new Date().toISOString(), elements, pageErrors: errs.length });
    }
    await ctx.close();
  }
  await browser.close(); console.log(JSON.stringify({ script: 'h-atlas.cjs', base: L.BASE, results }, null, 1));
})().catch((e) => { console.error('FAIL', e.message.slice(0, 1500)); process.exit(1); });
