// Page measurements for docs/audits/2026-11-10/crop-plan-reaudit-claude.md.
//
//   BASE_URL=http://localhost:4242 OUT=./measurements PLAYWRIGHT_MODULE=playwright \
//   node measure-page.cjs <name> <width> <height> <light|dark> <simple|full> <en|zu> [expand|no] [gate|confirm] [textscale] [dpr]
//
// Run it from inside the repository so `pngjs` resolves from node_modules. It opens the public
// sample farm (a sessionStorage flag; nothing private), confirms South Africa on the country hold
// unless told `gate`, and writes ONE complete JSON file: nothing is truncated or post-processed.
//
// What each figure is, and is not:
//  - servedBuild is read from /api/build-info. siteClimate records the HTTP status of the sample's
//    /api/location-data call and whether the fruit reference bars drew; the local data lane allows
//    20 such calls an hour, after which views lose those bars (4 controls, 13 small text runs).
//  - contrast.declared is computed from declared styles, composited through every ancestor's alpha
//    background, gradient stops and opacity. It cannot see a SIBLING painted under the text (the
//    gold harvest cap on a crop bar is one), so each failing run also gets contrast.pixel: the
//    label box is screenshotted and its dominant background colours are read from real pixels.
//    Where the two disagree, the pixel figure is the one to trust; declared ratios are estimates.
//  - targetsUnder24 follows WCAG 2.2 SC 2.5.8 (24 CSS px, with the inline, user-agent and spacing
//    exceptions). targets24to44 is this repository's own 44px rule, not a WCAG failure.
//  - textUnder12px is a readability flag against the repository's 12px farmer floor, not WCAG.
//  - textCorpus is every rendered text run, deduplicated with counts, so totals can be recomputed
//    and compare-language.mjs can be re-run.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { PNG } = require(process.env.PNGJS_MODULE || 'pngjs');
const fs = require('fs');
const BASE = process.env.BASE_URL || 'http://localhost:4242';
const OUT = process.env.OUT || './measurements';
fs.mkdirSync(OUT, { recursive: true });
const [name, W, H, mode, level, lang, expand = 'no', gate = 'confirm', textscale = '1', dpr = '1'] = process.argv.slice(2);

