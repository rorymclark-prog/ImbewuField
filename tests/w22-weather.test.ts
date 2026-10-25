import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { WEATHER_ENGLISH_PENDING } from '@/lib/i18n-pending';
import { WEATHER_ZU_DRAFTS, fillWeather, weatherDayKey, weatherDescKey, weatherText } from '@/lib/weather-copy';
import { describeWeatherCode } from '@/lib/weather';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const widget = read('components/WeatherWidget.tsx');

test('w22-03: WeatherWidget paints with theme tokens, no fixed colours', () => {
  assert.doesNotMatch(widget, /#[0-9a-fA-F]{3,8}\b/, 'no hex colours');
  assert.doesNotMatch(widget, /rgba?\(/, 'no rgb/rgba colours');
  assert.doesNotMatch(widget, /var\(--(color-card|text|text-2|text-3|brand|surface)\)/);
  assert.match(widget, /color-mix\(in srgb, \$\{c\} 10%, var\(--bg-1\)\)/);
  assert.match(widget, /d\.precipMm > 0 \? 'var\(--blue\)' : 'var\(--text-muted\)'/);
  assert.match(widget, /borderRight: i < stripDays\.length - 1 \? '1px solid var\(--border\)'/);
});

test('w22-03: the no-rain dash has an accessible meaning', () => {
  assert.match(widget, /<span aria-hidden>—<\/span>/);
  assert.match(widget, /className="sr-only"[^>]*>\{weatherText\(lang, 'weatherNoRain'\)\}/);
});

test('w22-04: every pending key has a non-empty isiZulu draft with matching placeholders', () => {
  for (const [key, english] of Object.entries(WEATHER_ENGLISH_PENDING)) {
    const zu = WEATHER_ZU_DRAFTS[key];
    assert.ok(zu && zu !== english, `${key} needs a draft`);
    assert.deepEqual(zu.match(/\{\w+\}/g)?.sort(), english.match(/\{\w+\}/g)?.sort(), `${key} placeholders`);
  }
  assert.deepEqual(Object.keys(WEATHER_ZU_DRAFTS).sort(), Object.keys(WEATHER_ENGLISH_PENDING).sort());
});

test('w22-04: day labels, hazard sentences, water line and descriptions are drafted in isiZulu, English unchanged', () => {
  assert.equal(weatherText('en', weatherDayKey(1, false)), 'Mon');
  assert.equal(weatherText('en', weatherDayKey(1, true)), 'Today');
  assert.equal(weatherText('zu', weatherDayKey(1, true)), 'Namuhla');
  assert.notEqual(weatherText('zu', weatherDayKey(3, false)), 'Wed');
  assert.equal(fillWeather(weatherText('en', 'weatherFrostBanner'), { days: 'Today, Mon' }), 'Frost expected Today, Mon — protect seedlings');
  assert.match(fillWeather(weatherText('zu', 'weatherHeatBanner'), { days: 'Namuhla' }), /Namuhla/);
  assert.equal(fillWeather(weatherText('en', 'weatherWaterLoss'), { mm: '3.2' }), "Crops will lose about 3.2mm of water today — water roughly that much if there's no rain");
  assert.match(fillWeather(weatherText('zu', 'weatherWaterLoss'), { mm: '3.2' }), /3\.2mm/);
  for (const code of [0, 1, 3, 45, 51, 61, 71, 80, 85, 95, 100]) {
    const { label } = describeWeatherCode(code);
    const key = weatherDescKey(label);
    assert.ok(key, `description "${label}" has a key`);
    assert.equal(weatherText('en', key!), label, 'English matches describeWeatherCode');
    assert.notEqual(weatherText('zu', key!), label);
  }
});

test('w22-04: drafts are labelled and paired with the English source', () => {
  assert.match(widget, /IsiZuluDraftSource/);
  assert.match(widget, /Unreviewed isiZulu draft\./);
  assert.match(read('lib/i18n-pending.ts'), /export const WEATHER_ENGLISH_PENDING/);
  assert.match(read('docs/translation/pending-isizulu.csv'), /^WEATHER,weatherFrostBanner,/m);
});
