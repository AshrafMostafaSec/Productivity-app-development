import { newId } from '../lib/id';
import { z } from 'zod';
import type { Backend } from '../storage/backend';
import { newDataset, parseVault, type Account, type Vault } from '../storage/schema';
import { backupPayload, canonical, readSnapshot, type Snapshot } from '../backup/snapshot';
import { deriveKey, encrypt, decrypt, randomBase64, ITERATIONS } from '../platform/crypto';

export const MAX_ENCRYPTED_BYTES = 16 * 1024 * 1024;
const publicProfile = z.object({ subject: z.string().uuid(), name: z.string().trim().min(1).max(80) }).strict();
const metadata = z.object({ installation: z.string().min(1).max(256), revision: z.number().int().nonnegative(), hash: z.string().regex(/^[a-f0-9]{64}$/), createdAt: z.number().finite().nonnegative() }).strict();
const headerSchema = z.object({ format: z.literal('anchoros-encrypted'), version: z.literal(1), kind: z.enum(['access', 'backup']), kdf: z.literal('PBKDF2-SHA256'), iterations: z.literal(ITERATIONS), salt: z.string().regex(/^[A-Za-z0-9+/]{22}==$/), iv: z.string().regex(/^[A-Za-z0-9+/]{16}$/), profile: publicProfile, meta: metadata.nullable() }).strict();
const envelopeSchema = z.object({ header: headerSchema, ciphertext: z.string().min(24).max(MAX_ENCRYPTED_BYTES).regex(/^[A-Za-z0-9+/]+={0,2}$/) }).strict();
export type Envelope = z.infer<typeof envelopeSchema>;
type Secret = { profile: z.infer<typeof publicProfile>; salt: string; key: Uint8Array };
const PROOF = 'AnchorOS local password access v1';
export function parseEnvelope(raw: string): Envelope {
  if (new TextEncoder().encode(raw).byteLength > MAX_ENCRYPTED_BYTES) throw new Error('Choose an encrypted backup smaller than 16 MB.');
  try { return envelopeSchema.parse(JSON.parse(raw)); }
  catch { throw new Error('This encrypted file is damaged or uses an unsupported format. Your device data has not been replaced.'); }
}
async function seal(secret: Secret, kind: 'access' | 'backup', plaintext: string, meta: Envelope['header']['meta']): Promise<string> {
  const header: Envelope['header'] = { format: 'anchoros-encrypted', version: 1, kind, kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: secret.salt, iv: randomBase64(12), profile: secret.profile, meta };
  const raw = JSON.stringify({ header, ciphertext: await encrypt(secret.key, header.iv, plaintext, canonical(header)) });
  if (new TextEncoder().encode(raw).byteLength > MAX_ENCRYPTED_BYTES) throw new Error('The encrypted backup exceeds 16 MB. Export your data before continuing.');
  return raw;
}
async function open(envelope: Envelope, key: Uint8Array): Promise<string> {
  try { return await decrypt(key, envelope.header.iv, envelope.ciphertext, canonical(envelope.header)); }
  catch { throw new Error('The password is incorrect or this file is damaged. Your existing data has been kept.'); }
}
type AccessView = { stage: 'loading' | 'setup' | 'locked' | 'open' | 'error'; name: string; error: string | null; preview: { name: string; snapshot: Snapshot } | null; generation: number };
export class LocalAccess {
  private secret: Secret | null = null;
  private stored: Envelope | null = null;
  private pending: { secret: Secret; snapshot: Snapshot } | null = null;
  private listeners = new Set<() => void>();
  private view: AccessView = { stage: 'loading', name: '', error: null, preview: null, generation: 0 };
  private initialized?: Promise<void>;
  constructor(public backend: Backend) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.view;
  private update(patch: Partial<AccessView>) { this.view = { ...this.view, ...patch }; this.listeners.forEach(listener => listener()); }
  initialize = () => this.initialized ??= this.load();
  private async load() {
    try {
      const raw = await this.backend.readAccess();
      this.stored = raw == null ? null : parseEnvelope(raw);
      if (this.stored && this.stored.header.kind !== 'access') throw new Error('The local profile file is invalid. Restore an encrypted backup.');
      this.update({ stage: this.stored ? 'locked' : 'setup', name: this.stored?.header.profile.name ?? '', error: null });
    } catch (error) { this.update({ stage: 'error', error: error instanceof Error ? error.message : 'Local profile could not be opened.' }); }
  }
  retry = async () => { this.initialized = undefined; await this.initialize(); };
  get profile(): Account {
    if (!this.secret) throw new Error('Unlock AnchorOS first.');
    return { ...this.secret.profile, email: '' };
  }
  private async activate(secret: Secret) {
    const raw = await seal(secret, 'access', PROOF, null);
    await this.backend.writeAccess(raw);
    this.stored = parseEnvelope(raw); this.secret = secret;
    this.update({ stage: 'open', name: secret.profile.name, preview: null, error: null, generation: this.view.generation + 1 });
  }
  create = async (name: string, password: string) => {
    if (this.view.stage !== 'setup') throw new Error('Unlock your existing profile or restore a backup.');
    const profile = publicProfile.parse({ subject: newId(), name: name.trim() });
    if (password.length < 8 || password.length > 256) throw new Error('Choose a password between 8 and 256 characters.');
    const salt = randomBase64(16); const key = await deriveKey(password, salt);
    await this.activate({ profile, salt, key });
  };
  unlock = async (password: string) => {
    if (!this.stored) throw new Error('Create your local profile first.');
    if (password.length > 256) throw new Error('The password is incorrect.');
    const key = await deriveKey(password, this.stored.header.salt);
    try {
      if (await open(this.stored, key) !== PROOF) throw new Error('The local profile is damaged. Restore a backup.');
      this.secret = { profile: this.stored.header.profile, salt: this.stored.header.salt, key };
      this.update({ stage: 'open', error: null, generation: this.view.generation + 1 });
    } catch (error) { key.fill(0); throw error; }
  };
  lock = () => {
    this.secret?.key.fill(0); this.secret = null; this.cancelRestore();
    this.update({ stage: this.stored ? 'locked' : 'setup' });
  };
  encode = async (snapshot: Snapshot): Promise<string> => {
    if (!this.secret) throw new Error('Unlock AnchorOS before exporting a backup.');
    return seal(this.secret, 'backup', JSON.stringify(snapshot), { installation: snapshot.installationId, revision: snapshot.revision, hash: snapshot.payloadSha256, createdAt: snapshot.createdAt });
  };
  decode = async (raw: string): Promise<Snapshot> => {
    if (!this.secret) throw new Error('Unlock AnchorOS first.');
    const file = parseEnvelope(raw);
    if (file.header.kind !== 'backup') throw new Error('Choose an AnchorOS backup file.');
    if (file.header.profile.subject !== this.secret.profile.subject || file.header.salt !== this.secret.salt) throw new Error('This backup belongs to another local profile. Lock the app and restore it using its original password.');
    return this.verifyBackup(file, await open(file, this.secret.key));
  };
  private async verifyBackup(file: Envelope, plaintext: string) {
    const snapshot = await readSnapshot(plaintext);
    const meta = file.header.meta;
    if (!meta || meta.hash !== snapshot.payloadSha256 || meta.revision !== snapshot.revision || meta.installation !== snapshot.installationId || meta.createdAt !== snapshot.createdAt || snapshot.accountSubject !== file.header.profile.subject) throw new Error('The backup metadata does not match its data. Choose another copy.');
    return snapshot;
  }
  previewRestore = async (raw: string, password: string) => {
    if (password.length > 256) throw new Error('The password is incorrect.');
    const file = parseEnvelope(raw);
    if (file.header.kind !== 'backup') throw new Error('Choose an encrypted AnchorOS backup.');
    const key = await deriveKey(password, file.header.salt);
    try {
      const snapshot = await this.verifyBackup(file, await open(file, key));
      this.cancelRestore(); this.pending = { secret: { profile: file.header.profile, salt: file.header.salt, key }, snapshot };
      this.update({ preview: { name: file.header.profile.name, snapshot } });
    } catch (error) { key.fill(0); throw error; }
  };
  cancelRestore = () => { this.pending?.secret.key.fill(0); this.pending = null; this.update({ preview: null }); };
  confirmRestore = async () => {
    const pending = this.pending; if (!pending) throw new Error('Review a backup before restoring it.');
    const state = backupPayload(pending.snapshot.payload);
    if (state.pomodoro.status === 'running') state.pomodoro = { ...state.pomodoro, status: 'paused', endsAt: null, remainingMs: Math.max(1000, Math.min(state.pomodoro.phaseMs, (state.pomodoro.endsAt ?? Date.now()) - Date.now())) };
    const raw = await this.backend.read(); let rollback = null;
    if (raw != null) { await this.backend.preserveOriginal?.(raw); try { const old = parseVault(raw); rollback = old.datasets[old.activeScope].state; } catch { /* Preserve unreadable original bytes. */ } }
    const dataset = newDataset(state); dataset.rollback = rollback; dataset.hasEdits = true;
    const vault: Vault = { format: 1, installationId: newId(), activeScope: 'guest', datasets: { guest: dataset }, accounts: {} };
    // Write data first. If profile storage fails, the restored activities remain available for recovery/setup.
    await this.backend.write(JSON.stringify(vault));
    await this.activate(pending.secret);
    this.pending = null;
  };
}
