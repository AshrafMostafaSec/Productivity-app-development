import { it, expect } from 'vitest';
import { BrowserBackend } from '../src/storage/backend';
import { Repository } from '../src/storage/repository';
import { parseVault } from '../src/storage/schema';
it('commits state and metadata in IndexedDB and reloads through a new repository instance', async () => {
  const backend = new BrowserBackend(); const repository = new Repository(backend); const vault = await repository.load();
  vault.datasets.guest.state.balance = 84; vault.datasets.guest.revision = 3; vault.datasets.guest.dirty = true;
  await repository.save(vault); const reloaded = await new Repository(new BrowserBackend()).load();
  expect(reloaded.datasets.guest.state.balance).toBe(84); expect(reloaded.datasets.guest.revision).toBe(3); expect(reloaded.datasets.guest.dirty).toBe(true);
  expect(parseVault((await backend.previous())!).datasets.guest.revision).toBe(0);
});
