// CP-118: the site data panel in a real browser with the app's real dictionary: /farmer?site=<saved place>&panel=Climate,
// phone light and dark, then the Overview tab. The saved place is the sample farm's (a constructed local fixture);
// /api/location-data is the local route with its live provider calls. The map has no token locally.
//   node i3.cjs > ../outputs/I3.txt
const L = require('../../evidence-decisions/scripts/lib.cjs'); const { chromium, log } = L;
const SHOTS = require('path').resolve(__dirname, '../screenshots');
(async () => {
  const browser = await chromium.launch();
  for (const dark of [false, true]) { const mode = dark ? 'dark' : 'light'; log(`\n== /farmer site data panel, phone ${mode}`);
    const ctx = await L.ctxOf(browser, { phone: true, dark }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', (e) => errs.push(e.message.slice(0, 120))); p.on('response', (r) => { if (/location-data/.test(r.url())) log('  location-data', r.status()); });
    await p.goto(L.BASE + '/farmer?site=demo-place-ubhejane&panel=Climate', { waitUntil: 'networkidle', timeout: 300000 }).catch(() => {}); await p.waitForTimeout(5000); await L.settle(p);
    for (let i = 0; i < 20; i++) { if (/Monthly sunshine is not shown|Climate interpretation is unavailable/.test(await p.evaluate(() => document.body.innerText))) break; await p.waitForTimeout(3000); }
    const body = await p.evaluate(() => document.body.innerText);
    const reached = /Monthly sunshine is not shown/.test(body); log('  Climate tab reached:', reached, '| withheld message:', /Climate interpretation is unavailable/.test(body));
    if (!reached) { log('  page shows:', JSON.stringify(body.split('\n').filter(Boolean).slice(0, 20))); await p.screenshot({ path: `${SHOTS}/J-farmer-${mode}-not-reached.png` }); await ctx.close(); continue; }
    const pick = (re) => body.split('\n').filter((l) => re.test(l));
    log('  climate lines:', JSON.stringify(pick(/Good fit|Fair site|Challenging|Wet ·|Dry ·|Most rain falls|storm-water|Rainfall|mm \/ yr/), null, 1));
    for (const [tag, re] of [['rainfall', /Rainfall — mm \/ month/]]) { const t = p.getByText(re).locator('visible=true').first(); await t.scrollIntoViewIfNeeded(); await p.waitForTimeout(700); await p.screenshot({ path: `${SHOTS}/J-farmer-climate-${tag}-phone-${mode}.png` }); }
    log('  overflow:', JSON.stringify(await L.overflow(p)));
    const ov = p.getByRole('button', { name: /^Overview$/ }).locator('visible=true').first();
    if (await ov.count()) { await ov.click().catch(() => {}); await p.waitForTimeout(2500); const o = await p.evaluate(() => document.body.innerText);
      log('  overview lines:', JSON.stringify(o.split('\n').filter((l) => /Good fit|Fair site|Challenging|ainfall|carbon|Lima|General points|Main challenges|year-round|Wet ·|Dry ·|storm-water/.test(l)).slice(0, 16), null, 1));
      await p.screenshot({ path: `${SHOTS}/J-farmer-overview-top-phone-${mode}.png` });
      await p.getByText(/Soil carbon|Soil organic carbon/).locator('visible=true').first().scrollIntoViewIfNeeded().catch(() => {}); await p.waitForTimeout(600); await p.screenshot({ path: `${SHOTS}/J-farmer-overview-insights-phone-${mode}.png` }); }
    log('  page errors:', JSON.stringify(errs)); await ctx.close(); }
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message.slice(0, 900)); process.exit(1); });