const COLLECT = () => {
  const rendered = (el) => { if (el.checkVisibility && !el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true })) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const parse = (c) => { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[, /]+/).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined || Number.isNaN(p[3]) ? 1 : p[3] }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  const mix = (x, y, o) => ({ r: o * x.r + (1 - o) * y.r, g: o * x.g + (1 - o) * y.g, b: o * x.b + (1 - o) * y.b, a: 1 });
  const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  const ratioOf = (a, b) => { const L1 = lum(a), L2 = lum(b); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); };
  const paint = (el) => {
    const chain = []; for (let n = el; n && n.nodeType === 1; n = n.parentElement) chain.unshift(n);
    const stops = (cs) => { if (!cs.backgroundImage || cs.backgroundImage === 'none') return []; return [...cs.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map((m) => parse(m[0])).filter(Boolean); };
    const walk = (k, backdrops) => {
      const node = chain[k]; const cs = getComputedStyle(node); const o = parseFloat(cs.opacity); const bgc = parse(cs.backgroundColor); const g = stops(cs);
      let out = [];
      for (const B of backdrops) {
        let own = bgc && bgc.a > 0 ? [over(bgc, B)] : [B];
        if (g.length) own = g.map((s) => over(s, own[0]));
        let res;
        if (k === chain.length - 1) { const fgc = parse(cs.color) || { r: 0, g: 0, b: 0, a: 1 }; res = own.map((bg) => ({ bg, fg: over(fgc, bg) })); }
        else res = walk(k + 1, own);
        out = out.concat(res.map((p) => ({ bg: mix(p.bg, B, o), fg: mix(p.fg, B, o) })));
      }
      return out.slice(0, 12);
    };
    const cands = walk(0, [{ r: 255, g: 255, b: 255, a: 1 }]);
    let worst = null; for (const c of cands) { const r = ratioOf(c.fg, c.bg); if (!worst || r < worst.ratio) worst = { ratio: r, fg: hex(c.fg), bg: hex(c.bg) }; }
    let op = 1; for (const n of chain) op *= parseFloat(getComputedStyle(n).opacity);
    return { ...worst, opacity: +op.toFixed(2), backgroundVariants: cands.length };
  };
  const path = (el) => { const parts = []; let n = el; for (let i = 0; i < 4 && n && n.nodeType === 1; i++, n = n.parentElement) { let s = n.tagName.toLowerCase(); const d = [...n.attributes].filter((a) => a.name.startsWith('data-') && !a.name.startsWith('data-audit')).map((a) => `[${a.name}${a.value ? '="' + a.value.slice(0, 24) + '"' : ''}]`).join(''); if (n.getAttribute('aria-label')) s += `[aria-label="${n.getAttribute('aria-label').slice(0, 30)}"]`; s += d; const cls = typeof n.className === 'string' ? n.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : ''; if (cls) s += '.' + cls; parts.unshift(s); } return parts.join(' > '); };
  const contrast = [], small = [], clipped = [], texts = []; let auditId = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let node;
  while ((node = walker.nextNode())) {
    const t = node.textContent.replace(/\s+/g, ' ').trim(); if (!t) continue;
    const el = node.parentElement; if (!el || !rendered(el) || el.closest('script,style,noscript')) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden') continue;
    texts.push(t);
    if (el.closest('[aria-hidden="true"]')) continue;
    const fs = parseFloat(cs.fontSize); const fw = parseInt(cs.fontWeight) || 400; const r = el.getBoundingClientRect();
    const large = fs >= 24 || (fs >= 18.66 && fw >= 700);
    const p = paint(el);
    if (p.ratio < (large ? 3 : 4.5)) { let id = el.getAttribute('data-audit-contrast'); if (!id) { id = String(++auditId); el.setAttribute('data-audit-contrast', id); }   // one tag per element: a label can hold two text nodes
      contrast.push({ id, text: t.slice(0, 80), declared: { ratio: +p.ratio.toFixed(2), text: p.fg, background: p.bg, opacityChain: p.opacity, backgroundVariants: p.backgroundVariants }, required: large ? 3 : 4.5, fontPx: fs, weight: fw, boxPx: `${Math.round(r.width)}x${Math.round(r.height)}`, selector: path(el), disabled: !!el.closest('[disabled],[aria-disabled="true"]') }); }
    if (fs < 11.95) small.push({ text: t.slice(0, 80), fontPx: fs, selector: path(el) });
    if ((cs.overflow === 'hidden' || cs.overflowX === 'hidden' || cs.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 1 && r.width > 8) clipped.push({ text: t.slice(0, 80), shownPx: Math.round(el.clientWidth), neededPx: el.scrollWidth, selector: path(el) });
  }
  const controls = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=switch], [role=checkbox], [tabindex="0"]')].filter(rendered).filter((el) => getComputedStyle(el).visibility !== 'hidden');
  const rects = controls.map((el) => el.getBoundingClientRect());
  const targetsUnder24 = [], targets24to44 = [], unnamed = [];
  controls.forEach((el, i) => {
    const r = rects[i]; const cs = getComputedStyle(el);
    const label = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || el.value || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 60);
    const inline = (el.tagName === 'A' && cs.display.startsWith('inline') && el.parentElement && (el.parentElement.innerText || '').trim().length > (el.innerText || '').trim().length + 8);
    const native = (el.tagName === 'INPUT' && ['checkbox', 'radio'].includes(el.type) && cs.appearance !== 'none');
    const w = Math.round(r.width), h = Math.round(r.height);
    if (w < 24 || h < 24) {
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2; let clash = null;
      controls.forEach((o, j) => { if (j === i || clash) return; if (el.contains(o) || o.contains(el)) return; const q = rects[j]; const qx = q.left + q.width / 2, qy = q.top + q.height / 2; const smallOther = q.width < 24 || q.height < 24; const dx = Math.max(q.left - cx, 0, cx - q.right), dy = Math.max(q.top - cy, 0, cy - q.bottom); if (Math.hypot(dx, dy) < 12 || (smallOther && Math.hypot(qx - cx, qy - cy) < 24)) clash = (o.innerText || o.getAttribute('aria-label') || o.tagName).replace(/\s+/g, ' ').trim().slice(0, 40); });
      targetsUnder24.push({ label, widthPx: w, heightPx: h, tag: el.tagName.toLowerCase(), exception: inline ? 'inline' : native ? 'user-agent control' : !clash ? 'spacing' : null, clashesWith: clash, selector: path(el) });
    } else if ((w < 44 || h < 44) && !inline) targets24to44.push({ label, widthPx: w, heightPx: h, tag: el.tagName.toLowerCase(), selector: path(el) });
    let nm = (el.innerText || '').trim() || el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('alt') || el.getAttribute('placeholder');
    if (!nm && el.getAttribute('aria-labelledby')) nm = el.getAttribute('aria-labelledby').split(/\s+/).map((id) => document.getElementById(id)?.innerText || '').join(' ').trim();
    if (!nm && el.id) nm = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.innerText;
    if (!nm) nm = el.closest('label')?.innerText;
    if (!nm && el.querySelector('img[alt]:not([alt=""]), svg[aria-label], svg title')) nm = 'img';
    if (!nm || !String(nm).trim()) unnamed.push({ tag: el.tagName.toLowerCase(), type: el.getAttribute('type'), widthPx: Math.round(r.width), heightPx: Math.round(r.height), selector: path(el) });
  });
  const de = document.documentElement;
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(rendered).map((h) => h.tagName + ' ' + h.innerText.replace(/\s+/g, ' ').slice(0, 80));
  const cal = document.querySelector('[data-crop-bed-scroll]');
  let layout = null;
  if (cal) { let sc = cal.parentElement; while (sc && !(getComputedStyle(sc).overflowY === 'auto' && sc.scrollHeight > sc.clientHeight + 50)) sc = sc.parentElement; if (sc) { const sr = sc.getBoundingClientRect(); const hdr = document.querySelector('header'); layout = { scrollAreaTopPx: Math.round(sr.top), scrollAreaHeightPx: Math.round(sr.height), windowHeightPx: innerHeight, scrollAreaShare: +(sr.height / innerHeight).toFixed(2), calendarTopInScrollPx: Math.round(cal.getBoundingClientRect().top - sr.top + sc.scrollTop), pageScrollHeightPx: sc.scrollHeight, headerScrollWidthPx: hdr ? hdr.scrollWidth : null, headerClientWidthPx: hdr ? hdr.clientWidth : null }; } }
  return { contrast, small, clipped, targetsUnder24, targets24to44, unnamed, headings, h1Rendered: [...document.querySelectorAll('h1')].filter(rendered).map((h) => h.innerText.slice(0, 80)), docOverflowX: de.scrollWidth > de.clientWidth + 1, controls: controls.length, texts, layout, fruitReferenceBarsShown: texts.some((t) => /·\s*reference/.test(t)), plannerShown: !!cal };
};

