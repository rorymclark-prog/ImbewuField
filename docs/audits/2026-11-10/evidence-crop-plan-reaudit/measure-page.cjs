// Crop plan measurements for docs/audits/2026-11-10/crop-plan-reaudit-claude.md.
// Needs a running dev server and Playwright with Chromium. It opens the public sample farm
// (sessionStorage flag, nothing private), confirms South Africa on the country hold unless
// told to keep it, and writes one JSON file per view.
//   BASE_URL=http://localhost:4242 OUT=./measurements PLAYWRIGHT_MODULE=playwright \
//   node measure-page.cjs <name> <width> <height> <light|dark> <simple|full> <en|zu> [expand|no] [gate|confirm] [textscale]
// Contrast is composited through alpha backgrounds, gradients and ancestor opacity. Target size
// follows WCAG 2.2 SC 2.5.8 (24px, with the inline, user-agent and spacing exceptions); 24–44px
// is reported separately as the repo's own rule. Text under 12px is a readability flag only.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const BASE = process.env.BASE_URL || 'http://localhost:4242';
const OUT = process.env.OUT || './measurements';
fs.mkdirSync(OUT, { recursive: true });
const [name, W, H, mode, level, lang, expand = 'no', gate = 'confirm', textscale = '1'] = process.argv.slice(2);
const COLLECT = () => {
  const rendered = (el) => { if (el.checkVisibility && !el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true })) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const parse = (c) => { const m = c && c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[, /]+/).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined || Number.isNaN(p[3]) ? 1 : p[3] }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  const mix = (x, y, o) => ({ r: o * x.r + (1 - o) * y.r, g: o * x.g + (1 - o) * y.g, b: o * x.b + (1 - o) * y.b, a: 1 });
  const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  const ratioOf = (a, b) => { const L1 = lum(a), L2 = lum(b); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); };
  // Composite the element's text and background through every ancestor's alpha background AND opacity.
  const paint = (el) => {
    const chain = []; for (let n = el; n && n.nodeType === 1; n = n.parentElement) chain.unshift(n);
    const stops = (cs) => { if (!cs.backgroundImage || cs.backgroundImage === 'none') return []; return [...cs.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map((m) => parse(m[0])).filter(Boolean); };
    // returns list of candidate {bg, fg} (several when a gradient offers more than one backdrop)
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
    return { ...worst, opacity: +op.toFixed(2), variants: cands.length };
  };
  const path = (el) => { const parts = []; let n = el; for (let i = 0; i < 4 && n && n.nodeType === 1; i++, n = n.parentElement) { let s = n.tagName.toLowerCase(); const d = [...n.attributes].filter((a) => a.name.startsWith('data-') && a.name !== 'data-audit-scroller').map((a) => `[${a.name}${a.value ? '="' + a.value.slice(0, 24) + '"' : ''}]`).join(''); if (n.getAttribute('aria-label')) s += `[aria-label="${n.getAttribute('aria-label').slice(0, 30)}"]`; s += d; const cls = typeof n.className === 'string' ? n.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') : ''; if (cls) s += '.' + cls; parts.unshift(s); } return parts.join(' > '); };
  const contrast = [], small = [], clipped = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let node;
  while ((node = walker.nextNode())) {
    const t = node.textContent.replace(/\s+/g, ' ').trim(); if (!t) continue;
    const el = node.parentElement; if (!el || !rendered(el) || el.closest('[aria-hidden="true"],script,style,noscript')) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden') continue;
    const fs = parseFloat(cs.fontSize); const fw = parseInt(cs.fontWeight) || 400; const r = el.getBoundingClientRect();
    const large = fs >= 24 || (fs >= 18.66 && fw >= 700);
    const p = paint(el);
    if (p.ratio < (large ? 3 : 4.5)) contrast.push({ text: t.slice(0, 60), ratio: +p.ratio.toFixed(2), need: large ? 3 : 4.5, fg: p.fg, bg: p.bg, opacity: p.opacity, fontPx: fs, weight: fw, sel: path(el), disabled: !!el.closest('[disabled],[aria-disabled="true"]') });
    if (fs < 11.95) small.push({ text: t.slice(0, 60), fontPx: fs, sel: path(el) });
    if ((cs.overflow === 'hidden' || cs.overflowX === 'hidden' || cs.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 1 && r.width > 8) clipped.push({ text: t.slice(0, 70), shownPx: Math.round(el.clientWidth), neededPx: el.scrollWidth, sel: path(el) });
  }
  const controls = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=switch], [role=checkbox], [tabindex="0"]')].filter(rendered).filter((el) => getComputedStyle(el).visibility !== 'hidden');
  const rects = controls.map((el) => el.getBoundingClientRect());
  const targetsAA = [], targetsHouse = [], unnamed = [];
  controls.forEach((el, i) => {
    const r = rects[i]; const cs = getComputedStyle(el);
    const label = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || el.value || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 50);
    const inline = (el.tagName === 'A' && cs.display.startsWith('inline') && el.parentElement && (el.parentElement.innerText || '').trim().length > (el.innerText || '').trim().length + 8);
    const native = (el.tagName === 'INPUT' && ['checkbox', 'radio'].includes(el.type) && cs.appearance !== 'none');
    const w = Math.round(r.width), h = Math.round(r.height);
    if (w < 24 || h < 24) {
      // WCAG 2.2 SC 2.5.8 spacing exception: a 24px circle centred on the target must not intersect another target or its circle.
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2; let clash = null;
      controls.forEach((o, j) => { if (j === i || clash) return; if (el.contains(o) || o.contains(el)) return; const q = rects[j]; const qx = q.left + q.width / 2, qy = q.top + q.height / 2; const smallOther = q.width < 24 || q.height < 24; const dx = Math.max(q.left - cx, 0, cx - q.right), dy = Math.max(q.top - cy, 0, cy - q.bottom); const distRect = Math.hypot(dx, dy); const distCentre = Math.hypot(qx - cx, qy - cy); if (distRect < 12 || (smallOther && distCentre < 24)) clash = (o.innerText || o.getAttribute('aria-label') || o.tagName).replace(/\s+/g, ' ').trim().slice(0, 30); });
      const exception = inline ? 'inline' : native ? 'user-agent control' : !clash ? 'spacing' : null;
      targetsAA.push({ label, w, h, tag: el.tagName.toLowerCase(), exception, clashesWith: clash, sel: path(el) });
    } else if ((w < 44 || h < 44) && !inline) targetsHouse.push({ label, w, h, tag: el.tagName.toLowerCase(), sel: path(el) });
    let nm = (el.innerText || '').trim() || el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('alt') || el.getAttribute('placeholder');
    if (!nm && el.getAttribute('aria-labelledby')) nm = el.getAttribute('aria-labelledby').split(/\s+/).map((id) => document.getElementById(id)?.innerText || '').join(' ').trim();
    if (!nm && el.id) nm = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.innerText;
    if (!nm) nm = el.closest('label')?.innerText;
    if (!nm && el.querySelector('img[alt]:not([alt=""]), svg[aria-label], svg title')) nm = 'img';
    if (!nm || !String(nm).trim()) unnamed.push({ tag: el.tagName.toLowerCase(), type: el.getAttribute('type'), w: Math.round(r.width), h: Math.round(r.height), sel: path(el) });
  });
  const de = document.documentElement;
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(rendered).map((h) => h.tagName + ' ' + h.innerText.replace(/\s+/g, ' ').slice(0, 60));
  const landmarks = { main: document.querySelectorAll('main,[role=main]').length, h1: document.querySelectorAll('h1').length, h1Rendered: [...document.querySelectorAll('h1')].filter(rendered).map((h) => h.innerText.slice(0, 60)) };
  const overflowers = []; for (const el of document.querySelectorAll('body *')) { if (!rendered(el)) continue; const r = el.getBoundingClientRect(); if (r.right > innerWidth + 1 && r.left < innerWidth && r.width < innerWidth * 4) { let sc = el.parentElement, contained = false; while (sc && sc !== document.body) { const o = getComputedStyle(sc).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') { contained = true; break; } sc = sc.parentElement; } if (!contained) overflowers.push({ sel: path(el), right: Math.round(r.right) }); } }
  const texts = []; { const w2 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n2; while ((n2 = w2.nextNode())) { const t = n2.textContent.replace(/\s+/g, ' ').trim(); const e = n2.parentElement; if (t && e && rendered(e) && !e.closest('script,style,noscript')) texts.push(t); } }
  return { contrast, small, clipped, targetsAA, targetsHouse, unnamed, headings, landmarks, docOverflowX: de.scrollWidth > de.clientWidth + 1, overflowers: overflowers.slice(0, 12), controls: controls.length, texts };
};
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1, colorScheme: mode === 'dark' ? 'dark' : 'light' });
  await ctx.addInitScript(([mode, lang, ts]) => { try { sessionStorage.setItem('imbewu_sample_mode', '1'); if (lang !== 'en') sessionStorage.setItem('imbewu_sample_lang', lang); localStorage.setItem('fp-mode', mode); localStorage.setItem('fp-theme', 'earth'); if (ts !== '1') localStorage.setItem('fp-textscale', ts); } catch {} }, [mode, lang, textscale]);
  const p = await ctx.newPage(); const logs = [];
  p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text().slice(0, 300)); }); p.on('pageerror', (e) => logs.push('PAGEERROR ' + String(e).slice(0, 300)));
  await p.goto(BASE + '/facilitator/crops', { waitUntil: 'networkidle', timeout: 240000 }); await p.waitForTimeout(2500);
  await p.evaluate((level) => { localStorage.setItem('imbewu_app_level_v1', level); window.dispatchEvent(new CustomEvent('imbewu-app-level-changed')); }, level); await p.waitForTimeout(1200);
  if (gate === 'confirm') { const panel = p.locator('section[aria-label="Site country and region"]'); if (await panel.count() && !(await p.locator('[data-crop-bed-scroll]').count())) { await panel.locator('select').first().selectOption('ZA'); await panel.getByRole('checkbox').check(); await panel.locator('button[type=submit]').last().click(); await p.waitForTimeout(2200); } }
  if (expand === 'expand') for (let i = 0; i < 4; i++) { await p.evaluate(() => document.querySelectorAll('details:not([open])').forEach((d) => { d.open = true; })); await p.waitForTimeout(400); }
  const res = await p.evaluate(COLLECT);
  const dedupe = (arr, key) => { const m = new Map(); for (const x of arr) { const k = key(x); if (m.has(k)) m.get(k).count++; else m.set(k, { ...x, count: 1 }); } return [...m.values()]; };
  const out = { config: { name, viewport: `${W}x${H}`, theme: 'earth ' + mode, level, lang, expanded: expand === 'expand', countryGate: gate, textScale: textscale, url: '/facilitator/crops', build: 'main 8a4d1fd (local dev server), sample farm' },
    totals: { controls: res.controls, contrastFailures: res.contrast.length, contrastFailuresExcludingDisabled: res.contrast.filter((c) => !c.disabled).length, textUnder12px: res.small.length, targetsUnder24_noException: res.targetsAA.filter((t) => !t.exception).length, targetsUnder24_withException: res.targetsAA.filter((t) => t.exception).length, targets24to44: res.targetsHouse.length, unnamedControls: res.unnamed.length, clippedText: res.clipped.length, h1: res.landmarks.h1Rendered.length, docOverflowX: res.docOverflowX },
    contrast: dedupe(res.contrast, (x) => [x.text, x.fg, x.bg, x.fontPx].join('|')).sort((a, b) => a.ratio - b.ratio),
    textUnder12px: dedupe(res.small, (x) => [x.text, x.fontPx].join('|')),
    targetsUnder24: dedupe(res.targetsAA, (x) => [x.label, x.w, x.h].join('|')),
    targets24to44: dedupe(res.targetsHouse, (x) => [x.label, x.w, x.h].join('|')),
    unnamedControls: res.unnamed, clippedText: dedupe(res.clipped, (x) => x.text), headings: res.headings, landmarks: res.landmarks, overflowers: res.overflowers, consoleErrors: logs, texts: res.texts };
  fs.writeFileSync(`${OUT}/${name}.json`, JSON.stringify(out, null, 1));
  console.log(name, JSON.stringify(out.totals));
  await b.close();
})().catch((e) => { console.error('FAIL', name, e.message.slice(0, 500)); process.exit(1); });
