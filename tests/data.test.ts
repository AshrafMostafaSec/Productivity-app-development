import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/state/initialState';
import { parseState, parseJson, parseVault } from '../src/storage/schema';
import { Repository } from '../src/storage/repository';
import { createSnapshot, readSnapshot, snapshotText, digest } from '../src/backup/snapshot';
import { MemoryBackend } from './support';

describe('validated state and migration', () => {
  it('accepts a complete state and rejects invalid nested data', () => {
    const state = createInitialState(); expect(parseState(state)).toEqual(state);
    expect(() => parseState({ ...state, prayers: { fajr: { status: 'invalid' } } })).toThrow();
    expect(() => parseState({ ...state, budget: { daily: -1, currency: 'EGP' } })).toThrow();
    expect(() => parseState({ ...state, dayKey: '2026-02-31' })).toThrow();
  });
  it('migrates v1 known fields and fills nested defaults', () => {
    const migrated = parseState({ version: 1, balance: 78, focus: { old: true }, quran: { pagesToday: 4 } });
    expect(migrated.version).toBe(2); expect(migrated.balance).toBe(78); expect(migrated.quran.goalPages).toBe(2); expect(migrated.quran.pagesToday).toBe(4);
  });
  it('rejects future versions, malformed JSON, dangerous record keys, and oversize input', () => {
    expect(() => parseState({ version: 3 })).toThrow(/version/);
    expect(() => parseJson('{')).toThrow(/JSON/);
    expect(() => parseJson('x'.repeat(8 * 1024 * 1024 + 1))).toThrow(/large/);
    expect(() => parseState({ ...createInitialState(), habits: JSON.parse('{"__proto__":true}') })).toThrow();
  });
});
describe('transactional repository', () => {
  it('preserves an empty device file as damaged data instead of creating seeds', async () => {
    const backend = new MemoryBackend(); backend.value = '';
    await expect(new Repository(backend).load()).rejects.toThrow(/JSON/);
    expect(backend.value).toBe(''); expect(backend.broken).toBe('');
  });
  it('preserves an empty legacy save instead of replacing it', async () => {
    const backend = new MemoryBackend(); const repository = new Repository(backend, () => '');
    await expect(repository.load()).rejects.toThrow(/JSON/);
    expect(backend.value).toBeNull(); expect(await repository.original()).toBe('');
  });
  it('migrates legacy data without deleting the original', async () => {
    const old = JSON.stringify({ ...createInitialState(), balance: 99 });
    const backend = new MemoryBackend(); const repository = new Repository(backend, () => old);
    const vault = await repository.load(); expect(vault.datasets.guest.state.balance).toBe(99); expect(vault.datasets.guest.dirty).toBe(true);
    expect(parseVault(backend.value!).datasets.guest.hasEdits).toBe(true);
  });
  it('preserves malformed data instead of silently overwriting it', async () => {
    const backend = new MemoryBackend(); backend.value = '{broken';
    await expect(new Repository(backend).load()).rejects.toThrow();
    expect(backend.value).toBe('{broken'); expect(backend.broken).toBe('{broken');
  });
  it('serializes queued writes and recovers from a storage failure', async () => {
    const backend = new MemoryBackend(); const repository = new Repository(backend); const vault = await repository.load();
    vault.datasets.guest.revision = 1; const first = repository.save(vault);
    vault.datasets.guest.revision = 2; const second = repository.save(vault); await Promise.all([first, second]);
    expect(parseVault(backend.value!).datasets.guest.revision).toBe(2);
    backend.fail = true; await expect(repository.save(vault)).rejects.toThrow('Disk full');
    backend.fail = false; await repository.save(vault); expect(parseVault(backend.value!).datasets.guest.revision).toBe(2);
  });
});
describe('portable snapshots', () => {
  const meta = { accountSubject: 'person-a', installationId: 'device-1', revision: 4, parentSnapshotId: null };
  it('round-trips all product data and strips transient state', async () => {
    const state = createInitialState(); state.ringingAlarm = 'alarm'; state.notified = { example: true }; state.apps[0].unlockedUntil = Date.now();
    const snapshot = await createSnapshot(state, meta); const restored = await readSnapshot(snapshotText(snapshot), 'person-a');
    expect(restored.payload.ringingAlarm).toBeNull(); expect(restored.payload.notified).toEqual({}); expect(restored.payload.apps[0].unlockedUntil).toBeNull();
    expect(restored.payload.routines).toEqual(state.routines);
  });
  it('detects tampering and another account', async () => {
    const snapshot = await createSnapshot(createInitialState(), meta);
    await expect(readSnapshot(snapshotText(snapshot), 'person-b')).rejects.toThrow(/different/);
    snapshot.payload.balance++;
    await expect(readSnapshot(snapshotText(snapshot))).rejects.toThrow(/damaged/);
  });
  it('hashes object keys deterministically', async () => {
    expect(await digest({ a: 1, b: [2, 3] })).toBe(await digest({ b: [2, 3], a: 1 }));
  });
});
it('exports malformed legacy bytes for recovery instead of silently creating a new dataset', async () => {
  const old = '{old-data-is-broken'; const backend = new MemoryBackend(); const repository = new Repository(backend, () => old);
  await expect(repository.load()).rejects.toThrow(); expect(await repository.original()).toBe(old); expect(backend.value).toBeNull();
});