const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const ratio = (a, b) => { const L1 = lum(a), L2 = lum(b); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); };
const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbToHex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: +dpr, colorScheme: mode === 'dark' ? 'dark' : 'light' });
  await ctx.addInitScript(([m, l, ts]) => { try { sessionStorage.setItem('imbewu_sample_mode', '1'); if (l !== 'en') sessionStorage.setItem('imbewu_sample_lang', l); localStorage.setItem('fp-mode', m); localStorage.setItem('fp-theme', 'earth'); if (ts !== '1') localStorage.setItem('fp-textscale', ts); } catch {} }, [mode, lang, textscale]);
  const p = await ctx.newPage(); const consoleErrors = []; const climateStatuses = [];
  p.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
  p.on('pageerror', (e) => consoleErrors.push('PAGEERROR ' + String(e).slice(0, 300)));
  p.on('response', (r) => { if (r.url().includes('/api/location-data')) climateStatuses.push(r.status()); });
  const servedBuild = await fetch(BASE + '/api/build-info').then((r) => r.json()).then((j) => ({ branch: j.branch ?? null, sha: j.sha ?? null })).catch(() => ({ branch: null, sha: null, note: 'build-info not readable' }));
  await p.goto(BASE + '/facilitator/crops', { waitUntil: 'networkidle', timeout: 240000 }); await p.waitForTimeout(2500);
  await p.evaluate((lv) => { localStorage.setItem('imbewu_app_level_v1', lv); window.dispatchEvent(new CustomEvent('imbewu-app-level-changed')); }, level); await p.waitForTimeout(1200);
  if (gate === 'confirm') {
    const panel = p.locator('section[aria-label="Site country and region"]');
    // The planner asks for the site climate only once the country is confirmed, and a cold server can
    // take several seconds to answer. Wait for that answer, whatever its status, before measuring.
    const climateAnswer = p.waitForResponse((r) => r.url().includes('/api/location-data'), { timeout: 45000 }).catch(() => null);
    if (await panel.count() && !(await p.locator('[data-crop-bed-scroll]').count())) { await panel.locator('select').first().selectOption('ZA'); await panel.getByRole('checkbox').check(); await panel.locator('button[type=submit]').last().click(); await p.locator('[data-crop-bed-scroll]').waitFor({ state: 'attached', timeout: 20000 }); }
    await climateAnswer; await p.waitForTimeout(2000);
  }
  if (expand === 'expand') for (let i = 0; i < 4; i++) { await p.evaluate(() => document.querySelectorAll('details:not([open])').forEach((d) => { d.open = true; })); await p.waitForTimeout(400); }
  const res = await p.evaluate(COLLECT);

  // Pixel cross-check: read the real background behind every failing text run.
  // A node React has since replaced no longer carries its tag; give up on it quickly and say so.
  p.setDefaultTimeout(2500);
  const sampled = new Map();
  for (const item of res.contrast) {
    if (sampled.has(item.id)) { item.pixel = sampled.get(item.id); continue; }
    try {
      const loc = p.locator(`[data-audit-contrast="${item.id}"]`).first();
      await loc.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'center' })); await p.waitForTimeout(60);
      const box = await loc.boundingBox(); const vp = p.viewportSize();
      if (!box || box.width < 2 || box.height < 2) { item.pixel = { note: 'no box' }; continue; }
      const clip = { x: Math.max(0, box.x), y: Math.max(0, box.y), width: Math.min(box.width, vp.width - Math.max(0, box.x)), height: Math.min(box.height, vp.height - Math.max(0, box.y)) };
      if (clip.width < 2 || clip.height < 2) { item.pixel = { note: 'outside the window' }; continue; }
      const png = PNG.sync.read(await p.screenshot({ clip }));
      const counts = new Map();
      for (let i = 0; i < png.data.length; i += 4) { const k = (png.data[i] << 16) | (png.data[i + 1] << 8) | png.data[i + 2]; counts.set(k, (counts.get(k) || 0) + 1); }
      const total = png.width * png.height; const fg = hexToRgb(item.declared.text);
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => ({ rgb: [(k >> 16) & 255, (k >> 8) & 255, k & 255], share: n / total }));
      // Backgrounds = flat colours that fill a real share of the box and are not the glyph colour itself.
      const backgrounds = top.filter((c) => c.share >= 0.08 && Math.max(...c.rgb.map((v, i) => Math.abs(v - fg[i]))) > 24).map((c) => ({ colour: rgbToHex(c.rgb), shareOfBox: +c.share.toFixed(2), ratioAgainstText: +ratio(fg, c.rgb).toFixed(2) }));
      item.pixel = backgrounds.length ? { backgrounds, worstRatio: Math.min(...backgrounds.map((b) => b.ratioAgainstText)), agreesWithDeclared: backgrounds.some((b) => Math.abs(b.ratioAgainstText - item.declared.ratio) < 0.25), crossesTwoFills: backgrounds.length > 1 } : { note: 'no flat background covers 8% of the box' };
    } catch (e) { item.pixel = { note: 'not sampled: ' + String(e.message).split('\n')[0].slice(0, 80) }; }
    sampled.set(item.id, item.pixel);
  }

  const dedupe = (arr, key) => { const m = new Map(); for (const x of arr) { const k = key(x); if (m.has(k)) m.get(k).count++; else m.set(k, { ...x, count: 1 }); } return [...m.values()]; };
  const corpus = new Map(); for (const t of res.texts) corpus.set(t, (corpus.get(t) || 0) + 1);
  const failing = res.contrast.filter((c) => !c.disabled);
  const out = {
    config: { name, viewport: `${W}x${H}`, devicePixelRatio: +dpr, theme: 'earth ' + mode, level, lang, sectionsOpened: expand === 'expand', countryHold: gate === 'confirm' ? 'confirmed as ZA' : 'left unconfirmed', appTextScale: +textscale, url: '/facilitator/crops', site: 'public sample farm', servedBuild,
      siteClimate: { locationDataStatuses: climateStatuses, fruitReferenceBarsShown: res.fruitReferenceBarsShown, plannerShown: res.plannerShown } },
    totals: { controls: res.controls, textRuns: res.texts.length,
      contrastFailures: failing.length, contrastFailuresConfirmedByPixels: failing.filter((c) => c.pixel && c.pixel.worstRatio !== undefined && c.pixel.worstRatio < c.required).length, contrastFailuresNotPixelSampled: failing.filter((c) => !c.pixel || c.pixel.worstRatio === undefined).length, contrastFailuresOnDisabledControls: res.contrast.length - failing.length,
      textUnder12px: res.small.length, targetsUnder24_noException: res.targetsUnder24.filter((t) => !t.exception).length, targetsUnder24_withException: res.targetsUnder24.filter((t) => t.exception).length, targets24to44: res.targets24to44.length, unnamedControls: res.unnamed.length, clippedText: res.clipped.length, h1: res.h1Rendered.length, docOverflowX: res.docOverflowX },
    layout: res.layout,
    contrast: res.contrast.map(({ id, ...rest }) => rest).sort((a, b) => a.declared.ratio - b.declared.ratio),
    textUnder12px: dedupe(res.small, (x) => [x.text, x.fontPx].join('|')),
    targetsUnder24: dedupe(res.targetsUnder24, (x) => [x.label, x.widthPx, x.heightPx].join('|')),
    targets24to44: dedupe(res.targets24to44, (x) => [x.label, x.widthPx, x.heightPx].join('|')),
    unnamedControls: res.unnamed, clippedText: dedupe(res.clipped, (x) => x.text), headings: res.headings, h1Rendered: res.h1Rendered, consoleErrors,
    textCorpus: [...corpus.entries()].map(([text, count]) => ({ text, count })),
  };
  fs.writeFileSync(`${OUT}/${name}.json`, JSON.stringify(out, null, 1));
  console.log(name, JSON.stringify(out.totals), 'climate', JSON.stringify(out.config.siteClimate), 'build', servedBuild.sha);
  await browser.close();
})().catch((e) => { console.error('FAIL', name, e.message.slice(0, 600)); process.exit(1); });
