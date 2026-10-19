import { expect, it } from 'vitest';
import { setup, enableBackups } from './support';
import { parseVault } from '../src/storage/schema';

it('pauses a restored running timer without earning absent study time', async () => {
  const c = await setup(); c.controller.dispatch({ type: 'pomo/start', minutes: 25 });
  const raw = await c.controller.exportData();
  await c.controller.previewImport(raw); await c.controller.restorePreview();
  const state = c.controller.getSnapshot().state;
  expect(state.pomodoro.status).toBe('paused'); expect(state.pomodoro.endsAt).toBeNull();
  expect(state.studyLog).toEqual([]); expect(state.balance).toBe(30);
  expect(parseVault(c.backend.value!).datasets[parseVault(c.backend.value!).activeScope].state.pomodoro.status).toBe('paused');
});
it('does not acknowledge an unexpected read-back or delete existing file copies', async () => {
  const c = await setup(); await enableBackups(c);
  const download = c.drive.download.bind(c.drive);
  c.drive.download = async (subject, file) => ({ ...await download(subject, file), payloadSha256: '0'.repeat(64) });
  await c.controller.backupNow();
  expect(c.controller.getSnapshot().backup.dirty).toBe(true);
  expect(c.controller.getSnapshot().backup.lastBackupAt).toBeNull();
  expect(c.controller.getSnapshot().backup.error).toMatch(/read-back/);
  expect(c.drive.files).toHaveLength(1);
});
