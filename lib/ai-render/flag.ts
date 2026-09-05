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
// This switch enables the environment, not every account. A verified aiRenderTester custom
// claim additionally grants each tester access; the routes and worker enforce it independently
// of the interface. Keep this switch off until both sides of that gate have been deployed.
// There is deliberately no localStorage or query-string override for paid rendering.

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
