import type { Backend } from '../src/storage/backend';
import type { Identity } from '../src/services/localIdentity';
import type { FilesDestination, BackupFile } from '../src/services/filesBackup';
import { parseVault, type Account } from '../src/storage/schema';
import { readSnapshot, snapshotText, type Snapshot } from '../src/backup/snapshot';
import { Repository } from '../src/storage/repository';
import { AppController } from '../src/state/controller';
export class MemoryBackend implements Backend {
  value: string | null = null; old: string | null = null; broken: string | null = null; access: string | null = null; fail = false;
  async read() { return this.value; }
  async write(value: string) { if (this.fail) throw new Error('Disk full'); this.old = this.value; this.value = value; }
  async previous() { return this.old; }
  async original() { return this.broken; }
  async preserveOriginal(value: string) { this.broken ??= value; }
  async readAccess() { return this.access; }
  async writeAccess(value: string) { if (this.fail) throw new Error('Disk full'); this.access = value; }
}
export const accountA: Account = { subject: 'd77b01f4-9249-4d18-86a6-b01ead362dc1', name: 'Ashraf', email: '' };
export class FakeIdentity implements Identity {
  current: Account = accountA;
  async status() { return { configured: true, account: this.current }; }
}
export class MemoryFiles implements FilesDestination {
  files: BackupFile[] = []; data = new Map<string, Snapshot>(); uploads = 0; fail = false; configured = true; token = 'folder-a';
  beforeDownload?: () => Promise<void>;
  async status() { return { configured: this.configured, name: this.configured ? 'Backups' : null, token: this.configured ? this.token : null }; }
  async select() { this.configured = true; this.token = crypto.randomUUID(); return this.status(); }
  async list(_subject: string) { if (this.fail) throw new Error('Folder unavailable'); return this.files; }
  async download(subject: string, file: BackupFile) { await this.beforeDownload?.(); const data = this.data.get(file.id); if (!data || data.accountSubject !== subject) throw new Error('Wrong profile or damaged backup'); return structuredClone(data); }
  async upload(_subject: string, snapshot: Snapshot) {
    if (this.fail) throw new Error('Folder unavailable'); this.uploads++;
    const file: BackupFile = { id: crypto.randomUUID(), name: 'backup.anchorbackup', createdTime: new Date().toISOString(), appProperties: { app: 'anchoros', format: '1', installation: snapshot.installationId, revision: String(snapshot.revision), hash: snapshot.payloadSha256 } };
    this.files.unshift(file); this.data.set(file.id, structuredClone(snapshot)); return file;
  }
  async remove(_subject: string, id: string) { this.files = this.files.filter(f => f.id !== id); this.data.delete(id); }
  async encode(snapshot: Snapshot) { return snapshotText(snapshot); } // Controller tests inject a transport; cryptography has separate real tests.
  async decode(raw: string) { return readSnapshot(raw); }
}
export async function setup(backend = new MemoryBackend(), auth = new FakeIdentity(), drive = new MemoryFiles(), autoSchedule = false) {
  const repository = new Repository(backend); const controller = new AppController(repository, auth, drive, autoSchedule);
  await controller.initialize(); return { backend, auth, drive, repository, controller };
}
export async function enableBackups(c: Awaited<ReturnType<typeof setup>>) { await c.controller.chooseLocal(false); }
export function active(backend: MemoryBackend) { const vault = parseVault(backend.value!); return vault.datasets[vault.activeScope]; }
