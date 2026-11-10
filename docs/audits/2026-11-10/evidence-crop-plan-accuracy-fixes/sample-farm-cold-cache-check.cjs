// The public sample farm when its own climate has NOT loaded (cold cache, offline, provider down).
// The climate endpoint is aborted, so the page stays on the labelled regional fallback.
// Usage: OUT=<dir for screenshots> node sample-farm-cold-cache-check.cjs   (dev server on :4242, Playwright installed)
// Sample mode keeps its data in memory and forgets every edit on reload, so the saved-plan path is checked
// on a real local farm instead: saved-plan-path-check.cjs.
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:4242'; const OUT = process.env.OUT;
const log = (...a) => console.log(...a);
async function open(browser, { blockClimate, mode = 'light', level = 'simple', width = 390, height = 844 }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: width < 600 ? 2 : 1, colorScheme: mode, acceptDownloads: true });
  await ctx.addInitScript(([m]) => { try { sessionStorage.setItem('imbewu_sample_mode', '1'); localStorage.setItem('fp-mode', m); } catch {} }, [mode]);
  let climateCalls = 0;
  await ctx.route('**/api/location-data**', (route) => { climateCalls++; return blockClimate ? route.abort() : route.continue(); });
  const p = await ctx.newPage(); p.on('pageerror', (e) => log('PAGEERROR', e.message));
  const enter = async () => {
    await p.goto(BASE + '/facilitator/crops', { waitUntil: 'networkidle', timeout: 240000 }); await p.waitForTimeout(2500);
    await p.evaluate((lv) => { localStorage.setItem('imbewu_app_level_v1', lv); window.dispatchEvent(new CustomEvent('imbewu-app-level-changed')); }, level); await p.waitForTimeout(800);
    const panel = p.locator('section[aria-label="Site country and region"]');
    if (await panel.count() && await panel.locator('button[type=submit]').count()) {
      const answer = blockClimate ? null : p.waitForResponse((r) => r.url().includes('/api/location-data'), { timeout: 90000 }).catch(() => null);
      await panel.locator('select').first().selectOption('ZA').catch(() => {}); await panel.getByRole('checkbox').check().catch(() => {}); await panel.locator('button[type=submit]').last().click().catch(() => {});
      await answer;
    }
    await p.locator('[data-crop-bed-scroll]').waitFor({ state: 'attached', timeout: 60000 }); await p.waitForTimeout(3500);
  };
  await enter();
  const dismiss = async () => { const t = p.getByText('Update ready').first(); if (await t.count()) { await t.locator('xpath=ancestor::*[.//button][1]').locator('button').last().click().catch(() => {}); await p.waitForTimeout(300); } };
  const notice = p.locator('section[aria-label="Sowings outside the sowing calendar"]');
  const openModal = async () => { const b = p.getByRole('button', { name: /Auto-suggest a plan/i }).first(); await b.scrollIntoViewIfNeeded(); await b.click(); await p.waitForTimeout(1000); return p.locator('[role=dialog]').last(); };
  const modalState = async () => { const dlg = await openModal(); const sel = dlg.getByLabel('Sowing calendar for this site');
    const out = { heading: await dlg.getByText(/Climate used automatically|Sowing calendar you chose/).first().innerText(), value: await sel.inputValue(), auto: (await sel.locator('option').first().innerText()),
      foot: await dlg.getByText(/Derived from satellite climate records|Per-site climate is not available|You chose this calendar\. Choose|No mapped location is attached/).first().innerText().catch(() => null) };
    await p.keyboard.press('Escape'); await p.waitForTimeout(600); return out; };
  const choose = async (v) => { const dlg = await openModal(); await dlg.getByLabel('Sowing calendar for this site').selectOption(v); await p.waitForTimeout(900); await p.keyboard.press('Escape'); await p.waitForTimeout(900); };
  const stored = () => p.evaluate(() => { const out = {}; for (const store of [localStorage, sessionStorage]) for (let i = 0; i < store.length; i++) { const k = store.key(i); const v = store.getItem(k) || ''; if (v.includes('sowingCalendarChoices')) { try { const j = JSON.parse(v); const find = (o) => { if (!o || typeof o !== 'object') return null; if (o.sowingCalendarChoices) return o.sowingCalendarChoices; for (const x of Object.values(o)) { const r = find(x); if (r) return r; } return null; }; out[(store === localStorage ? 'local:' : 'session:') + k] = find(j); } catch { out[k] = 'unparsed'; } } } out.hidden = localStorage.getItem('imbewu_sowing_calendar_notice_hidden_v1'); return out; });
  return { ctx, p, enter, dismiss, notice, modalState, choose, stored, calls: () => climateCalls };
}
(async () => {
  const browser = await chromium.launch();
  // ---------- A. cold cache: the climate API never answers ----------
  for (const mode of ['light', 'dark']) {
    const s = await open(browser, { blockClimate: true, mode });
    log(`\n[A cold ${mode}] climate requests attempted: ${s.calls()} (all aborted)`);
    log(`[A cold ${mode}] out-of-season list on first open:`, await s.notice.count());
    log(`[A cold ${mode}] modal:`, JSON.stringify(await s.modalState()));
    if (mode === 'light') {
      await s.choose('summer');
      log('[A cold] after the visitor chooses the hard-frost calendar, list rows:', await s.notice.count() ? (await s.notice.locator('li').allInnerTexts()) : 0);
      await s.choose('');
      log('[A cold] back on "Let the app decide", list:', await s.notice.count());
    }
    await s.p.evaluate(() => window.scrollTo(0, 0)); await s.dismiss(); await s.p.screenshot({ path: `${OUT}/cold-sample-farm-phone-${mode}.png` });
    await s.ctx.close();
  }
  { const s = await open(browser, { blockClimate: true, level: 'all', width: 1280, height: 900 });
    log('\n[A cold desktop] header chip:', await s.p.locator('header span', { hasText: /chosen by you|satellite records|nearest reference|No site set/ }).first().innerText().catch(() => null));
    log('[A cold desktop] list:', await s.notice.count());
    await s.p.evaluate(() => window.scrollTo(0, 0)); await s.dismiss(); await s.p.screenshot({ path: `${OUT}/cold-sample-farm-desktop.png` });
    await s.ctx.close(); }
  await browser.close();
})().catch((e) => { console.error('FAIL', e.message.slice(0, 1200)); process.exit(1); });
