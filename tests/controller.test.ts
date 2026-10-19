import { describe, it, expect } from 'vitest';
import { setup, connectAndAdopt, MemoryBackend, FakeAuth, FakeDrive, accountB } from './support';
import { parseVault } from '../src/storage/schema';

describe('backup and restore orchestration', () => {
  it('keeps fresh install uploads gated until the person chooses data', async () => {
    const c = await setup(); await c.controller.connect(); await c.controller.backupNow();
    expect(c.controller.getSnapshot().cloud.stage).toBe('choice'); expect(c.drive.uploads).toBe(0);
    await c.controller.chooseLocal(true); await c.controller.backupNow(); expect(c.drive.uploads).toBe(1);
  });
  it('saves domain changes and the dirty revision together, excluding toast events', async () => {
    const c = await setup(); c.controller.dispatch({ type: 'brain/add', text: 'Do homework' }); await c.repository.flush();
    const before = parseVault(c.backend.value!).datasets.guest;
    expect(before.state.brainDump[0].text).toBe('Do homework'); expect(before.dirty).toBe(true);
    c.controller.dispatch({ type: 'toast/show', text: 'Hello' }); await c.repository.flush();
    expect(parseVault(c.backend.value!).datasets.guest.revision).toBe(before.revision);
  });
  it('does not mark a failed local write or offline upload as backed up', async () => {
    const c = await setup(); await connectAndAdopt(c); c.drive.fail = true; await c.controller.backupNow();
    expect(c.controller.getSnapshot().cloud.dirty).toBe(true); expect(c.controller.getSnapshot().cloud.lastBackupAt).toBeNull();
    c.drive.fail = false; c.backend.fail = true; c.controller.dispatch({ type: 'brain/add', text: 'Unsaved' });
    await c.repository.flush().catch(() => {});
    expect(c.controller.getSnapshot().storageError).toMatch(/not saved/); await c.controller.backupNow(); expect(c.drive.uploads).toBe(0);
    c.backend.fail = false; await c.controller.retrySave(); await c.controller.backupNow(); expect(c.drive.uploads).toBe(1);
  });
  it('skips unchanged data and retains edits arriving during an upload', async () => {
    const c = await setup(); await connectAndAdopt(c);
    c.drive.beforeDownload = async () => { c.drive.beforeDownload = undefined; c.controller.dispatch({ type: 'brain/add', text: 'New during upload' }); };
    await c.controller.backupNow(); expect(c.controller.getSnapshot().cloud.dirty).toBe(true);
    await c.controller.backupNow(); expect(c.controller.getSnapshot().cloud.dirty).toBe(false); expect(c.drive.uploads).toBe(2);
    await c.controller.backupNow(); expect(c.drive.uploads).toBe(2);
  });
  it('restores an existing cloud copy after deleting local data without uploading seeds', async () => {
    const original = await setup(); original.controller.dispatch({ type: 'brain/add', text: 'Keep me after reinstall' }); await connectAndAdopt(original); await original.controller.backupNow();
    const fresh = await setup(new MemoryBackend(), new FakeAuth(), original.drive); await fresh.controller.connect(); await fresh.controller.backupNow();
    expect(original.drive.uploads).toBe(1); expect(fresh.controller.getSnapshot().cloud.stage).toBe('choice');
    await fresh.controller.previewCloud(original.drive.files[0].id); await fresh.controller.restorePreview();
    expect(fresh.controller.getSnapshot().state.brainDump[0].text).toBe('Keep me after reinstall');
    expect(fresh.controller.getSnapshot().cloud.enabled).toBe(false);
  });
  it('isolates accounts and keeps offline data after signing out', async () => {
    const c = await setup(); c.controller.dispatch({ type: 'brain/add', text: 'Offline only' }); await connectAndAdopt(c);
    c.controller.dispatch({ type: 'brain/add', text: 'A private task' }); await c.controller.backupNow();
    await c.controller.signOut(); expect(c.controller.getSnapshot().state.brainDump[0].text).toBe('Offline only');
    c.auth.next = accountB; await c.controller.connect(); expect(c.controller.getSnapshot().state.brainDump).toEqual([]); expect(c.controller.getSnapshot().cloud.files).toEqual([]);
    await c.controller.chooseLocal(false); await c.controller.backupNow();
    expect([...c.drive.data.values()].filter(s => s.accountSubject === accountB.subject)[0].payload.brainDump).toEqual([]);
  });
  it('does not overwrite cloud data from another installation', async () => {
    const c = await setup(); await connectAndAdopt(c); await c.controller.backupNow();
    const second = await setup(new MemoryBackend(), new FakeAuth(), c.drive); await second.controller.connect(); await second.controller.chooseLocal(false); await second.controller.backupNow();
    c.controller.dispatch({ type: 'brain/add', text: 'First device change' }); await c.controller.backupNow();
    expect(c.controller.getSnapshot().cloud.stage).toBe('choice'); expect(c.drive.uploads).toBe(2);
  });
  it('pauses cloud backup on local reset and keeps a rollback copy', async () => {
    const c = await setup(); await connectAndAdopt(c); c.controller.dispatch({ type: 'brain/add', text: 'Before reset' }); await c.controller.backupNow();
    c.controller.dispatch({ type: 'system/reset' }); await c.repository.flush(); await c.controller.backupNow();
    expect(c.drive.uploads).toBe(1); expect(c.controller.getSnapshot().cloud.enabled).toBe(false);
    await c.controller.restoreRollback(); expect(c.controller.getSnapshot().state.brainDump[0].text).toBe('Before reset');
  });
  it('requires an explicit preview confirmation for imports and keeps a rollback', async () => {
    const c = await setup(); c.controller.dispatch({ type: 'brain/add', text: 'Exported' }); const file = await c.controller.exportData();
    c.controller.dispatch({ type: 'brain/add', text: 'Current' }); await c.controller.previewImport(file);
    expect(c.controller.getSnapshot().state.brainDump[0].text).toBe('Current'); await c.controller.restorePreview();
    expect(c.controller.getSnapshot().state.brainDump[0].text).toBe('Exported'); await c.controller.restoreRollback(); expect(c.controller.getSnapshot().state.brainDump[0].text).toBe('Current');
  });
  it('blocks corrupt local data and recovers without discarding the original bytes', async () => {
    const backend = new MemoryBackend(); backend.value = '{broken'; const broken = await setup(backend);
    expect(broken.controller.getSnapshot().blocked).toBe(true); expect(await broken.controller.exportOriginal()).toBe('{broken');
    const good = await setup(); const file = await good.controller.exportData(); await broken.controller.previewImport(file); await broken.controller.restorePreview();
    expect(broken.controller.getSnapshot().blocked).toBe(false); expect(await broken.controller.exportOriginal()).toBe('{broken');
  });
});
