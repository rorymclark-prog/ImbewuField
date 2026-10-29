import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import postcss from 'postcss';

// w21-10/w22-09: the chart kept light-only surfaces while its parent themed the headings.
// Check the painted colour pairs, including that parent rule, rather than pinning new hexes.
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const graphCss = read('../components/crops/ProductionAvailabilityGraphs.module.css');
const graph = postcss.parse(graphCss);
const parent = postcss.parse(read('../app/samples/production/ProductionExample.module.css'));
const global = postcss.parse(read('../app/globals.css'));
const columns = ['html[data-theme="earth"]', 'html[data-theme="earth"].dark', 'html[data-theme="slate"]', 'html[data-theme="slate"].dark'];

function declaration(sheet: ReturnType<typeof postcss.parse>, selector: string, property: string): string | undefined {
  let value: string | undefined;
  sheet.walkRules(rule => {
    if (rule.parent?.type !== 'root' || !rule.selectors.includes(selector)) return;
    rule.walkDecls(property, decl => { value = decl.value; });
  });
  return value;
}

function resolve(value: string, column: string): string {
  return value.replace(/var\((--[\w-]+)\)/g, (_match, token: string) => {
    const found = declaration(global, column, token) ?? declaration(global, ':root', token);
    assert.ok(found, `${column}: ${token} has no theme authority`);
    return resolve(found, column);
  });
}

type Colour = [number, number, number, number];
function colour(value: string): Colour {
  if (/^#[\da-f]{6}$/i.test(value)) return [1, 3, 5].map(at => parseInt(value.slice(at, at + 2), 16)).concat(1) as Colour;
  const match = value.match(/^rgba?\(([^)]+)\)$/);
  assert.ok(match, `unsupported painted colour ${value}`);
  const parts = match[1].split(',').map(Number);
  return [parts[0], parts[1], parts[2], parts[3] ?? 1];
}
function over(front: Colour, back: Colour): Colour {
  return [0, 1, 2].map(at => front[at] * front[3] + back[at] * (1 - front[3])).concat(1) as Colour;
}
function luminance(c: Colour): number {
  const linear = c.slice(0, 3).map(channel => {
    const v = channel / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
function ratio(ink: Colour, surface: Colour): number {
  const a = luminance(over(ink, surface)), b = luminance(surface);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
function painted(selector: string, property: string, column: string): Colour {
  const value = declaration(graph, selector, property);
  assert.ok(value, `${selector} must explicitly pair its ${property} with the chart theme`);
  return colour(resolve(value, column));
}
function readable(ink: Colour, surface: Colour, label: string) {
  const actual = ratio(ink, surface);
  assert.ok(actual >= 4.5, `${label} is ${actual.toFixed(2)}:1, below the body-label floor`);
}

test('production graph cards, controls and SVG labels use the per-theme authority', () => {
  assert.doesNotMatch(graphCss, /var\(--(?:surface(?:-2)?|text(?:-2)?|brand)(?:[,)]|\s)/,
    'the old aliases have only light values; changing the app theme must change both graph ink and ground');
  for (const column of columns) {
    const page = colour(resolve('var(--bg-0)', column));
    const card = painted('.card', 'background', column);
    readable(painted('.graphs', 'color', column), page, `${column}: graph text outside cards`);
    readable(painted('.options legend', 'color', column), page, `${column}: kept-food legend`);
    for (const [selector, prop] of [['.card h3', 'color'], ['.card > p', 'color'], ['.axis', 'fill'], ['.year', 'fill'], ['.value', 'fill'], ['.key', 'color'], ['.note', 'color']] as const) {
      readable(painted(selector, prop, column), card, `${column}: ${selector}`);
    }
    readable(painted('.note', 'color', column), page, `${column}: notes outside cards`);
    const records = painted('.records', 'background', column);
    readable(painted('.records p', 'color', column), records, `${column}: stock details`);
    readable(painted('.viewButtons button', 'color', column), painted('.viewButtons button', 'background', column), `${column}: unselected view`);
    readable(painted('.viewButtons button[aria-pressed=true]', 'color', column), painted('.viewButtons button[aria-pressed=true]', 'background', column), `${column}: selected view`);
  }
});

test('production-page heading overrides cannot turn chart titles pale on a light card', () => {
  const parentInk = declaration(parent, '.page h3', 'color');
  assert.ok(parentInk, 'recheck the title cascade if the parent heading rule changes');
  for (const column of columns) {
    const card = painted('.card', 'background', column);
    // The two selectors have equal specificity; either module may load last.
    readable(colour(resolve(parentInk, column)), card, `${column}: parent heading override`);
    readable(painted('.card h3', 'color', column), card, `${column}: chart heading rule`);
  }
});

test('selected-month shading keeps month, year and value labels readable in every theme', () => {
  for (const column of columns) {
    const card = painted('.card', 'background', column);
    const fill = painted('.selected', 'fill', column);
    fill[3] *= Number(declaration(graph, '.selected', 'opacity'));
    const selected = over(fill, card);
    for (const selector of ['.axis', '.year', '.value']) {
      readable(painted(selector, 'fill', column), selected, `${column}: selected ${selector}`);
    }
  }
});

test('the contrast check rejects the former dark-title and kept-food regressions', () => {
  const dark = columns[1];
  assert.throws(() => readable(colour(resolve('var(--text-primary)', dark)), colour(resolve('var(--surface)', dark)), 'old title/card'), /below the body-label floor/);
  assert.throws(() => readable(colour(resolve('var(--text-2)', dark)), colour(resolve('var(--bg-0)', dark)), 'old kept-food legend'), /below the body-label floor/);
});
