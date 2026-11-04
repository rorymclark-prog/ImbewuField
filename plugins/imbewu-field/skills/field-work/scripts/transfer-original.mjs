#!/usr/bin/env node
// Transfer only the explicitly supplied original. No directory traversal, source discovery,
// OAuth-token harvesting or credential storage is part of this helper.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const [file, preparationFile] = process.argv.slice(2);
if (!file || !preparationFile) throw Error('Usage: node transfer-original.mjs <authorised-original-path> <prepare-upload-response.json>');
const prepared = JSON.parse(await readFile(preparationFile, 'utf8'));
const upload = prepared.structuredContent ?? prepared;
if (upload.status === 'complete') { console.log(JSON.stringify({status:'already_complete',assetId:upload.assetId})); process.exit(0); }
const url = new URL(upload.uploadUrl);
const production = url.origin === 'https://europe-west1-fieldproof-sa.cloudfunctions.net' && url.pathname.startsWith('/imbewuConnector/upload/');
const localTest = process.env.IMBEWU_CONNECTOR_EMULATOR === '1' && url.origin === 'http://127.0.0.1:5101' && url.pathname.startsWith('/upload/');
if ((!production && !localTest) || url.username || url.password || url.search || url.hash || !/\/upload\/[A-Za-z0-9_-]{43}$/.test(url.pathname)) throw Error('The upload destination is not the ImbewuField original-file endpoint.');
if (upload.expiresAt <= Date.now()) throw Error('The upload expired. Prepare a fresh upload with a new retry key.');
const bytes = await readFile(file);
if (!bytes.length || bytes.length > upload.maxBytes) throw Error('File size is outside this upload limit.');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const response = await fetch(url, {method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:bytes,redirect:'error',signal:AbortSignal.timeout(120000)});
if (!response.ok) throw Error(`Upload was not confirmed (${response.status}). ${await response.text()}`);
const result = await response.json();
if (result.sha256 !== sha256 || result.assetId !== upload.assetId) throw Error('Upload acknowledgement does not match the original.');
console.log(JSON.stringify({...result,next:'Call finish_upload with the original uploadId. Bytes received is not yet an attachment.'}));
