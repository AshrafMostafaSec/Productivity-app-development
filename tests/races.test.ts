import { it, expect } from 'vitest';
import { setup, enableBackups } from './support';
it('deduplicates a file whose successful write was interrupted before acknowledgment', async () => {
  const c = await setup(); await enableBackups(c);
  c.drive.beforeDownload = async () => { c.drive.beforeDownload = undefined; throw new Error('Provider disconnected after write'); };
  await c.controller.backupNow(); expect(c.drive.uploads).toBe(1); expect(c.controller.getSnapshot().backup.dirty).toBe(true);
  await c.controller.backupNow(); expect(c.drive.uploads).toBe(1); expect(c.controller.getSnapshot().backup.dirty).toBe(false);
});
it('leaves newer revisions pending when backup is paused mid-write', async () => {
  const c = await setup(); await enableBackups(c);
  c.drive.beforeDownload = async () => { c.drive.beforeDownload = undefined; await c.controller.setAutoBackup(false); };
  await c.controller.backupNow(); expect(c.controller.getSnapshot().backup.enabled).toBe(false); expect(c.controller.getSnapshot().backup.dirty).toBe(true);
});
it('permits explicit backup when automatic backup is paused', async () => {
  const c = await setup(); await enableBackups(c); await c.controller.setAutoBackup(false);
  await c.controller.backupNow(); expect(c.drive.uploads).toBe(0);
  await c.controller.backupNow(true); expect(c.drive.uploads).toBe(1); expect(c.controller.getSnapshot().backup.enabled).toBe(false);
});
it('never acknowledges an in-flight copy after the controller is locked/disposed', async () => {
  const c = await setup(); await enableBackups(c); let release!: () => void; let entered!: () => void;
  const pause = new Promise<void>(r => { release = r; }); const waiting = new Promise<void>(r => { entered = r; });
  c.drive.beforeDownload = async () => { entered(); await pause; };
  const task = c.controller.backupNow(); await waiting; c.controller.dispose(); release(); await task;
  expect(c.controller.getSnapshot().backup.lastBackupAt).toBeNull(); expect(c.controller.getSnapshot().backup.dirty).toBe(true);
});
