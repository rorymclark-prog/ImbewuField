#!/usr/bin/env node

import { createRequire } from 'node:module';
import {
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_BUCKET = 'fieldproof-sa.firebasestorage.app';

export function isPathInside(parentPath, candidatePath) {
  const rel = relative(resolve(parentPath), resolve(candidatePath));
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

/**
 * The real hazard is a credential that could be COMMITTED, not one that merely sits inside the
 * working tree — this repo deliberately keeps `serviceAccount.json` at its root and relies on
 * .gitignore, so "inside the repo" alone refused the only credential that exists and made this
 * tool unrunnable. Fails closed: an unknown ignore status is treated as not-ignored.
 */
export function shouldRefuseServiceAccount({ inside, ignored }) {
  return inside && !ignored;
}

/** True only when git itself confirms the path is ignored. Any failure answers false. */
export function isIgnoredByGit(repositoryRoot, filePath, run = spawnSync) {
  try {
    const res = run('git', ['-C', repositoryRoot, 'check-ignore', '--quiet', filePath], {
      stdio: 'ignore',
    });
    return res.status === 0;
  } catch {
    return false;
  }
}

export function resolveJobSuffixes(jobIds, requestedSuffixes) {
  return requestedSuffixes.map((suffix) => {
    const matches = jobIds.filter((jobId) => jobId.endsWith(suffix));
    if (matches.length !== 1) {
      throw new Error(
        `Job suffix "${suffix}" matched ${matches.length} jobs; expected exactly one`,
      );
    }
    return matches[0];
  });
}

function parseArgs(argv) {
  const options = {
    adminDir: '',
    bucket: DEFAULT_BUCKET,
    jobSuffixes: [],
    outDir: '',
    serviceAccount: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    i += 1;
    if (flag === '--admin-dir') options.adminDir = value;
    else if (flag === '--bucket') options.bucket = value;
    else if (flag === '--job-suffix') options.jobSuffixes.push(value);
    else if (flag === '--out-dir') options.outDir = value;
    else if (flag === '--service-account') options.serviceAccount = value;
    else throw new Error(`Unknown argument: ${flag}`);
  }

  for (const key of ['adminDir', 'outDir', 'serviceAccount']) {
    if (!options[key]) throw new Error(`Missing required --${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`);
  }
  if (options.jobSuffixes.length === 0) {
    throw new Error('Pass at least one --job-suffix');
  }
  return options;
}

function requireFirebaseAdmin(adminDir) {
  const absoluteDir = realpathSync(adminDir);
  const requireFromAdmin = createRequire(join(absoluteDir, 'package.json'));
  return {
    app: requireFromAdmin('firebase-admin/app'),
    firestore: requireFromAdmin('firebase-admin/firestore'),
    storage: requireFromAdmin('firebase-admin/storage'),
  };
}

function safeSheetName(index, sheet) {
  const key = typeof sheet.key === 'string' ? sheet.key : `sheet-${index + 1}`;
  return `${String(index + 1).padStart(2, '0')}-${key.replace(/[^A-Za-z0-9_-]/g, '_')}`;
}

export async function fetchStoredRenders(options) {
  const repositoryRoot = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
  const outDir = resolve(options.outDir);
  const serviceAccountPath = realpathSync(options.serviceAccount);

  if (isPathInside(repositoryRoot, outDir)) {
    throw new Error('Refusing to write paid-render artifacts inside the repository');
  }
  if (shouldRefuseServiceAccount({
    inside: isPathInside(repositoryRoot, serviceAccountPath),
    ignored: isIgnoredByGit(repositoryRoot, serviceAccountPath),
  })) {
    throw new Error(
      'Refusing to read a service-account file that is inside the repository and NOT git-ignored — '
      + 'it could be committed. Add it to .gitignore or move it outside the repo.',
    );
  }

  mkdirSync(outDir, { recursive: true });
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  const admin = requireFirebaseAdmin(options.adminDir);
  const app = admin.app.initializeApp({
    credential: admin.app.cert(serviceAccount),
    storageBucket: options.bucket,
  }, `stored-render-audit-${Date.now()}`);

  try {
    const db = admin.firestore.getFirestore(app);
    const snapshot = await db.collection('render_jobs').get();
    const requestedJobIds = resolveJobSuffixes(
      snapshot.docs.map((doc) => doc.id),
      options.jobSuffixes,
    );
    const docsById = new Map(snapshot.docs.map((doc) => [doc.id, doc]));
    const bucket = admin.storage.getStorage(app).bucket(options.bucket);
    const manifest = [];

    for (const jobId of requestedJobIds) {
      const jobDoc = docsById.get(jobId);
      const data = jobDoc.data();
      const jobDir = join(outDir, jobId);
      mkdirSync(jobDir, { recursive: true });
      const sheets = Array.isArray(data.sheets) ? data.sheets : [];
      const safeSheets = [];

      for (let index = 0; index < sheets.length; index += 1) {
        const sheet = sheets[index] ?? {};
        const name = safeSheetName(index, sheet);
        const imagePaths = {};
        for (const [field, basename] of [
          ['inputPath', `${name}-input.jpg`],
          ['outputPath', `${name}-output.png`],
          ['protectMaskPath', `${name}-mask.png`],
        ]) {
          const storagePath = sheet[field];
          if (typeof storagePath !== 'string' || storagePath.length === 0) continue;
          const destination = join(jobDir, basename);
          await bucket.file(storagePath).download({ destination });
          imagePaths[field] = destination;
        }

        const promptPath = join(jobDir, `${name}-prompt.txt`);
        writeFileSync(promptPath, typeof sheet.prompt === 'string' ? sheet.prompt : '', 'utf8');
        safeSheets.push({
          key: sheet.key ?? null,
          label: sheet.label ?? null,
          status: sheet.status ?? null,
          resultKind: sheet.resultKind ?? null,
          showcase: sheet.showcase === true,
          geometryLock: typeof sheet.geometryLock === 'boolean' ? sheet.geometryLock : null,
          useProtectMaskForEdit:
            typeof sheet.useProtectMaskForEdit === 'boolean'
              ? sheet.useProtectMaskForEdit
              : null,
          promptPath,
          imagePaths,
        });
      }

      manifest.push({
        jobId,
        style: data.style ?? null,
        engine: data.engine ?? null,
        status: data.status ?? null,
        sheets: safeSheets,
      });
    }

    const manifestPath = join(outDir, 'manifest.json');
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    return { jobCount: manifest.length, manifestPath };
  } finally {
    await admin.app.deleteApp(app);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await fetchStoredRenders(options);
  process.stdout.write(`Downloaded ${result.jobCount} job(s) to ${result.manifestPath}\n`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
