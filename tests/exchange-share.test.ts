/*
 * lib/exchange.ts's listingShareText() — the plain-text message a farmer
 * pastes into WhatsApp for one listing. Pure function, no DOM, no
 * navigator.share, so it is tested directly rather than through the
 * components/exchange/share.ts wrapper that actually calls the Web Share API.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { listingShareText, type Listing } from '../lib/exchange.ts';

function listing(over: Partial<Listing> = {}): Listing {
  return {
    id: 'demo-listing-chard-ubhejane',
    kind: 'offer',
    category: 'produce',
    cropKey: 'swiss-chard',
    title: 'Swiss chard — cutting weekly',
    description: 'Cutting about 12 kg a week off the crèche beds.',
    qty: 12,
    unit: 'kg',
    price: { type: 'zar', amount: 6, per: 'kg' },
    farmerId: 'demo-farmer-ubhejane',
    farmerName: 'Thandi Ngema',
    areaText: 'Ubhejane',
    lat: -27.73,
    lon: 31.96,
    postedAt: '2026-08-01T00:00:00.000Z',
    status: 'active',
    availableMonth: 8,
    photoUrl: null,
    source: 'manual',
    isDemo: false,
    ...over,
  };
}

test('the share message carries crop, quantity, price, pickup area and farmer name — plain text, no markdown', () => {
  const text = listingShareText(listing());
  const lines = text.split('\n');
  assert.ok(!/[*_#`]/.test(text), 'message must be plain text, no markdown characters');
  assert.ok(lines[0].includes('Swiss chard — cutting weekly'));
  assert.ok(lines.includes('Crop: Swiss chard (spinach)'));
  assert.ok(lines.includes('Quantity: 12 kg'), 'quantity must carry its unit');
  assert.ok(lines.includes('Price: R6/kg'), 'price must carry a currency symbol');
  assert.ok(lines.includes('Pickup area: Ubhejane'));
  assert.ok(lines.includes('From: Thandi Ngema'));
});

test('a want listing reads "Looking for", not "Offering"', () => {
  const text = listingShareText(listing({ kind: 'want', title: 'Looking for 2 kg sugar bean seed' }));
  assert.ok(text.startsWith('Looking for:'));
});

test('a listing off the crop catalog (tools, labour) skips the crop line rather than printing a false one', () => {
  const text = listingShareText(listing({
    cropKey: null,
    category: 'tools',
    title: 'Two-row planter for hire',
    qty: null,
    unit: null,
    price: { type: 'zar', amount: 350, per: 'days' },
  }));
  assert.ok(!text.includes('Crop:'));
  assert.ok(!text.includes('Quantity:'), 'an unquantified listing has no quantity line');
  assert.ok(text.includes('Two-row planter for hire'));
  assert.ok(text.includes('Price: R350/day'), 'the basis reads in the singular');
});

test('swap and free prices never print a currency symbol on a number that is not one', () => {
  const free = listingShareText(listing({ price: { type: 'free' } }));
  assert.ok(free.includes('Price: Free'));
  assert.ok(!/R\d/.test(free));

  const swap = listingShareText(listing({ price: { type: 'swap', wants: 'pumpkin seed' } }));
  assert.ok(swap.includes('Price: Swap — pumpkin seed'));
  assert.ok(!/R\d/.test(swap));
});

test('a lot price divides out for a per-item read, and quantity above zero is written as a decimal, not truncated', () => {
  const text = listingShareText(listing({
    price: { type: 'zar', amount: 1300, per: 'lot' },
    qty: 180.5,
    unit: 'kg',
  }));
  assert.ok(text.includes('Price: R1300 for the lot'));
  assert.ok(text.includes('Quantity: 180.5 kg'));
});

test('a missing area or farmer name still produces a readable line, never a blank one', () => {
  const text = listingShareText(listing({ areaText: '', farmerName: '' }));
  const lines = text.split('\n');
  assert.ok(lines.every((l) => l.trim().length > 0), 'no blank line in the shared message');
  assert.ok(lines.includes('Pickup area: Not given'));
  assert.ok(lines.some((l) => l.startsWith('From: ') && l !== 'From: '));
});
