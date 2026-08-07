# ImbewuField

Permaculture planning for South African farmers. Next.js app deployed on Vercel.

- **Live:** https://imbewufield.vercel.app (also https://permamap-sa.vercel.app)

## Environment variables

All keys the app needs are listed in [`.env.example`](./.env.example). Copy it to
`.env.local` for local development, and set the **same keys** in
**Vercel → Project → Settings → Environment Variables** (Production) for the live site.

| Variable | Needed for | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | **The map** | [Mapbox tokens](https://account.mapbox.com/access-tokens) (starts `pk.`) |
| `ANTHROPIC_API_KEY` | AI features (reports, photo analysis, insights) | [Anthropic console](https://console.anthropic.com/) (starts `sk-ant-`) |
| `NEXT_PUBLIC_FIREBASE_*` (6 keys) | Login, data, photo storage | Firebase console → Project settings → SDK config |
| `SITE_PASSWORD` | The password gate on the whole site | You choose it |

Real secret values are **never** committed — they live in `.env.local` (gitignored) and in Vercel.

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in real values
npm run dev
```

## Troubleshooting

### The map is blank (controls show, but no map picture)
The map is drawn by Mapbox and needs a valid key. A blank map almost always means
`NEXT_PUBLIC_MAPBOX_TOKEN` is missing or not allowed. Check, in order:

1. **Is the key set in Vercel?** Settings → Environment Variables → confirm
   `NEXT_PUBLIC_MAPBOX_TOKEN` exists for **Production**. After adding/changing it,
   **redeploy** — env changes don't apply to existing deployments.
2. **Is the domain allowed?** In Mapbox → your token → **URL restrictions**, make sure
   `imbewufield.vercel.app` and `permamap-sa.vercel.app` are listed (or remove the restriction).
3. **Is the token still valid?** Confirm it hasn't been rotated/deleted and the Mapbox
   account is in good standing (free tier has a monthly map-load limit).

### AI features fail
Check `ANTHROPIC_API_KEY` is set in Vercel for Production and the key is active.

## Firebase setup & data seeding

See [`scripts/README.md`](./scripts/README.md).
