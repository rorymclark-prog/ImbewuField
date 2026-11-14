// Open a seeded saved report and read the rainfall chart's source line. Phone light/dark, desktop light.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const [,, locationFile, shots] = process.argv;
const location = JSON.parse(fs.readFileSync(locationFile, 'utf8'));
const report = { id: 'rain-source-check', name: 'Rain source check', savedAt: '2026-11-14T08:00:00.000Z', lang: 'en',
  report: '# Site report\n\nConstructed fixture for the rainfall source line; not grower data.', location, origin: 'generated' };
(async () => {
  const browser = await chromium.launch();
  for (const [tag, phone, dark] of [['phone-light', true, false], ['phone-dark', true, true], ['desktop-light', false, false]]) {
    const ctx = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 900 }, deviceScaleFactor: 2 });
    await ctx.addInitScript(([r, dark]) => { try { if (!localStorage.getItem('__seeded')) {
      localStorage.setItem('imbewu_saved_reports', JSON.stringify([r])); localStorage.setItem('permamap_onboarded', '1');
      localStorage.setItem('imbewu_app_level_v1', 'full'); localStorage.setItem('fp-mode', dark ? 'dark' : 'light'); localStorage.setItem('__seeded', '1'); } } catch {} }, [report, dark]);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 160)));
    await p.goto('http://localhost:4242/reports', { waitUntil: 'networkidle', timeout: 300000 }).catch(() => {}); await p.waitForTimeout(3000);
    const agree = p.getByRole('button', { name: 'I agree, continue' }); if (await agree.count()) { await agree.click(); await p.waitForTimeout(1500); }
    const goal = p.getByText('Feed my family').first(); if (await goal.count()) { await goal.click(); await p.waitForTimeout(400); await p.getByRole('button', { name: 'Get started' }).click().catch(() => {}); await p.waitForTimeout(1500); }
    await p.getByRole('button', { name: /^Saved reports · 1$/ }).first().click().catch(() => {}); await p.waitForTimeout(1500);
    const btn = p.getByRole('button', { name: /^Rain source check · / }).first();
    console.log('  report buttons:', await btn.count()); if (await btn.count()) await btn.click();
    let line = null;
    for (let i = 0; i < 30 && !line; i++) { await p.waitForTimeout(2000); line = await p.evaluate(() => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { if (/Open-Meteo: ERA5-Land/.test(n.textContent) || /ERA5-Land via Open-Meteo/.test(n.textContent)) return n.parentElement.innerText; } return null; }); }
    console.log(`== ${tag}`); console.log('  source text:', JSON.stringify(line));
    if (line) { const el = p.getByText(/Open-Meteo: ERA5-Land|ERA5-Land via Open-Meteo/).first(); await el.scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, -260)); await p.waitForTimeout(800);
      const box = await el.boundingBox(); console.log('  source box:', JSON.stringify(box)); }
    else console.log('  page:', JSON.stringify((await p.evaluate(() => document.body.innerText)).split('\n').filter(Boolean).slice(0, 25)));
    console.log('  overflow:', JSON.stringify(await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }))));
    await p.screenshot({ path: `${shots}/report-rain-source-${tag}.png` });
    console.log('  page errors:', JSON.stringify(errs)); await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('FAIL', e.message.slice(0, 600)); process.exit(1); });
