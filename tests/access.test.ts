import { describe, it, expect } from 'vitest';
import { LocalAccess, parseEnvelope } from '../src/services/localAccess';
import { MemoryBackend } from './support';
import { createInitialState } from '../src/state/initialState';
import { createSnapshot } from '../src/backup/snapshot';
import { parseVault } from '../src/storage/schema';
const password = 'My private password 123';
async function profile(backend = new MemoryBackend()) { const access = new LocalAccess(backend); await access.initialize(); await access.create('Ashraf', password); return { access, backend }; }
async function backup(access: LocalAccess) {
  const state = createInitialState(); state.onboarded = true;
  state.brainDump = [{ id: 'private', text: 'My private network activities', at: Date.now() }];
  state.expenses = [{ id: 'lunch', title: 'University lunch', amount: 25, category: 'Food', at: Date.now(), dayKey: state.dayKey }];
  state.studyLog = [{ id: 'study', subject: 'Networks', minutes: 25, task: 'VLAN topology', at: Date.now(), dayKey: state.dayKey }];
  return createSnapshot(state, { accountSubject: access.profile.subject, installationId: 'test-install', revision: 2, parentSnapshotId: null });
}
describe('local password profile and encrypted recovery', () => {
  it('requires the password after reload and never stores the password', async () => {
    const { access, backend } = await profile(); expect(backend.access).not.toContain(password);
    access.lock(); expect(() => access.profile).toThrow(/Unlock/);
    const reloaded = new LocalAccess(backend); await reloaded.initialize(); expect(reloaded.getSnapshot().stage).toBe('locked');
    const original = backend.access;
    await expect(reloaded.unlock('wrong password')).rejects.toThrow(/incorrect/);
    expect(reloaded.getSnapshot().stage).toBe('locked'); expect(backend.access).toBe(original);
    await reloaded.unlock(password); expect(reloaded.profile.name).toBe('Ashraf');
  });
  it('encrypts activities, authenticates metadata, and uses a fresh nonce for each copy', async () => {
    const { access } = await profile(); const snapshot = await backup(access);
    const first = await access.encode(snapshot); const second = await access.encode(snapshot);
    expect(first).not.toContain('My private network activities'); expect(first).not.toContain('University lunch'); expect(first).not.toContain(password);
    expect(parseEnvelope(first).header.iv).not.toBe(parseEnvelope(second).header.iv);
    expect((await access.decode(first)).payload.studyLog[0].task).toBe('VLAN topology');
    const modified = JSON.parse(first); modified.header.profile.name = 'Someone else';
    await expect(access.decode(JSON.stringify(modified))).rejects.toThrow(/incorrect|damaged/);
    const damaged = JSON.parse(first); damaged.ciphertext = 'A' + damaged.ciphertext.slice(1);
    if (damaged.ciphertext === JSON.parse(first).ciphertext) damaged.ciphertext = 'B' + damaged.ciphertext.slice(1);
    await expect(access.decode(JSON.stringify(damaged))).rejects.toThrow(/incorrect|damaged/);
  });
  it('restores the profile and all activities after the entire app container is lost', async () => {
    const original = await profile(); const snapshot = await backup(original.access); const raw = await original.access.encode(snapshot);
    const freshBackend = new MemoryBackend(); const fresh = new LocalAccess(freshBackend); await fresh.initialize();
    await expect(fresh.previewRestore(raw, 'wrong password')).rejects.toThrow(/incorrect/); expect(freshBackend.value).toBeNull();
    await fresh.previewRestore(raw, password);
    expect(freshBackend.value).toBeNull(); expect(freshBackend.access).toBeNull(); expect(fresh.getSnapshot().preview?.name).toBe('Ashraf');
    await fresh.confirmRestore();
    const vault = parseVault(freshBackend.value!); expect(vault.datasets.guest.state.brainDump[0].text).toBe('My private network activities');
    expect(vault.datasets.guest.state.expenses[0].amount).toBe(25); expect(vault.datasets.guest.state.studyLog[0].task).toBe('VLAN topology');
    expect(vault.datasets.guest.enabled).toBe(false); expect(fresh.profile.subject).toBe(original.access.profile.subject);
    fresh.lock(); await fresh.unlock(password); expect(fresh.profile.name).toBe('Ashraf');
  });
  it('preserves existing device bytes when first adding the password', async () => {
    const backend = new MemoryBackend(); backend.value = '{legacy bytes kept for later migration}';
    await profile(backend); expect(backend.value).toBe('{legacy bytes kept for later migration}');
  });
  it('does not replace activities when access metadata is corrupt or a restore is cancelled', async () => {
    const source = await profile(); const raw = await source.access.encode(await backup(source.access));
    const backend = new MemoryBackend(); backend.value = 'existing data'; backend.access = '{broken';
    const access = new LocalAccess(backend); await access.initialize(); expect(access.getSnapshot().stage).toBe('error');
    await access.previewRestore(raw, password); access.cancelRestore();
    expect(backend.value).toBe('existing data'); expect(backend.access).toBe('{broken');
    await expect(access.confirmRestore()).rejects.toThrow(/Review/);
  });
  it('rejects unsupported encryption parameters before password work', async () => {
    const { access } = await profile(); const raw = await access.encode(await backup(access));
    const changed = JSON.parse(raw); changed.header.iterations = 999999999;
    await expect(access.previewRestore(JSON.stringify(changed), password)).rejects.toThrow(/unsupported/);
    await expect(access.previewRestore('{bad', password)).rejects.toThrow(/damaged/);
  });
});
