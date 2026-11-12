// CP-117 and the frost caveat: browser and export evidence. Local development server; the "local farm" is the
// published sample farm saved as an ordinary farm in a signed-out browser (a constructed fixture, not grower data).
//   node i.cjs > ../outputs/I.txt
// Part A  what the four Atlas page errors are (message and stack), once.
// Part B  the site data panel on /farmer for the saved place, phone light and dark, with the real dictionary.
// Part C  the crop plan: reference PDF with frost months NOT recorded, then the grower records frost in
//         April, July and December through the real site survey, and the reference PDF again.
const L = require('../../evidence-decisions/scripts/lib.cjs'); const { chromium, log, fs } = L;
const OUT = require('path').resolve(__dirname, '..'); const A = OUT + '/artifacts'; const SHOTS = OUT + '/screenshots';
const [lon, lat, full, name] = [28.05, -26.20, 'Johannesburg, Gauteng, South Africa', 'Johannesburg'];
(async () => {
  const browser = await chromium.launch();
  // ── A
  { log('== A  Atlas page errors'); const ctx = await L.ctxOf(browser, { phone: true }); const p = await ctx.newPage(); const seen = [];
    p.on('pageerror', (e) => seen.push({ kind: 'pageerror', message: e.message, stack: (e.stack || '').split('\n').slice(0, 6).join(' | ') }));
    p.on('console', (m) => { if (m.type() === 'error') seen.push({ kind: 'console.error', message: m.text().slice(0, 400) }); });
    p.on('requestfailed', (r) => seen.push({ kind: 'requestfailed', url: r.url().slice(0, 140), failure: r.failure()?.errorText }));
    await p.route('https://api.mapbox.com/geocoding/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ features: [{ place_name: full, text: name, center: [lon, lat] }] }) }));
    await p.goto(L.BASE + '/atlas', { waitUntil: 'networkidle', timeout: 300000 }).catch(() => {}); await p.waitForTimeout(3000); await L.settle(p);
    log('after load:', seen.length); const atLoad = seen.length;
    await p.getByLabel('Search anywhere on Earth…').fill(name); await p.waitForTimeout(1500); await p.getByText(full).first().click();
    await p.getByText(/mm\/yr/).first().waitFor({ timeout: 120000 }).catch(() => {}); await p.waitForTimeout(2500);
    log('after choosing the place:', seen.length - atLoad, 'more');
    log(JSON.stringify(seen, null, 1));
    log('NEXT_PUBLIC map token present in the page:', await p.evaluate(() => typeof window !== 'undefined' && !!document.querySelector('.mapboxgl-canvas')));
    await ctx.close(); }
  // ── B
  for (const dark of [false, true]) { log(`\n== B  /farmer site data panel, phone ${dark ? 'dark' : 'light'}`);
    const ctx = await L.ctxOf(browser, { phone: true, dark }); const p = await ctx.newPage();
    p.on('response', (r) => { if (/location-data/.test(r.url())) log('  location-data', r.status()); });
    await p.goto(L.BASE + '/farmer?panel=Climate', { waitUntil: 'networkidle', timeout: 300000 }).catch((e) => log('goto', e.message.slice(0, 80))); await p.waitForTimeout(6000); await L.settle(p); await p.waitForTimeout(4000);
    const body = await p.evaluate(() => document.body.innerText);
    const found = /Monthly sunshine is not shown/.test(body);
    log('  panel Climate tab reached:', found, '| url:', p.url().replace(L.BASE, ''));
    if (!found) { log('  first lines of the page:', JSON.stringify(body.split('\n').filter(Boolean).slice(0, 14))); await p.screenshot({ path: `${SHOTS}/I-farmer-${dark ? 'dark' : 'light'}-not-reached.png` }); await ctx.close(); continue; }
    log('  lines:', JSON.stringify(body.split('\n').filter((l) => /sunshine|wind|Wind|climate type|Climate zone|record low|Record low|December|June|No crops/.test(l)).slice(0, 24), null, 1));
    for (const [tag, re] of [['class', /No crops are suggested/], ['sun-wind', /Monthly wind is not shown/]]) { const t = p.getByText(re).first(); await t.scrollIntoViewIfNeeded(); await p.waitForTimeout(600); await p.screenshot({ path: `${SHOTS}/I-farmer-climate-${tag}-phone-${dark ? 'dark' : 'light'}.png` }); }
    log('  overflow:', JSON.stringify(await L.overflow(p))); await ctx.close(); }
  // ── C
  { log('\n== C  crop plan, frost caveat'); const ctx = await L.ctxOf(browser, { phone: false }); const p = await ctx.newPage(); const errs = []; L.watch(p, 'C', errs);
    await L.gotoCrops(p);
    for (let i = 0; i < 40; i++) { if (await p.locator('header span', { hasText: 'satellite records for this site' }).count()) break; await p.waitForTimeout(3000); }
    log('header chip:', JSON.stringify(await p.locator('header span', { hasText: /satellite records|fallback|chosen by you/ }).allInnerTexts()));
    const dlg = await L.openAuto(p); await dlg.getByRole('button', { name: 'Suggest a plan', exact: true }).first().click({ timeout: 30000 });
    const add = p.getByRole('button', { name: /^Add \d+ plantings? to my plan/ }).first(); await add.waitFor({ state: 'visible', timeout: 120000 });
    await add.click({ timeout: 15000 }).catch(async () => { await add.evaluate((el) => el.click()); }); await p.waitForTimeout(5000); await p.keyboard.press('Escape').catch(() => {}); await p.waitForTimeout(1500);
    const take = async (re, file) => { const btn = p.getByRole('button', { name: re }).first(); if (!(await btn.count())) { log('  not offered:', String(re)); return; }
      await btn.scrollIntoViewIfNeeded(); const wait = p.waitForEvent('download', { timeout: 180000 }).catch(() => null); await btn.click(); const d = await wait; if (!d) { log('  no download'); return; }
      await d.saveAs(file); log(`  saved ${file.split('/').pop()} (${fs.statSync(file).size} bytes)`); await p.waitForTimeout(1500); };
    const guide = async (tag) => { const lines = await p.evaluate(() => document.body.innerText.split('\n').filter((l) => /Frost on this farm|Local frost observations|Frost has been observed|no observed frost|Frost-tender crops: frost months|Planned picking can extend|no frost dates|Planned crops to check for frost|will hold ground in months when frost/.test(l))); log(`  guide (${tag}):`, JSON.stringify(lines, null, 1)); };
    await guide('frost not recorded'); await take(/^Detailed reference PDF/, `${A}/reference-frost-not-recorded.pdf`);
    // The grower records frost through the real survey.
    await p.getByRole('button', { name: /site survey/i }).first().click(); await p.waitForTimeout(1500);
    const q = p.getByText('Have you seen frost in this growing area?').first(); log('  survey frost question present:', await q.count());
    if (await q.count()) { await q.scrollIntoViewIfNeeded();
      await p.getByText('Yes, we have seen frost here').first().click(); await p.waitForTimeout(500);
      for (const m of ['April', 'July', 'December']) { const b = p.getByRole('button', { name: new RegExp('^' + m.slice(0, 3)) }).first(); if (await b.count()) { await b.scrollIntoViewIfNeeded(); await b.click(); } else log('  month button not found:', m); }
      await p.waitForTimeout(500); await p.screenshot({ path: `${SHOTS}/I-survey-frost-months.png` });
      const save = p.getByRole('button', { name: /^(Save|Save survey|Save and close|Done)/i }).last(); log('  save button:', await save.innerText().catch(() => 'none')); await save.click().catch((e) => log('  save click failed', e.message.slice(0, 80))); await p.waitForTimeout(2500); }
    await guide('frost recorded: April, July, December');
    const notice = p.getByText('Planned crops to check for frost').first(); if (await notice.count()) { await notice.scrollIntoViewIfNeeded(); await p.waitForTimeout(500); await p.screenshot({ path: `${SHOTS}/I-plan-recorded-frost-desktop.png` }); }
    await take(/^Detailed reference PDF/, `${A}/reference-frost-recorded-apr-jul-dec.pdf`);
    log('  page errors other than the map token:', JSON.stringify(errs.filter((e) => !/Mapbox|LngLat/.test(e)))); await ctx.close(); }
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message.slice(0, 1500)); process.exit(1); });
