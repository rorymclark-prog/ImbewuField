import { onRequest } from 'firebase-functions/v2/https';
import { createConnectorApp } from './http';

// Firebase owns credentials and original files. Vercel never forwards a service key.
let service: ReturnType<typeof createConnectorApp> | undefined;
export const imbewuConnector = onRequest({ region: 'europe-west1', invoker: 'public', maxInstances: 3, concurrency: 20, timeoutSeconds: 120, memory: '512MiB' }, (req, res) => {
  if (!service) service = createConnectorApp({ issuer: 'https://imbewufield.vercel.app/api/assistant', appOrigin: 'https://imbewufield.vercel.app', transferOrigin: 'https://europe-west1-fieldproof-sa.cloudfunctions.net/imbewuConnector' });
  const route = req.query.connector_path;
  if (typeof route === 'string') {
    if (!/^\/[a-z-]+(?:\/[A-Za-z0-9_-]+)?$/.test(route)) { res.status(400).json({ error: 'Invalid connector route.' }); return; }
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) if (key !== 'connector_path' && typeof value === 'string') query.set(key, value);
    req.url = route + (query.size ? `?${query}` : '');
  }
  service.app(req, res);
});
