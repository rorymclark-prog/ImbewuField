// Design Studio — client helpers for the /api/ai-render pipeline, reusable outside
// GeometryDesignStudio.tsx. Mirrors runAiRender/handleTouchUp/pollFalRender in
// components/GeometryDesignStudio.tsx exactly (same 45x3000ms polling loop, same
// error strings) so both surfaces stay in lockstep with the fal queue behaviour.

// How long we'll wait for a fal queue job before giving up. gpt-image-2 at 'high' quality
// ROUTINELY takes ~5 minutes (measured in the field), so the old budget — 60 polls x 3000ms = 3
// MINUTES — gave up ~2 minutes before a normal render was ready. Fast jobs squeaked in; slow ones
// were guaranteed to fail with "Timed out waiting for the render", which is exactly what a farmer
// hit. (The stale comment here claimed "~30-90s" / "45x3000ms" — it had drifted from both the code
// and reality.) A deadline says what we mean far better than a magic iteration count.
const RENDER_DEADLINE_MS = 8 * 60 * 1000;

// Poll a fal queue job (gpt-image-2 async path) until the render is ready, or throw on
// failure/timeout. The work happens on fal, not in our serverless function, so a long wait here
// costs us nothing but the user's patience — and the UI already warns gpt-image-2 is slow.
export async function pollFalRender(statusUrl: string, responseUrl: string): Promise<string> {
  let finalImage: string | undefined;
  const startedAt = Date.now();
  // Start responsive (a quick job shouldn't wait), then ease off — a 5-minute job gains nothing
  // from 3-second granularity, and this keeps the request count sane over the full budget.
  let delayMs = 3000;
  while (!finalImage && Date.now() - startedAt < RENDER_DEADLINE_MS) {
    await new Promise((r) => setTimeout(r, delayMs));
    delayMs = Math.min(6000, delayMs + 250);
    const pr = await fetch('/api/ai-render/poll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statusUrl, responseUrl }),
    });
    const pd: { image?: string; error?: string; detail?: string; pending?: boolean } = await pr
      .json()
      .catch(() => ({}));
    if (pd.image) {
      finalImage = pd.image;
      break;
    }
    // Surface ANY non-ok poll response (even with no JSON body) instead of silently looping to a timeout.
    if (!pr.ok) throw new Error(pd.error ? `${pd.error}${pd.detail ? ` — ${pd.detail}` : ''}` : `Poll failed (HTTP ${pr.status})`);
    // otherwise still pending → keep polling
  }
  if (!finalImage) {
    throw new Error(
      `Timed out after ${Math.round(RENDER_DEADLINE_MS / 60000)} minutes waiting for the render. gpt-image-2 is slow under load — try again, or switch the engine to Gemini (~1 min).`,
    );
  }
  return finalImage;
}

// POST /api/ai-render with an arbitrary body, parse the response the same way
// runAiRender does (json-catch → 'Server error…', !ok → error/detail, pending → poll),
// and return the final image data URL.
export async function requestRender(body: Record<string, unknown>): Promise<string> {
  const res = await fetch('/api/ai-render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  let data: { image?: string; error?: string; detail?: string; pending?: boolean; statusUrl?: string; responseUrl?: string } = {};
  try {
    data = await res.json();
  } catch {
    const raw = await res.text().catch(() => '');
    throw new Error(`Server error (${res.status})${raw ? ` — ${raw.slice(0, 200)}` : ''}`);
  }
  if (!res.ok) {
    throw new Error(data.error ? `${data.error}${data.detail ? ` — ${data.detail}` : ''}` : 'Render failed.');
  }

  let finalImage = data.image;
  // Async path (gpt-image-2 via fal queue): poll until the render is ready (~30-90s).
  if (!finalImage && data.pending && data.statusUrl && data.responseUrl) {
    finalImage = await pollFalRender(data.statusUrl, data.responseUrl);
  }

  if (!finalImage) {
    throw new Error(data.error ? `${data.error}${data.detail ? ` — ${data.detail}` : ''}` : 'Render failed.');
  }
  return finalImage;
}

export const stripDataUrl = (s: string): string => s.replace(/^data:image\/\w+;base64,/, '');
