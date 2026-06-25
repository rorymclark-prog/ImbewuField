import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { LocationData } from '@/lib/types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const TOOL_SCHEMA: Anthropic.Tool = {
  name: 'life_guide',
  description: 'Ecological and production guide for a SA smallholder farm location',
  input_schema: {
    type: 'object',
    properties: {
      ecosystem: { type: 'string', description: '2–3 sentence overview of this biome\'s natural ecosystem — what it looks like, keystone species, and ecological character' },
      indigenousPlants: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name:      { type: 'string' },
            localName: { type: 'string', description: 'Common local/vernacular name (Zulu, Xhosa, Afrikaans)' },
            role:      { type: 'string', description: 'Ecological + permaculture role in 10–15 words' },
          },
          required: ['name', 'role'],
        },
        description: '7 key indigenous plants for this biome to integrate into an agro-ecosystem',
      },
      vegetables: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name:   { type: 'string' },
            season: { type: 'string', description: 'Best planting season given rainfall pattern' },
            notes:  { type: 'string', description: 'One key tip for this specific location' },
          },
          required: ['name', 'season'],
        },
        description: '8 best vegetables for this biome, rainfall, and soil combination',
      },
      fruitTrees: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name:  { type: 'string' },
            notes: { type: 'string', description: 'Why it suits this location' },
          },
          required: ['name'],
        },
        description: '5 most suitable commercial or home-use fruit trees',
      },
      indigenousFruit: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name:      { type: 'string' },
            localName: { type: 'string' },
            notes:     { type: 'string' },
          },
          required: ['name'],
        },
        description: '5 indigenous fruit-bearing trees or plants native or suited to this biome',
      },
      nuts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name:  { type: 'string' },
            notes: { type: 'string' },
          },
          required: ['name'],
        },
        description: '3 nut trees or crops suited to this biome and climate',
      },
      animals: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type:   { type: 'string', description: 'Animal category (Chickens, Goats, Rabbits, Fish, etc.)' },
            breeds: { type: 'string', description: 'Best SA-adapted breeds for this climate' },
            notes:  { type: 'string', description: 'Why suited here and one key management note (15–20 words)' },
            scale:  { type: 'string', enum: ['Micro', 'Small', 'Medium', 'Large'], description: 'Minimum land or water scale needed' },
          },
          required: ['type', 'notes', 'scale'],
        },
        description: '5 animal systems for smallholder farms in this biome (incl. poultry, small livestock, aquaculture if suitable)',
      },
    },
    required: ['ecosystem', 'indigenousPlants', 'vegetables', 'fruitTrees', 'indigenousFruit', 'nuts', 'animals'],
  },
};

export async function POST(req: NextRequest) {
  const { locationData }: { locationData: LocationData } = await req.json();
  if (!locationData?.biome) return NextResponse.json({ error: 'No location data' }, { status: 400 });

  const { biome, rainfall, climate, soil, vegetation } = locationData;

  const prompt = `Generate a living-systems guide for a smallholder farm in the ${biome.name} biome of South Africa.

Location: ${Math.abs(locationData.lat).toFixed(2)}°S, ${locationData.lon.toFixed(2)}°E
Annual rainfall: ${rainfall.annual}mm (${rainfall.pattern} — wet ${rainfall.wetSeason}, dry ${rainfall.drySeason})
Climate: ${climate.koppen} (${climate.koppenDesc}) — mean ${climate.meanTemp}°C, max ${climate.maxTemp}°C, min ${climate.minTemp}°C
Soil: ${soil.textureClass}, pH ${soil.ph.toFixed(1)}, organic carbon ${soil.organicCarbon.toFixed(1)}%${vegetation?.vegUnit ? `\nVegetation unit: ${vegetation.vegUnit}` : ''}
Biome notes: ${biome.description}

Be specific to this location. Name actual species (scientific + common) where possible. For animals, name SA-adapted breeds. Flag biome-specific constraints (frost, drought, fire season) where relevant.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2400,
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
