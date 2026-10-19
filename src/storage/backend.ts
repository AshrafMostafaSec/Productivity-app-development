import { openDB, type IDBPDatabase } from 'idb';
import { isIOS, Native } from '../platform/native';
import { MAX_BYTES } from './schema';

export interface Backend {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  previous(): Promise<string | null>;
  original?(): Promise<string | null>;
  preserveOriginal?(value: string): Promise<void>;
  readAccess(): Promise<string | null>;
  writeAccess(value: string): Promise<void>;
}

export class BrowserBackend implements Backend {
  private db?: Promise<IDBPDatabase>;
  private lease?: Promise<void>;
  private async acquire() {
    if (typeof window === 'undefined' || !navigator.locks) return;
    this.lease ??= new Promise<void>((resolve, reject) => {
      void navigator.locks.request('anchoros-device-writer', { ifAvailable: true }, async lock => {
        if (!lock) { reject(new Error('AnchorOS is open in another window. Close that window, then try again.')); return; }
        resolve();
        // The browser releases this lock when this document closes. Keep one writer per origin.
        await new Promise<void>(() => {});
      }).catch(reject);
    });
    try { await this.lease; } catch (error) { this.lease = undefined; throw error; }
  }
  private async connect() {
    await this.acquire();
    this.db ??= openDB('anchoros', 1, { upgrade(db) { db.createObjectStore('vault'); } });
    return this.db;
  }
  async read() { return ((await this.connect()).get('vault', 'current')) as Promise<string | null>; }
  async previous() { return ((await this.connect()).get('vault', 'previous')) as Promise<string | null>; }
  async original() { return ((await this.connect()).get('vault', 'original')) as Promise<string | null>; }
  async readAccess() { return ((await this.connect()).get('vault', 'access')) as Promise<string | null>; }
  async writeAccess(value: string) { await (await this.connect()).put('vault', value, 'access'); }
  async preserveOriginal(value: string) { const db = await this.connect(); const tx = db.transaction('vault', 'readwrite'); if ((await tx.store.get('original')) == null) await tx.store.put(value, 'original'); await tx.done; }
  async write(value: string) {
    if (new TextEncoder().encode(value).byteLength > MAX_BYTES) throw new Error('Device storage limit reached. Export your data before continuing.');
    const db = await this.connect();
    const tx = db.transaction('vault', 'readwrite');
    const previous = await tx.store.get('current');
    if (previous) await tx.store.put(previous, 'previous');
    await tx.store.put(value, 'current');
    await tx.done;
  }
}
export function deviceBackend(): Backend {
  return isIOS() ? {
    read: async () => (await Native.readData()).value,
    previous: async () => (await Native.readPreviousData()).value,
    write: value => Native.writeData({ value }),
    original: async () => (await Native.readOriginalData()).value,
    preserveOriginal: value => Native.preserveOriginalData({ value }),
    readAccess: async () => (await Native.readAccessData()).value,
    writeAccess: value => Native.writeAccessData({ value }),
  } : new BrowserBackend();
}
