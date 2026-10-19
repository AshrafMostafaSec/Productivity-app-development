import { describe, it, expect } from 'vitest';
import { setup, enableBackups, MemoryBackend, FakeIdentity, MemoryFiles, active } from './support';
import { createInitialState } from '../src/state/initialState';
import { newDataset } from '../src/storage/schema';

describe('local file backup and restore', () => {
  it('keeps an existing folder gated until its activities are reviewed', async () => {
    const c = await setup(); await c.controller.backupNow();
    expect(c.controller.getSnapshot().backup.stage).toBe('choice'); expect(c.drive.uploads).toBe(0);
    await enableBackups(c); await c.controller.backupNow(); expect(c.drive.uploads).toBe(1);
  });
  it('uses device data immediately without any remote sign-in', async () => {
    const backend = new MemoryBackend(); const files = new MemoryFiles(); files.configured = false;
    const c = await setup(backend, new FakeIdentity(), files);
    expect(c.controller.getSnapshot().account?.name).toBe('Ashraf');
    expect(c.controller.getSnapshot().backup.stage).toBe('disconnected');
    c.controller.dispatch({ type: 'brain/add', text: 'Offline activity' }); await c.repository.flush();
    expect(active(c.backend).state.brainDump[0].text).toBe('Offline activity'); expect(files.uploads).toBe(0);
  });
  it('automatically verifies the first backup when an empty folder is chosen', async () => {
    const files = new MemoryFiles(); files.configured = false; const c = await setup(undefined, undefined, files);
    c.controller.dispatch({ type: 'brain/add', text: 'Before folder selection' }); await c.repository.flush();
    await c.controller.selectFolder();
    expect(files.uploads).toBe(1); expect(c.controller.getSnapshot().backup.dirty).toBe(false);
    expect([...files.data.values()][0].payload.brainDump[0].text).toBe('Before folder selection');
  });
  it('preserves legacy active activities and rollback when a local profile replaces the old identity', async () => {
    const state = createInitialState(); state.brainDump = [{ id: 'old', text: 'Legacy activities', at: Date.now() }];
    const backend = new MemoryBackend(); const rollback = createInitialState(); rollback.balance = 99;
    backend.value = JSON.stringify({ format: 1, installationId: 'old-install', activeScope: 'legacy:old', datasets: { guest: newDataset(), 'legacy:old': { ...newDataset(state), rollback } }, accounts: {} });
    const c = await setup(backend); expect(c.controller.getSnapshot().state.brainDump[0].text).toBe('Legacy activities');
    await c.controller.restoreRollback(); expect(c.controller.getSnapshot().state.balance).toBe(99);
  });
  it('saves changes and dirty revision together, excluding toast events', async () => {
    const c = await setup(); c.controller.dispatch({ type: 'brain/add', text: 'Do homework' }); await c.repository.flush();
    const before = active(c.backend); expect(before.state.brainDump[0].text).toBe('Do homework'); expect(before.dirty).toBe(true);
    c.controller.dispatch({ type: 'toast/show', text: 'Hello' }); await c.repository.flush(); expect(active(c.backend).revision).toBe(before.revision);
  });
  it('does not acknowledge a failed local save or inaccessible backup folder', async () => {
    const c = await setup(); await enableBackups(c); c.drive.fail = true; await c.controller.backupNow();
    expect(c.controller.getSnapshot().backup.dirty).toBe(true); expect(c.controller.getSnapshot().backup.lastBackupAt).toBeNull();
    c.drive.fail = false; c.backend.fail = true; c.controller.dispatch({ type: 'brain/add', text: 'Unsaved' }); await c.repository.flush().catch(() => {});
    expect(c.controller.getSnapshot().storageError).toMatch(/not saved/); await c.controller.backupNow(); expect(c.drive.uploads).toBe(0);
    c.backend.fail = false; await c.controller.retrySave(); await c.controller.backupNow(); expect(c.drive.uploads).toBe(1);
  });
  it('recovers an acknowledgment whose local save failed without writing another copy', async () => {
    const c = await setup(); await enableBackups(c);
    c.drive.beforeDownload = async () => { c.drive.beforeDownload = undefined; c.backend.fail = true; };
    await c.controller.backupNow(); c.backend.fail = false; await c.controller.retrySave(); await c.controller.backupNow();
    expect(c.controller.getSnapshot().backup.dirty).toBe(false); expect(c.drive.uploads).toBe(1);
  });
  it('retains edits arriving during a backup and skips unchanged data', async () => {
    const c = await setup(); await enableBackups(c);
    c.drive.beforeDownload = async () => { c.drive.beforeDownload = undefined; c.controller.dispatch({ type: 'brain/add', text: 'New during backup' }); };
    await c.controller.backupNow(); expect(c.controller.getSnapshot().backup.dirty).toBe(true);
    await c.controller.backupNow(); expect(c.controller.getSnapshot().backup.dirty).toBe(false); expect(c.drive.uploads).toBe(2);
    await c.controller.backupNow(); expect(c.drive.uploads).toBe(2);
  });
  it('restores existing activities after reinstalling without replacing files with seeds', async () => {
    const original = await setup(); original.controller.dispatch({ type: 'brain/add', text: 'Keep me after reinstall' }); await enableBackups(original); await original.controller.backupNow();
    const fresh = await setup(new MemoryBackend(), new FakeIdentity(), original.drive); await fresh.controller.backupNow();
    expect(original.drive.uploads).toBe(1); expect(fresh.controller.getSnapshot().backup.stage).toBe('choice');
    await fresh.controller.previewBackup(original.drive.files[0].id); await fresh.controller.restorePreview();
    expect(fresh.controller.getSnapshot().state.brainDump[0].text).toBe('Keep me after reinstall'); expect(fresh.controller.getSnapshot().backup.enabled).toBe(false);
  });
  it('does not overwrite changes from another installation', async () => {
    const c = await setup(); await enableBackups(c); await c.controller.backupNow();
    const second = await setup(new MemoryBackend(), new FakeIdentity(), c.drive); await second.controller.chooseLocal(false); await second.controller.backupNow();
    c.controller.dispatch({ type: 'brain/add', text: 'First device change' }); await c.controller.backupNow();
    expect(c.controller.getSnapshot().backup.stage).toBe('choice'); expect(c.drive.uploads).toBe(2);
  });
  it('pauses backup on reset and retains rollback activities', async () => {
    const c = await setup(); await enableBackups(c); c.controller.dispatch({ type: 'brain/add', text: 'Before reset' }); await c.controller.backupNow();
    c.controller.dispatch({ type: 'system/reset' }); await c.repository.flush(); await c.controller.backupNow();
    expect(c.drive.uploads).toBe(1); expect(c.controller.getSnapshot().backup.enabled).toBe(false);
    await c.controller.restoreRollback(); expect(c.controller.getSnapshot().state.brainDump[0].text).toBe('Before reset');
  });
  it('requires explicit confirmation for a portable restore and keeps a rollback', async () => {
    const c = await setup(); c.controller.dispatch({ type: 'brain/add', text: 'Exported' }); const file = await c.controller.exportData();
    c.controller.dispatch({ type: 'brain/add', text: 'Current' }); await c.controller.previewImport(file);
    expect(c.controller.getSnapshot().state.brainDump[0].text).toBe('Current'); await c.controller.restorePreview();
    expect(c.controller.getSnapshot().state.brainDump[0].text).toBe('Exported'); await c.controller.restoreRollback(); expect(c.controller.getSnapshot().state.brainDump[0].text).toBe('Current');
  });
  it('keeps corrupt device bytes available during recovery', async () => {
    const backend = new MemoryBackend(); backend.value = '{broken'; const c = await setup(backend);
    expect(c.controller.getSnapshot().blocked).toBe(true); expect(await c.controller.exportOriginal()).toBe('{broken');
    const good = await setup(); await c.controller.previewImport(await good.controller.exportData()); await c.controller.restorePreview();
    expect(c.controller.getSnapshot().blocked).toBe(false); expect(await c.controller.exportOriginal()).toBe('{broken');
  });
});
