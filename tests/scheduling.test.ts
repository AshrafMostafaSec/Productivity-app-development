import { afterEach, expect, it, vi } from 'vitest';
import { AppController } from '../src/state/controller';
import { setup, connectAndAdopt } from './support';

const controllers: AppController[] = [];
afterEach(() => { controllers.splice(0).forEach(c => c.dispose()); vi.useRealTimers(); vi.restoreAllMocks(); });
async function scheduled() {
  vi.useFakeTimers();
  const c = await setup(undefined, undefined, undefined, true);
  controllers.push(c.controller); await connectAndAdopt(c); return c;
}
async function completed(controller: AppController) {
  // WebCrypto runs outside the fake clock; wait for hashing and durable acknowledgment too.
  await vi.waitFor(() => expect(controller.getSnapshot().cloud.stage).toBe('ready'));
}
it('backs up after the debounce and does not upload unchanged state again', async () => {
  const c = await scheduled();
  const list = vi.spyOn(c.drive, 'list');
  await vi.advanceTimersByTimeAsync(14999); expect(list).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1); expect(list).toHaveBeenCalledTimes(1);
  await completed(c.controller); expect(c.drive.uploads).toBe(1);
  await vi.advanceTimersByTimeAsync(120000); expect(c.drive.uploads).toBe(1);
});
it('backs up within a minute even while edits keep resetting the debounce', async () => {
  const c = await scheduled();
  for (let i = 0; i < 5; i++) {
    await vi.advanceTimersByTimeAsync(10000);
    c.controller.dispatch({ type: 'brain/add', text: `Thought ${i}` }); await c.repository.flush();
  }
  expect(c.drive.uploads).toBe(0);
  await vi.advanceTimersByTimeAsync(10000); await completed(c.controller); expect(c.drive.uploads).toBe(1);
  expect(c.controller.getSnapshot().cloud.dirty).toBe(false);
});
it('retries an offline upload and cancels future attempts on sign-out', async () => {
  const c = await scheduled(); vi.spyOn(Math, 'random').mockReturnValue(0);
  c.drive.fail = true; await vi.advanceTimersByTimeAsync(15000);
  expect(c.controller.getSnapshot().cloud.stage).toBe('error');
  c.drive.fail = false; await vi.advanceTimersByTimeAsync(5000);
  await completed(c.controller);
  expect(c.drive.uploads).toBe(1);
  c.controller.dispatch({ type: 'brain/add', text: 'Keep offline' }); await c.repository.flush();
  await c.controller.signOut(); await vi.advanceTimersByTimeAsync(120000);
  expect(c.drive.uploads).toBe(1);
});
it('cancels pending scheduled uploads when automatic backup is paused', async () => {
  const c = await scheduled(); await c.controller.setAutoBackup(false);
  await vi.advanceTimersByTimeAsync(120000); expect(c.drive.uploads).toBe(0);
  expect(c.controller.getSnapshot().cloud.dirty).toBe(true);
});
