// Master kill switch for AI map generation — /api/ai-render, /api/ai-render/poll
// and /api/image-producer, and the Design Studio controls that call them.
//
// DEFAULTS OFF. These are the most expensive calls the app can make: each one
// bills a real vendor account (fal / OpenAI / Gemini) per image, and a render
// that goes wrong costs the same as one that goes right. Off by default means
// an unset variable can never leave the spend open — the failure mode of a
// missing env var is "the feature is off", not "the meter is running".
//
// Turn ON:  set NEXT_PUBLIC_AI_RENDER_ENABLED=true for that Vercel environment,
//           then redeploy that environment.
// Turn OFF: remove the variable (or set it to anything else), redeploy.
//
// The intended shape is ON for Preview, OFF for Production: AI rendering stays
// available on imbewufield-<branch>.vercel.app to keep working on, while no
// farmer on the live site can start a paid render.
//
// Deliberately NO localStorage escape hatch (unlike lib/community/flag.ts). That
// flag guards whether a feature is VISIBLE; this one guards whether money can be
// spent, and a switch a browser console can flip is not a spend control. One
// variable drives both the UI and the routes, so the button and the endpoint can
// never disagree — no dead control, no reachable-but-hidden endpoint.

export const AI_RENDER_FLAG = 'NEXT_PUBLIC_AI_RENDER_ENABLED';

export function aiRenderEnabled(): boolean {
  return process.env.NEXT_PUBLIC_AI_RENDER_ENABLED === 'true';
}

// What the routes return when the switch is off. 503 rather than 404: the route
// exists and is expected back, it is just not accepting work right now — and it
// is distinguishable in logs from a genuinely missing path.
export const AI_RENDER_DISABLED_STATUS = 503;
export const AI_RENDER_DISABLED_MESSAGE =
  'AI map generation is turned off. The exact vector map is unaffected — open the saved exact master instead.';
