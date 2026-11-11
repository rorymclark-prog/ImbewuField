const L = require('./lib.cjs'); const { chromium, log, D } = L; const errs = [];
const PTS = { Durban: [31.03, -29.86, 'Durban, KwaZulu-Natal, South Africa'], Johannesburg: [28.05, -26.20, 'Johannesburg, Gauteng, South Africa'] };
(async () => {
  const browser = await chromium.launch();
  for (const [name, [lon, lat, full]] of Object.entries(PTS)) {
    log('\n== C ' + name);
    const ctx = await L.ctxOf(browser); const p = await ctx.newPage(); L.watch(p, 'C' + name, errs);
    // The Mapbox geocoder needs a token and internet; stand in for ONLY that request. /api/location-data is the real local route.
    await p.route('https://api.mapbox.com/geocoding/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ features: [{ place_name: full, text: name, center: [lon, lat] }] }) }));
    p.on('response', (r) => { if (/location-data/.test(r.url())) log('  location-data', r.status()); });
    await p.goto(L.BASE + '/atlas', { waitUntil: 'networkidle', timeout: 300000 }).catch((e) => log('goto', e.message.slice(0, 100))); await p.waitForTimeout(3000);
    await L.settle(p);
    log('map-unsupported message present:', await p.getByText('The map cannot open on this device').count(), ' canvas:', await p.locator('canvas').count());
    const input = p.getByLabel('Search anywhere on Earth…'); await input.fill(name); await p.waitForTimeout(1500);
    const sug = p.getByText(full).first(); log('suggestion shown:', await sug.count());
    await sug.click(); 
    await p.getByText(/Sowing calendar:/).first().waitFor({ timeout: 90000 }).catch(() => log('  chip not found'));
    await p.waitForTimeout(2000);
    const info = await p.evaluate(() => {
      const el = [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && /Sowing calendar:/.test(e.textContent || ''))[0];
      if (!el) return null; const chain = []; let n = el;
      for (let i = 0; i < 6 && n; i++, n = n.parentElement) { const r = n.getBoundingClientRect(); chain.push({ tag: n.tagName, cls: (n.className || '').toString().slice(0, 40), right: Math.round(r.right), left: Math.round(r.left), sw: n.scrollWidth, cw: n.clientWidth }); }
      const body = document.body.innerText; const m = body.match(/[^\n]*calendar[^\n]*/gi);
      return { chipText: el.textContent.trim(), chain, calendarLines: m, grow: (body.match(/[^\n]*sowing calendar[^\n]*could[^\n]*|[^\n]*under the[^\n]*sowing calendar[^\n]*/gi)), old: (body.match(/Summer rainfall|Hot, no frost/gi)) };
    });
    log(JSON.stringify(info, null, 1)); log('overflow', JSON.stringify(await L.overflow(p)));
    await p.screenshot({ path: `${D}/C-atlas-${name.toLowerCase()}-phone-light.png` });
    await ctx.close();
  }
  log('\nERRORS', JSON.stringify(errs, null, 1)); await browser.close();
})().catch((e) => { console.error('FAIL', e.message.slice(0, 1500)); process.exit(1); });
