import type { Backend } from '../src/storage/backend';
import type { Auth } from '../src/services/googleAuth';
import type { Drive, CloudFile } from '../src/services/googleDrive';
import type { Account } from '../src/storage/schema';
import type { Snapshot } from '../src/backup/snapshot';
import { Repository } from '../src/storage/repository';
import { AppController } from '../src/state/controller';
export class MemoryBackend implements Backend {
  value: string | null = null; old: string | null = null; broken: string | null = null; fail = false;
  async read() { return this.value; }
  async write(value: string) { if (this.fail) throw new Error('Disk full'); this.old = this.value; this.value = value; }
  async previous() { return this.old; }
  async original() { return this.broken; }
  async preserveOriginal(value: string) { this.broken ??= value; }
}
export const accountA: Account = { subject: 'google-subject-a', name: 'Person A', email: 'a@example.com' };
export const accountB: Account = { subject: 'google-subject-b', name: 'Person B', email: 'b@example.com' };
export class FakeAuth implements Auth {
  current: Account | null = null; next = accountA;
  async status() { return { configured: true, account: this.current }; }
  async signIn() { this.current = this.next; return this.next; }
  async authorizeDrive() {}
  async token(subject: string) { if (this.current?.subject !== subject) throw new Error('Wrong account'); return 'test-token'; }
  async signOut() { this.current = null; }
}
export class FakeDrive implements Drive {
  files: CloudFile[] = []; data = new Map<string, Snapshot>(); uploads = 0; fail = false;
  beforeDownload?: () => Promise<void>;
  private owns(subject: string, file: CloudFile) { return this.data.get(file.id)?.accountSubject === subject; }
  async list(subject: string) { if (this.fail) throw new Error('Offline'); return this.files.filter(f => this.owns(subject, f)); }
  async download(subject: string, file: CloudFile) { await this.beforeDownload?.(); const data = this.data.get(file.id); if (!data || data.accountSubject !== subject) throw new Error('Wrong account or damaged backup'); return structuredClone(data); }
  async upload(subject: string, snapshot: Snapshot) {
    if (this.fail) throw new Error('Offline');
    this.uploads++;
    const file: CloudFile = { id: crypto.randomUUID(), name: 'backup.json', createdTime: new Date().toISOString(), appProperties: { app: 'anchoros', format: '1', installation: snapshot.installationId, revision: String(snapshot.revision), hash: snapshot.payloadSha256 } };
    this.files.unshift(file); this.data.set(file.id, structuredClone(snapshot)); return file;
  }
  async remove(_subject: string, id: string) { this.files = this.files.filter(f => f.id !== id); this.data.delete(id); }
}
export async function setup(backend = new MemoryBackend(), auth = new FakeAuth(), drive = new FakeDrive(), autoSchedule = false) {
  const repository = new Repository(backend);
  const controller = new AppController(repository, auth, drive, autoSchedule);
  await controller.initialize();
  return { backend, auth, drive, repository, controller };
}
export async function connectAndAdopt(ctx: Awaited<ReturnType<typeof setup>>) {
  await ctx.controller.connect();
  await ctx.controller.chooseLocal(true);
}
