/**
 * Repair auth/unauthorized-domain on the two established production aliases.
 * This is Firebase's redirect allowlist, not a user-role or email-verification
 * bypass. Preserve all existing domains and patch only authorizedDomains.
 *
 * API: https://cloud.google.com/identity-platform/docs/reference/rest/v2/projects/updateConfig
 * Dry run by default; --apply is used only by the reviewed main-branch workflow.
 */
import { pathToFileURL } from 'node:url';

const PROJECT_ID = 'fieldproof-sa';
export const PRODUCTION_AUTH_DOMAINS = ['imbewufield.vercel.app', 'permamap-sa.vercel.app'];

export async function configureProductionAuth({ request, apply = false }) {
  // Provider configuration may include a client secret: never print this response.
  const provider = await request('GET', '/defaultSupportedIdpConfigs/google.com');
  if (provider.enabled !== true) throw new Error('GOOGLE_PROVIDER_NOT_ENABLED');
  const config = await request('GET', '/config');
  const current = config.authorizedDomains ?? [];
  if (!Array.isArray(current) || current.some((domain) => typeof domain !== 'string')) {
    throw new Error('INVALID_AUTH_DOMAIN_CONFIG');
  }
  const missing = PRODUCTION_AUTH_DOMAINS.filter((domain) => !current.includes(domain));
  if (apply && missing.length) {
    await request('PATCH', '/config?updateMask=authorizedDomains', {
      authorizedDomains: [...current, ...missing],
    });
  }
  if (apply) {
    const saved = await request('GET', '/config');
    if (![...current, ...PRODUCTION_AUTH_DOMAINS].every((domain) => saved.authorizedDomains?.includes(domain))) {
      throw new Error('AUTH_DOMAIN_READBACK_FAILED');
    }
  }
  return { project: PROJECT_ID, status: apply ? (missing.length ? 'updated' : 'already-configured') : 'dry-run',
    googleEnabled: true, missingBefore: missing, productionDomains: PRODUCTION_AUTH_DOMAINS,
    existingDomainsPreserved: true, verified: apply };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--apply')) throw new Error('UNKNOWN_ARGUMENT');
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('ADMIN_CREDENTIAL_UNAVAILABLE');
  let serviceAccount;
  try { serviceAccount = JSON.parse(raw); } catch { throw new Error('ADMIN_CREDENTIAL_INVALID_JSON'); }
  if (serviceAccount.project_id !== PROJECT_ID) throw new Error('ADMIN_CREDENTIAL_WRONG_PROJECT');
  const { cert } = await import('firebase-admin/app');
  const credential = cert(serviceAccount);
  const { access_token: token } = await credential.getAccessToken();
  const request = async (method, path, body) => {
    const response = await fetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`AUTH_CONFIG_HTTP_${response.status}`);
    return response.json();
  };
  console.log(JSON.stringify(await configureProductionAuth({ request, apply: args.includes('--apply') })));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const code = /^[A-Z_0-9]+$/.test(error.message ?? '') ? error.message : 'AUTH_CONFIG_FAILED';
    console.error(`Production auth configuration failed: ${code}`);
    process.exitCode = 1;
  });
}
