import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const assetRoot = join(process.cwd(), 'assets');
const metadataRoot = join(assetRoot, 'metadata');
const index = JSON.parse(readFileSync(join(metadataRoot, 'index.json'), 'utf8'));
const requiredStates = ['existing', 'proposed', 'to-verify'];
const errors = [];

function fail(message) {
  errors.push(message);
}

if (index.schemaVersion !== 1 || index.batch !== 1 || !Array.isArray(index.assets)) {
  fail('assets/metadata/index.json must identify Batch 1 schema version 1 and list its assets.');
}

for (const metadataFile of index.assets) {
  const metadataPath = join(metadataRoot, metadataFile);
  let asset;
  try {
    asset = JSON.parse(readFileSync(metadataPath, 'utf8'));
  } catch {
    fail(`${metadataFile} is missing or is not valid JSON.`);
    continue;
  }

  const label = asset.id || metadataFile;
  const requiredFields = [
    'schemaVersion', 'id', 'assetPath', 'batch', 'category', 'view', 'anchor',
    'defaultDisplayPx', 'realWorldScaleSource', 'states', 'stateStyling', 'tags',
    'generationPrompt', 'delivery', 'assetStatus',
  ];
  for (const field of requiredFields) {
    if (!(field in asset)) fail(`${label} is missing ${field}.`);
  }
  if (asset.schemaVersion !== 1 || asset.batch !== 1) fail(`${label} has the wrong schema or batch.`);
  if (!/^bf_(map|hybrid|ui|pattern|scene)_[a-z0-9_]+_v\d{2}$/.test(asset.id || '')) fail(`${label} has an invalid id.`);
  if (basename(asset.assetPath || '') !== `${asset.id}.svg`) fail(`${label} assetPath must use its id as the SVG filename.`);
  if (asset.realWorldScaleSource !== 'configured in app, not baked into artwork') fail(`${label} must keep scale in app data.`);
  if (JSON.stringify(asset.states) !== JSON.stringify(requiredStates)) fail(`${label} must declare only the shared neutral states.`);
  if (asset.stateStyling !== 'app-code-only') fail(`${label} must not bake interaction states into artwork.`);
  if (!['top', 'overhead', 'isometric'].includes(asset.view)) fail(`${label} has an unsupported view.`);
  if (!Number.isInteger(asset.defaultDisplayPx) || asset.defaultDisplayPx < 24) fail(`${label} has an invalid default display size.`);
  if (!Array.isArray(asset.tags) || asset.tags.length === 0) fail(`${label} needs at least one tag.`);
  if (typeof asset.generationPrompt !== 'string' || asset.generationPrompt.trim() === '') fail(`${label} needs its approved generation prompt.`);
  if (asset.delivery?.svg !== `${asset.id}.svg`) fail(`${label} delivery SVG must use its id.`);
  if (!Array.isArray(asset.delivery?.png) || asset.delivery.png.length === 0 || asset.delivery.png.some((file) => !new RegExp(`^${asset.id}_[0-9]+\\.png$`).test(file))) {
    fail(`${label} delivery PNG names must use its id and pixel suffix.`);
  }

  const artworkExists = existsSync(join(process.cwd(), asset.assetPath || ''));
  if (asset.assetStatus === 'awaiting-art' && artworkExists) fail(`${label} has artwork but is still awaiting art; move it to awaiting-review.`);
  if (asset.assetStatus !== 'awaiting-art' && !artworkExists) fail(`${label} is marked ${asset.assetStatus} but its SVG is missing.`);
}

if (errors.length > 0) {
  console.error(errors.map((error) => `• ${error}`).join('\n'));
  process.exit(1);
}

console.log(`Visual asset metadata is ready: ${index.assets.length} Batch 1 records await artwork.`);
