// Preserve the reviewed products' silhouettes while giving the small flat calendar pictures
// depth. This extends the native vector assets; it is not a new species or a raster replacement.
import { readFileSync, writeFileSync } from 'node:fs';
import { FRUIT_ART_SPECIES } from '@/lib/species-art';
const shade = (hex, amount) => '#' + [0, 2, 4].map(i => Math.round(amount > 0 ? parseInt(hex.slice(i, i + 2), 16) + (255 - parseInt(hex.slice(i, i + 2), 16)) * amount : parseInt(hex.slice(i, i + 2), 16) * (1 + amount)).toString(16).padStart(2, '0')).join('');
for (const speciesId of FRUIT_ART_SPECIES) {
  const path = `public/fruit-art/${speciesId}.svg`;
  let svg = readFileSync(path, 'utf8');
  if (svg.includes('id="shade-')) continue;
  if (speciesId === 'persea-americana') svg = svg.replace('<ellipse cx="32" cy="44" rx="7" ry="8" fill="#C8D86A"/>', '<path d="M32 20 C27 20 28 30 25 35 C20 44 24 54 32 54 C40 54 44 44 39 35 C36 30 37 20 32 20Z" fill="#DEE79A"/><ellipse cx="32" cy="43" rx="6.5" ry="8" fill="#925D35"/>');
  const colours = [...new Set([...svg.matchAll(/fill="#([0-9a-f]{6})"/gi)].map(m => m[1]))];
  const gradients = colours.map((colour, i) => `<linearGradient id="shade-${i}" x1="15%" y1="0%" x2="85%" y2="100%"><stop offset="0" stop-color="${shade(colour, .28)}"/><stop offset=".45" stop-color="#${colour}"/><stop offset="1" stop-color="${shade(colour, -.24)}"/></linearGradient>`).join('');
  colours.forEach((colour, i) => { svg = svg.replaceAll(`fill="#${colour}"`, `fill="url(#shade-${i})"`); });
  svg = svg.replace(/(<svg[^>]*>)/, `$1<defs>${gradients}</defs>`);
  // The old bottom waterberry exceeded the view box; retain the cluster without cropping it.
  if (speciesId === 'syzygium-cordatum') svg = svg.replace('</defs>', '</defs><g transform="translate(1.6 1.6) scale(.95)">').replace('</svg>', '</g></svg>');
  writeFileSync(path, svg);
}
