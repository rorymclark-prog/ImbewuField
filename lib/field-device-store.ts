export type DeviceRow = { key: string; scope: string; kind: 'cache' | 'write' | 'draft'; value: any };
export interface DeviceStore {
  get(key: string): Promise<DeviceRow | undefined>;
  all(scope: string): Promise<DeviceRow[]>;
  change(key: string, update: (row: DeviceRow | undefined) => DeviceRow | undefined): Promise<DeviceRow | undefined>;
}
let connection: Promise<IDBDatabase> | undefined;
function database() {
  if (!connection) connection = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(Error('This browser cannot save fieldwork on this device. Use a normal browser window.')); return; }
    const request = indexedDB.open('imbewu-fieldwork', 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('records', { keyPath: 'key' }).createIndex('scope', 'scope'); };
    request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); connection = undefined; }; resolve(request.result); };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(Error('Close another ImbewuField tab and try saving again.'));
  }).catch(error => { connection = undefined; throw error; });
  return connection;
}
export const fieldDeviceStore: DeviceStore = {
  async get(key) {
    const db = await database();
    return new Promise((resolve, reject) => { const request = db.transaction('records').objectStore('records').get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  },
  async all(scope) {
    const db = await database();
    return new Promise((resolve, reject) => { const request = db.transaction('records').objectStore('records').index('scope').getAll(scope); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  },
  async change(key, update) {
    const db = await database();
    return new Promise((resolve, reject) => {
      // Resolving the request itself is too early: quota failure can still abort the commit.
      const tx = db.transaction('records', 'readwrite'), store = tx.objectStore('records');
      let result: DeviceRow | undefined, failure: unknown;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure ?? tx.error ?? Error('The device could not save this entry. Keep the form open.'));
      tx.onerror = () => {};
      const request = store.get(key);
      request.onsuccess = () => { try { result = update(request.result); if (result) store.put(result); else store.delete(key); } catch (e) { failure = e; tx.abort(); } };
    });
  },
};
