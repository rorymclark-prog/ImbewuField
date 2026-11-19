const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const BASE = 'http://localhost:4242';
const D = '/home/user/ImbewuField/docs/audits/2026-11-11/evidence-decisions';
const seeds = JSON.parse(fs.readFileSync('/tmp/claude-0/-home-user-ImbewuField/2be8d799-3284-582a-9f0f-ca80f2cba675/scratchpad/review/seeds.json', 'utf8'));
const log = (...a) => console.log(...a);
async function ctxOf(browser, { dark = false, phone = true, sample = false, seed = true, plan = false, acceptDownloads = true } = {}) {
  const ctx = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 800 }, deviceScaleFactor: phone ? 2 : 1, acceptDownloads });
  await ctx.addInitScript(([design, places, plan, dark, sample, seed]) => { try {
    if (sample) sessionStorage.setItem('imbewu_sample_mode', '1');
    if (!localStorage.getItem('__seeded')) {
      if (seed) { localStorage.setItem('imbewu_facilitator_design_v1', design); localStorage.setItem('permamap_saved_places', places); if (plan) localStorage.setItem('imbewu_crop_plan_v1', plan); }
      localStorage.setItem('permamap_onboarded', '1'); localStorage.setItem('imbewu_map_tips_seen', '1'); localStorage.setItem('imbewu_app_level_v1', 'full'); localStorage.setItem('fp-mode', dark ? 'dark' : 'light');
      localStorage.setItem('__seeded', '1');
    } } catch {} }, [seeds.design, seeds.places, plan ? seeds.plan : null, dark, sample, seed]);
  return ctx;
}
function watch(p, tag, errs) {
  p.on('pageerror', (e) => { errs.push('PAGEERROR ' + e.message); log(tag, 'PAGEERROR', e.message); });
  p.on('console', (m) => { if (m.type() === 'error') { errs.push('CONSOLE ' + m.text().slice(0, 300)); log(tag, 'CONSOLE.error', m.text().slice(0, 300)); } });
}
async function settle(p, ready) {
  const agree = p.getByRole('button', { name: 'I agree, continue' }); if (await agree.count()) { await agree.click(); await p.waitForTimeout(1500); }
  const goal = p.getByText('Feed my family').first(); if (await goal.count()) { await goal.click(); await p.waitForTimeout(400); await p.getByRole('button', { name: 'Get started' }).click().catch(() => {}); await p.waitForTimeout(1500); }
  const panel = p.locator('section[aria-label="Site country and region"]');
  if (await panel.count() && await panel.locator('button[type=submit]').count()) {
    log('  country panel present -> choosing ZA');
    await panel.locator('select').first().selectOption('ZA').catch(() => {}); await panel.getByRole('checkbox').check().catch(() => {}); await panel.locator('button[type=submit]').last().click().catch(() => {});
  }
  if (ready) await ready();
}
async function gotoCrops(p) {
  await p.goto(BASE + '/facilitator/crops', { waitUntil: 'networkidle', timeout: 300000 }); await p.waitForTimeout(4000);
  await settle(p, async () => { await p.locator('[data-crop-bed-scroll]').waitFor({ state: 'attached', timeout: 90000 }); });
}
const overflow = (p) => p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, over: document.documentElement.scrollWidth > innerWidth }));
const openAuto = async (p) => { const b = p.getByRole('button', { name: /Auto-suggest a plan/i }).first(); await b.scrollIntoViewIfNeeded(); await b.click(); await p.waitForTimeout(800); return p.locator('[role=dialog]').last(); };
module.exports = { chromium, fs, BASE, D, seeds, log, ctxOf, watch, settle, gotoCrops, overflow, openAuto };
