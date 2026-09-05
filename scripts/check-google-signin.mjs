/** Diagnose the live sign-in providers without exporting credentials or user data.
 * The optional repair enables only an ALREADY CONFIGURED Google provider.
 * It never creates OAuth clients, changes passwords, or grants account roles.
 */
import { pathToFileURL } from 'node:url';
const PROJECT = 'fieldproof-sa';
const BASE = `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT}`;

export async function checkGoogleSignin({ request, apply = false }) {
  const config = await request('/config');
  const google = await request('/defaultSupportedIdpConfigs/google.com', { allowMissing: true });
  const summary = {
    project: PROJECT,
    productionDomainAuthorized: (config.authorizedDomains ?? []).includes('imbewufield.vercel.app'),
    emailEnabled: config.signIn?.email?.enabled === true,
    passwordRequired: config.signIn?.email?.passwordRequired === true,
    googleConfigured: Boolean(google?.clientId && google?.clientSecret),
    googleEnabled: google?.enabled === true,
    changed: false,
  };
  if (!apply || summary.googleEnabled) return summary;
  if (!summary.productionDomainAuthorized) throw new Error('PRODUCTION_DOMAIN_NOT_AUTHORIZED');
  if (!summary.googleConfigured) throw new Error('GOOGLE_CONSOLE_SETUP_REQUIRED');
  // A field mask preserves the existing OAuth credentials and every other setting.
  await request('/defaultSupportedIdpConfigs/google.com?updateMask=enabled', {
    method: 'PATCH', body: { enabled: true },
  });
  const after = await request('/defaultSupportedIdpConfigs/google.com');
  if (after.enabled !== true) throw new Error('GOOGLE_ENABLE_READBACK_FAILED');
  return { ...summary, googleEnabled: true, changed: true };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--apply')) throw new Error('UNKNOWN_ARGUMENT');
  if (args.includes('--apply') && process.env.GITHUB_REF !== 'refs/heads/main') throw new Error('APPLY_REQUIRES_MAIN');
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('ADMIN_CREDENTIAL_UNAVAILABLE');
  let credential;
  try { credential = JSON.parse(raw); } catch { throw new Error('ADMIN_CREDENTIAL_INVALID_JSON'); }
  if (credential.project_id !== PROJECT) throw new Error('ADMIN_CREDENTIAL_WRONG_PROJECT');
  const { cert } = await import('firebase-admin/app');
  const { access_token: token } = await cert(credential).getAccessToken();
  const request = async (path, { method = 'GET', body, allowMissing = false } = {}) => {
    const response = await fetch(BASE + path, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000),
    });
    if (allowMissing && response.status === 404) return null;
    if (!response.ok) throw new Error(`AUTH_CONFIG_HTTP_${response.status}`);
    return response.json();
  };
  console.log(JSON.stringify(await checkGoogleSignin({ request, apply: args.includes('--apply') })));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    // Never log raw API responses, OAuth config or SDK errors containing credentials.
    console.error(/^[A-Z_0-9]+$/.test(error.message ?? '') ? error.message : 'AUTH_CONFIG_CHECK_FAILED');
    process.exitCode = 1;
  });
}
