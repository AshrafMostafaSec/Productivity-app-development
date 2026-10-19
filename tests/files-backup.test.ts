import { beforeEach, expect, it, vi } from 'vitest';
import { FilesBackup } from '../src/services/filesBackup';
import type { LocalAccess } from '../src/services/localAccess';
import { accountA } from './support';
import { createInitialState } from '../src/state/initialState';
import type { Snapshot } from '../src/backup/snapshot';
const native = vi.hoisted(() => ({ folderStatus: vi.fn(), selectBackupFolder: vi.fn(), listBackups: vi.fn(), readBackup: vi.fn(), writeBackup: vi.fn(), removeBackup: vi.fn() }));
vi.mock('../src/platform/native', () => ({ isIOS: () => true, Native: native }));
const snapshot: Snapshot = { format: 'anchoros-backup', formatVersion: 1, stateSchemaVersion: 2, accountSubject: accountA.subject, installationId: 'device', revision: 1, parentSnapshotId: null, createdAt: Date.now(), appVersion: '0.3.0', payloadSha256: 'a'.repeat(64), payload: createInitialState() };
function client() { return new FilesBackup({ profile: accountA, encode: async () => 'encrypted-content', decode: async () => snapshot } as unknown as LocalAccess); }
beforeEach(() => { vi.resetAllMocks(); native.folderStatus.mockResolvedValue({ configured: true, name: 'External backups', token: 'folder-token' }); });
it('does not write a file without an authorized external folder', async () => {
  native.folderStatus.mockResolvedValue({ configured: false, name: null, token: null });
  await expect(client().upload(accountA.subject, snapshot)).rejects.toThrow(/Choose/);
  expect(native.writeBackup).not.toHaveBeenCalled();
});
it('uses the current selection token and immutable generated backup filenames', async () => {
  native.writeBackup.mockResolvedValue(undefined);
  const file = await client().upload(accountA.subject, snapshot);
  expect(file.id).toMatch(/^anchoros-[0-9]+-[a-f0-9-]{36}\.anchorbackup$/);
  expect(native.writeBackup).toHaveBeenCalledWith({ token: 'folder-token', id: file.id, value: 'encrypted-content' });
});
it('rejects another profile before accessing native Files', async () => {
  await expect(client().list('another-profile')).rejects.toThrow(/changed/);
  expect(native.folderStatus).not.toHaveBeenCalled();
});
it('refuses a folder containing another profile instead of replacing its activities', async () => {
  native.listBackups.mockResolvedValue({ files: [{ id: 'file', name: 'file', createdTime: new Date().toISOString(), appProperties: { profile: 'another-profile' } }] });
  await expect(client().list(accountA.subject)).rejects.toThrow(/different profile/); expect(native.writeBackup).not.toHaveBeenCalled();
});
it('does not access a folder after cancellation', async () => {
  const controller = new AbortController(); controller.abort();
  await expect(client().list(accountA.subject, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(native.folderStatus).not.toHaveBeenCalled();
});
it('surfaces revoked folder permissions without writing or deleting any file', async () => {
  native.folderStatus.mockRejectedValue(new Error('Folder permission was revoked'));
  await expect(client().upload(accountA.subject, snapshot)).rejects.toThrow(/revoked/);
  expect(native.writeBackup).not.toHaveBeenCalled(); expect(native.removeBackup).not.toHaveBeenCalled();
});
