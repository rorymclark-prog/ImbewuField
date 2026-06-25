import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { LocationData } from '@/lib/types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: NextRequest) {
  const { images, locationData, source }: {
    images: Array<{ data: string; mediaType: string }>;
    locationData: LocationData;
    source: 'upload' | 'satellite';
  } = await req.json();

  const validImages = images?.filter(img => img?.data && img.data.length > 100);
  if (!validImages?.length) return NextResponse.json({ error: 'No valid images — photos may be empty or corrupt. Try re-selecting them.' }, { status: 400 });

  const sourceNote = source === 'satellite'
    ? 'This is a satellite/aerial view of the site captured directly from the map.'
    : 'These are ground-level photos taken at the site.';

  const content: Anthropic.MessageParam['content'] = [
    ...validImages.map((img) => ({
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: img.mediaType as 'image/jpeg' | 'image/png',
        data: img.data,
      },
    })),
    {
      type: 'text' as const,
      text: `You are an expert permaculture designer and ecologist analysing site imagery for ${locationData.biome.name} biome in South Africa (${Math.abs(locationData.lat).toFixed(3)}°S, ${locationData.lon.toFixed(3)}°E).

${sourceNote}

Provide a focused, concise site assessment with these exact sections (keep each section tight — bullet points over paragraphs):

## 🔍 What I Can See
The key observable features: vegetation, soil condition, water features, structures, topography. Be specific about what you actually see.

## 🌿 Vegetation
- Plant types/species you can identify
- Density and health
- Invasive species or degradation
- Existing assets worth preserving

## 💧 Water & Drainage
Drainage patterns, dry riverbeds, wet spots, erosion channels, or water infrastructure visible.

## 🏔 Terrain & Slope
Slope, aspect, and topography you can assess from this view.

## ⚠ Key Observations
The 3–5 most important site-specific findings for the design. Tie to the ${locationData.biome.name} biome and ${locationData.rainfall.annual}mm annual rainfall.

## ✅ Existing Assets
What's already working that a permaculture design should build on.

## 📸 Photos That Would Help
${source === 'satellite'
  ? `From this satellite view there are things you cannot judge from above. List 3–5 SPECIFIC ground photos the farmer should take to sharpen the design — each as a plain instruction starting with "Take a photo of...", naming WHERE on the site and WHY it helps (e.g. "Take a photo of the low wet corner in the north-east — to see if it stays soggy and could become a pond"). Base each request on what you actually see in this image.`
  : `List 2–3 more photos that would fill the biggest gaps for the design, each starting with "Take a photo of..." and saying why.`}

Be direct and concise. This feeds into a full design report.`,
    },
  ];

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1400,
    messages: [{ role: 'user', content }],
  });

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(new TextEncoder().encode(chunk.delta.text));
          }
        }
      } catch (err) {
        console.error('Photo analysis error:', err);
        const msg = err instanceof Error ? err.message : String(err);
        const friendly = /could not process image/i.test(msg)
          ? '\n\n⚠ Could not read this image. Try zooming the map and capturing again, or upload a photo instead.'
          : `\n\n⚠ Analysis error: ${msg}`;
        controller.enqueue(new TextEncoder().encode(friendly));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}
