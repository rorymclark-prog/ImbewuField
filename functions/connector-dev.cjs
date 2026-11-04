// Starts the real connector HTTP handler against local emulators, without running render triggers.
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST) throw Error('All three emulators are required.');
const { initializeApp } = require('firebase-admin/app');
initializeApp({ projectId: 'fieldproof-sa', storageBucket: 'fieldproof-sa.appspot.com' });
const { createConnectorApp } = require('./lib/functions/src/connector/http.js');
const { app } = createConnectorApp({ issuer: 'http://127.0.0.1:4246/api/assistant', appOrigin: 'http://127.0.0.1:4246', transferOrigin: 'http://127.0.0.1:5101' });
const express = require('express');
const host = express();
host.use((req, res, next) => {
  if (req.query.connector_path) {
    const url = new URL(req.url, 'http://localhost');
    req.url = req.query.connector_path; url.searchParams.delete('connector_path');
    if (url.search) req.url += url.search;
  }
  next();
});
host.use(app); host.listen(5101, '127.0.0.1', () => console.log('Connector emulator HTTP ready on 5101'));
