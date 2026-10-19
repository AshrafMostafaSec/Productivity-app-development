import { it, expect } from 'vitest';
import { setup, connectAndAdopt } from './support';
import { parseVault } from '../src/storage/schema';

it('does not acknowledge a backup into a different account after sign-out', async () => {
  const c = await setup(); await connectAndAdopt(c);
  let release!: () => void; let entered!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const downloading = new Promise<void>(resolve => { entered = resolve; });
  c.drive.beforeDownload = async () => { entered(); await pending; };
  const upload = c.controller.backupNow(); await downloading; await c.controller.signOut(); release(); await upload;
  expect(c.controller.getSnapshot().account).toBeNull(); expect(c.controller.getSnapshot().cloud.lastBackupAt).toBeNull();
  expect(parseVault(c.backend.value!).datasets.guest.lastBackupAt).toBeNull();
});
it('deduplicates a successful cloud upload whose acknowledgment was interrupted', async () => {
  const c = await setup(); await connectAndAdopt(c);
  c.drive.beforeDownload = async () => { c.drive.beforeDownload = undefined; throw new Error('Connection lost after upload'); };
  await c.controller.backupNow(); expect(c.drive.uploads).toBe(1); expect(c.controller.getSnapshot().cloud.dirty).toBe(true);
  await c.controller.backupNow(); expect(c.drive.uploads).toBe(1); expect(c.controller.getSnapshot().cloud.dirty).toBe(false);
});
it('never exposes another account’s rollback dataset', async () => {
  const c = await setup(); await connectAndAdopt(c); c.controller.dispatch({ type: 'brain/add', text: 'A private data' });
  c.controller.dispatch({ type: 'system/reset' }); await c.repository.flush(); await c.controller.signOut();
  c.auth.next = { subject: 'other', name: 'Other person', email: 'other@example.com' }; await c.controller.connect();
  await expect(c.controller.restoreRollback()).rejects.toThrow(/no previous/);
});
it('leaves a newer revision pending if automatic backup is paused mid-upload', async () => {
  const c = await setup(); await connectAndAdopt(c);
  c.drive.beforeDownload = async () => { c.drive.beforeDownload = undefined; await c.controller.setAutoBackup(false); };
  await c.controller.backupNow(); expect(c.controller.getSnapshot().cloud.enabled).toBe(false); expect(c.controller.getSnapshot().cloud.dirty).toBe(true);
});
it('supports an explicit manual backup while automatic backup is paused', async () => {
  const c = await setup(); await connectAndAdopt(c); await c.controller.setAutoBackup(false);
  await c.controller.backupNow(); expect(c.drive.uploads).toBe(0);
  await c.controller.backupNow(true); expect(c.drive.uploads).toBe(1); expect(c.controller.getSnapshot().cloud.enabled).toBe(false);
});
