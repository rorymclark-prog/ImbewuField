import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canChooseUnderlay,
  frameForUnderlay,
  underlayCacheSuffix,
} from '@/lib/sheet-underlay';
import type { CanvasFrame } from '@/lib/design-canvas';

const frame = (satDataUrl: string | null, underlayDataUrl?: string | null): CanvasFrame => ({
  centerLng: 31.963044,
  centerLat: -27.726231,
  zoom: 18,
  imgW: 960,
  imgH: 640,
  mPerPx: 0.28,
  satDataUrl,
  underlayDataUrl,
});

test('the choice is offered only where two aligned images actually exist', () => {
  assert.equal(canChooseUnderlay(frame('data:photo', 'data:satellite')), true);
  // No custom base: satDataUrl already IS the satellite, so there is nothing to switch between.
  assert.equal(canChooseUnderlay(frame('data:satellite')), false);
  assert.equal(canChooseUnderlay(frame('data:satellite', null)), false);
  // A base that failed to load is not a choice either.
  assert.equal(canChooseUnderlay(frame(null, 'data:satellite')), false);
});

test('choosing the satellite swaps it into the one field every sheet reads', () => {
  const withPhoto = frame('data:photo', 'data:satellite');
  const rendered = frameForUnderlay(withPhoto, 'satellite');
  assert.equal(rendered.satDataUrl, 'data:satellite');
  // Everything else about the frame is geo-registration and must survive untouched, or the sheet
  // is drawn at the wrong scale or in the wrong place.
  assert.equal(rendered.centerLat, withPhoto.centerLat);
  assert.equal(rendered.centerLng, withPhoto.centerLng);
  assert.equal(rendered.zoom, withPhoto.zoom);
  assert.equal(rendered.imgW, withPhoto.imgW);
  assert.equal(rendered.imgH, withPhoto.imgH);
  assert.equal(rendered.mPerPx, withPhoto.mPerPx);
  // The farmer's photo is still held, so switching back cannot lose it.
  assert.equal(rendered.underlayDataUrl, 'data:satellite');
  // And the source frame was not mutated — rendering never edits the design.
  assert.equal(withPhoto.satDataUrl, 'data:photo');
});

test('the default returns the very same frame, so nothing re-renders for asking', () => {
  const withPhoto = frame('data:photo', 'data:satellite');
  assert.equal(frameForUnderlay(withPhoto, 'photo'), withPhoto);
  const plain = frame('data:satellite');
  assert.equal(frameForUnderlay(plain, 'photo'), plain);
});

test('asking for a satellite that is not held leaves the sheet on the image it has', () => {
  // A missing base must never become a blank sheet: there is no second image to fall back to.
  const plain = frame('data:satellite');
  assert.equal(frameForUnderlay(plain, 'satellite'), plain);
  assert.equal(frameForUnderlay(plain, 'satellite').satDataUrl, 'data:satellite');
});

test('the underlay is part of a sheet identity, and the default key is unchanged', () => {
  // Two different pictures of the same sheet must not share a cache slot, or switching re-serves
  // the one you just switched away from.
  assert.notEqual(underlayCacheSuffix('satellite'), underlayCacheSuffix('photo'));
  // Empty on the default: every sheet already in a farmer's gallery stays addressable under the key
  // it was stored with, so this cannot orphan renders they have already paid for.
  assert.equal(underlayCacheSuffix('photo'), '');
  assert.equal(`producer:atlas:water:hybrid${underlayCacheSuffix('photo')}`, 'producer:atlas:water:hybrid');
});
