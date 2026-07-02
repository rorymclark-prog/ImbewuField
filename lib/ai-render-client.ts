// Design Studio — client helpers for the /api/ai-render pipeline, reusable outside
// GeometryDesignStudio.tsx. Mirrors runAiRender/handleTouchUp/pollFalRender in
// components/GeometryDesignStudio.tsx exactly (same 45x3000ms polling loop, same
// error strings) so both surfaces stay in lockstep with the fal queue behaviour.

// Poll a fal queue job (gpt-image-2 async path) until the render is ready (~30-90s), or
// throw on failure/timeout. SAME 45x3000ms polling loop and error messages as
// components/GeometryDesignStudio.tsx's pollFalRender.
export async function pollFalRender(statusUrl: string, responseUrl: string): Promise<string> {
  let finalImage: string | undefined;
  for (let i = 0; i < 45 && !finalImage; i++) {
    await new Promise((r) => setTimeout(r, 3000));
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
  if (!finalImage) throw new Error('Timed out waiting for the render — try again.');
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
