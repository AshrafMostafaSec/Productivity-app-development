import { expect, it } from 'vitest';
import { setup, connectAndAdopt } from './support';
import { parseVault } from '../src/storage/schema';

it('pauses a restored running timer without earning absent study time', async () => {
  const c = await setup(); c.controller.dispatch({ type: 'pomo/start', minutes: 25 });
  const raw = await c.controller.exportData();
  await c.controller.previewImport(raw); await c.controller.restorePreview();
  const state = c.controller.getSnapshot().state;
  expect(state.pomodoro.status).toBe('paused'); expect(state.pomodoro.endsAt).toBeNull();
  expect(state.studyLog).toEqual([]); expect(state.balance).toBe(30);
  expect(parseVault(c.backend.value!).datasets.guest.state.pomodoro.status).toBe('paused');
});
it('refuses an account-mismatched import and preserves the active dataset', async () => {
  const a = await setup(); await connectAndAdopt(a); const raw = await a.controller.exportData();
  const b = await setup(); b.auth.next = { subject: 'other', email: 'b@example.com', name: 'B' };
  await connectAndAdopt(b); b.controller.dispatch({ type: 'brain/add', text: 'B private' });
  await expect(b.controller.previewImport(raw)).rejects.toThrow(/another account/);
  expect(b.controller.getSnapshot().state.brainDump[0].text).toBe('B private');
  expect(b.controller.getSnapshot().preview).toBeNull();
});
it('does not acknowledge an unexpected read-back or delete existing cloud copies', async () => {
  const c = await setup(); await connectAndAdopt(c);
  const download = c.drive.download.bind(c.drive);
  c.drive.download = async (subject, file) => ({ ...await download(subject, file), payloadSha256: '0'.repeat(64) });
  await c.controller.backupNow();
  expect(c.controller.getSnapshot().cloud.dirty).toBe(true);
  expect(c.controller.getSnapshot().cloud.lastBackupAt).toBeNull();
  expect(c.controller.getSnapshot().cloud.error).toMatch(/unexpected/);
  expect(c.drive.files).toHaveLength(1);
});
