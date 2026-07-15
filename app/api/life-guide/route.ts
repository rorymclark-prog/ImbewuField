import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { LocationData } from '@/lib/types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const TOOL_SCHEMA: Anthropic.Tool = {
  name: 'life_guide',
  description: 'Concise living-systems guide for a SA smallholder. Keep all text fields short (≤12 words).',
  input_schema: {
    type: 'object',
    properties: {
      ecosystem: { type: 'string', description: '2 sentences: biome character + key design challenge' },
      indigenousPlants: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name:      { type: 'string' },
            localName: { type: 'string' },
            role:      { type: 'string', description: 'role in ≤10 words' },
          },
          required: ['name', 'role'],
        },
        description: '6 indigenous plants for agro-ecosystem integration',
      },
      vegetables: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name:   { type: 'string' },
            season: { type: 'string', description: 'e.g. Spring–Summer' },
            notes:  { type: 'string', description: '≤8 words' },
          },
          required: ['name', 'season'],
        },
        description: '6 best vegetables for this biome+rainfall+soil',
      },
      fruitTrees: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name:  { type: 'string' },
            notes: { type: 'string', description: '≤8 words' },
          },
          required: ['name'],
        },
        description: '4 suitable fruit trees',
      },
      indigenousFruit: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name:      { type: 'string' },
            localName: { type: 'string' },
            notes:     { type: 'string', description: '≤8 words' },
          },
          required: ['name'],
        },
        description: '4 indigenous edible plants for this biome',
      },
      nuts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name:  { type: 'string' },
            notes: { type: 'string', description: '≤8 words' },
          },
          required: ['name'],
        },
        description: '3 nut crops for this biome',
      },
      animals: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type:   { type: 'string' },
            breeds: { type: 'string', description: '1–2 SA breed names' },
            notes:  { type: 'string', description: '≤10 words' },
            scale:  { type: 'string', enum: ['Micro', 'Small', 'Medium', 'Large'] },
          },
          required: ['type', 'notes', 'scale'],
        },
        description: '4 animal systems for smallholder farms in this biome',
      },
    },
    required: ['ecosystem', 'indigenousPlants', 'vegetables', 'fruitTrees', 'indigenousFruit', 'nuts', 'animals'],
  },
};

export async function POST(req: NextRequest) {
  const { locationData }: { locationData: LocationData } = await req.json();
  if (!locationData?.biome) return NextResponse.json({ error: 'No location data' }, { status: 400 });

  const { biome, rainfall, climate, soil, vegetation, bru } = locationData;

  const prompt = `Living-systems guide for a smallholder in the ${biome.name} biome, South Africa.
${Math.abs(locationData.lat).toFixed(2)}°S ${locationData.lon.toFixed(2)}°E · ${rainfall.annual}mm (${rainfall.pattern}) · ${climate.koppen} · ${soil.textureClass} pH${soil.ph.toFixed(1)}${vegetation?.vegUnit ? ' · ' + vegetation.vegUnit : ''}${bru ? ` · KZN BRU zone ${bru.brucode}, ~${bru.nearestBrg} character (approximate climate match, not confirmed), ${bru.tmin}–${bru.tmax}°C` : ''}
Keep all responses concise — names and short phrases only, no long descriptions. If a BRU zone is given, treat it as soft local-climate context only — never restate its rainfall, only the mm figure already given above.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      tools: [TOOL_SCHEMA],
      tool_choice: { type: 'tool', name: 'life_guide' },
      messages: [{ role: 'user', content: prompt }],
    });

    const toolUse = response.content.find((c) => c.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      return NextResponse.json({ error: 'No guide generated' }, { status: 500 });
    }
    return NextResponse.json(toolUse.input);
  } catch (err) {
    console.error('Life guide error:', err);
    return NextResponse.json({ error: 'Failed to generate guide' }, { status: 500 });
  }
}
