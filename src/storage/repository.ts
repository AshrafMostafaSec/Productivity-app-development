import type { Backend } from './backend';
import { parseState, parseJson, parseVault, newDataset, type Vault } from './schema';

export class Repository {
  private legacyRaw: string | null = null;
  private tail: Promise<void> = Promise.resolve();
  constructor(public backend: Backend, private legacy: () => string | null = () => null) {}
  async load(): Promise<Vault> {
    const raw = await this.backend.read();
    if (raw) {
      try { return parseVault(raw); }
      catch (error) { await this.backend.preserveOriginal?.(raw); throw error; }
    }
    const legacy = this.legacy(); this.legacyRaw = legacy;
    let state;
    try { state = legacy ? parseState(parseJson(legacy)) : undefined; }
    catch (error) { if (legacy) await this.backend.preserveOriginal?.(legacy); throw error; }
    const vault: Vault = { format: 1, installationId: crypto.randomUUID(), activeScope: 'guest', datasets: { guest: newDataset(state) }, accounts: {} };
    if (legacy) { vault.datasets.guest.hasEdits = true; vault.datasets.guest.dirty = true; }
    await this.save(vault);
    // Leave the original legacy payload intact as a migration recovery copy.
    return vault;
  }
  save(vault: Vault): Promise<void> {
    const raw = JSON.stringify(vault);
    parseVault(raw);
    const operation = this.tail.catch(() => {}).then(() => this.backend.write(raw));
    this.tail = operation;
    return operation;
  }
  async original() { return (await this.backend.original?.()) ?? (await this.backend.read()) ?? this.legacyRaw ?? ''; }
  async flush() { await this.tail; }
}
