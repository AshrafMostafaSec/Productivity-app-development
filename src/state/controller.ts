import type { AppState } from '../types';
import { reducer, rollover, type Action, type StoreState } from './reducer';
import { createInitialState } from './initialState';
import { dayKeyOf } from '../lib/time';
import { Repository } from '../storage/repository';
import { newDataset, emptyState, parseState, type Account, type Dataset, type Vault } from '../storage/schema';
import { backupPayload, canonical, createSnapshot, readSnapshot, snapshotText, type Snapshot } from '../backup/snapshot';
import { retentionCandidates } from '../backup/retention';
import { BackupError, type BackupFile, type FilesDestination, type FolderStatus } from '../services/filesBackup';
import type { Identity } from '../services/localIdentity';

type FolderStage = 'disconnected' | 'checking' | 'choice' | 'ready' | 'uploading' | 'error';
export interface AppView {
  state: StoreState; ready: boolean; blocked: boolean; saving: boolean; storageError: string | null;
  configured: boolean; account: Account | null; working: boolean; folder: FolderStatus;
  backup: { stage: FolderStage; files: BackupFile[]; error: string | null; enabled: boolean; dirty: boolean; lastBackupAt: number | null };
  preview: { snapshot: Snapshot; file: BackupFile | null } | null;
}
const message = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Your existing data has been kept.';
const abortError = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

export class AppController {
  private vault: Vault | null = null;
  private listeners = new Set<() => void>();
  private epoch = 0;
  private abort = new AbortController();
  private serial = 0;
  private inFlight = false;
  private initialized?: Promise<void>;
  private timer?: ReturnType<typeof setTimeout>;
  private maxTimer?: ReturnType<typeof setTimeout>;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private retries = 0;
  private view: AppView = {
    state: { ...createInitialState(), toast: null }, ready: false, blocked: false, saving: false, storageError: null,
    configured: true, account: null, working: false, folder: { configured: false, name: null, token: null },
    backup: { stage: 'disconnected', files: [], error: null, enabled: false, dirty: false, lastBackupAt: null }, preview: null,
  };
  constructor(private repository: Repository, private auth: Identity, private drive: FilesDestination, private autoSchedule = true) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.view;
  private update(patch: Partial<AppView>) { this.view = { ...this.view, ...patch }; this.listeners.forEach(l => l()); }
  private backup(patch: Partial<AppView['backup']>) { this.update({ backup: { ...this.view.backup, ...patch } }); }
  private dataset(): Dataset {
    if (!this.vault) throw new Error('Device data has not loaded yet.');
    return this.vault.datasets[this.vault.activeScope];
  }
  private syncMeta() {
    const d = this.dataset();
    this.backup({ enabled: d.enabled, dirty: d.dirty, lastBackupAt: d.lastBackupAt });
  }
  private async persist() {
    if (!this.vault) return;
    const serial = ++this.serial;
    this.update({ saving: true });
    try {
      await this.repository.save(this.vault);
      if (serial === this.serial) this.update({ saving: false, storageError: null });
    } catch (error) {
      this.clearTimers();
      this.update({ saving: false, storageError: `Changes are not saved on this device. ${message(error)}` });
      throw error;
    }
  }
  private switchDomain(state: AppState) {
    const result = reducer(this.view.state, { type: 'system/restore', state, meta: { now: Date.now(), id: crypto.randomUUID() } });
    const changed = canonical(backupPayload(state)) !== canonical(backupPayload(this.withoutToast(result)));
    this.dataset().state = this.withoutToast(result);
    if (changed) { this.dataset().revision++; this.dataset().dirty = true; this.dataset().updatedAt = Date.now(); }
    this.update({ state: result, preview: null });
    this.syncMeta();
  }
  private withoutToast(state: StoreState): AppState { const { toast: _, ...data } = state; return data; }
  private clearTimers() { clearTimeout(this.timer); clearTimeout(this.maxTimer); clearTimeout(this.retryTimer); this.timer = this.maxTimer = this.retryTimer = undefined; }
  private cancel() { this.epoch++; this.abort.abort(); this.abort = new AbortController(); this.clearTimers(); this.retries = 0; }
  private current(epoch: number, subject?: string) { return epoch === this.epoch && (!subject || this.view.account?.subject === subject); }
  private schedule() {
    if (!this.autoSchedule || !this.vault || !this.view.account || !this.dataset().enabled || !this.dataset().dirty || this.view.storageError || this.view.backup.stage !== 'ready') return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.backupNow(), 15_000);
    this.maxTimer ??= setTimeout(() => void this.backupNow(), 60_000);
  }
  initialize = () => {
    this.initialized ??= this.load();
    return this.initialized;
  };
  private async load() {
    try {
      this.vault = await this.repository.load();
      const state = rollover({ ...this.dataset().state, ringingAlarm: null, toast: null }, dayKeyOf());
      const rolled = canonical(backupPayload(this.dataset().state)) !== canonical(backupPayload(this.withoutToast(state)));
      this.dataset().state = this.withoutToast(state);
      if (rolled) { this.dataset().revision++; this.dataset().dirty = true; this.dataset().updatedAt = Date.now(); }
      this.dataset().recoveryChecked = false;
      this.update({ state, ready: true, blocked: false }); this.syncMeta();
      await this.persist();
    } catch (error) {
      this.update({ ready: true, blocked: true, storageError: `We could not open your saved data. It has not been erased. ${message(error)}` });
      return;
    }
    try {
      const result = await this.auth.status();
      this.update({ configured: result.configured });
      if (result.account) {
        await this.attachAccount(result.account);
        await this.checkFolder();
      }
    } catch (error) { this.backup({ stage: 'error', error: message(error) }); }
  }
  dispatch = (action: Action) => {
    if (!this.vault || this.view.blocked || this.view.working) return;
    if (action.type === 'system/reset') {
      this.cancel();
      const rollback = this.dataset().state;
      const reset = reducer(this.view.state, { ...action, meta: { now: Date.now(), id: crypto.randomUUID() } });
      Object.assign(this.dataset(), newDataset(this.withoutToast(reset)), { rollback });
      this.update({ state: reset }); this.syncMeta();
      this.backup({ stage: this.view.account ? 'choice' : 'disconnected', error: null });
      void this.persist().catch(() => {});
      return;
    }
    const before = this.view.state;
    const next = reducer(before, { ...action, meta: { now: Date.now(), id: crypto.randomUUID() } });
    if (next === before) return;
    const data = this.withoutToast(next);
    try { parseState(data); } catch { this.update({ state: { ...before, toast: { id: crypto.randomUUID(), text: 'Please check those values and try again.' } } }); return; }
    const changed = canonical(backupPayload(this.withoutToast(before))) !== canonical(backupPayload(data));
    const d = this.dataset();
    d.state = data;
    if (changed) { d.revision++; d.updatedAt = Date.now(); d.hasEdits = true; d.dirty = true; }
    this.update({ state: next }); this.syncMeta();
    if (action.type === 'toast/show' || action.type === 'toast/dismiss') return;
    void this.persist().then(() => this.schedule()).catch(() => {});
  };
  retrySave = async () => { await this.persist(); this.syncMeta(); this.schedule(); };
  retryLoad = async () => { this.initialized = undefined; await this.initialize(); };
  private async attachAccount(account: Account) {
    if (!this.vault) return;
    this.cancel();
    const scope = `local:${account.subject}`;
    this.vault.accounts[scope] = account;
    this.vault.datasets[scope] ??= { ...newDataset(this.dataset().state), rollback: this.dataset().rollback };
    this.vault.activeScope = scope;
    this.dataset().recoveryChecked = false;
    this.update({ account }); this.switchDomain(this.dataset().state);
    this.backup({ stage: 'checking', files: [], error: null });
    await this.persist();
  }
  selectFolder = async () => {
    if (this.view.working) return;
    this.cancel(); this.update({ working: true });
    try {
      const previous = this.view.folder.token;
      const folder = await this.drive.select(); this.update({ folder });
      const dataset = this.dataset(); dataset.recoveryChecked = false;
      if (previous !== folder.token) { dataset.headId = null; dataset.lastHash = null; dataset.lastBackupAt = null; dataset.enabled = false; dataset.dirty = true; }
      this.syncMeta(); await this.persist();
      await this.checkFolder();
      if (this.view.backup.stage === 'choice' && this.view.backup.files.length === 0) {
        await this.chooseLocal(false); await this.backupNow();
      }
    } catch (error) { await this.checkFolder(); throw error; }
    finally { this.update({ working: false }); }
  };
  checkFolder = async () => {
    const account = this.view.account;
    if (!account || !this.vault || this.view.storageError) return;
    const epoch = this.epoch; const signal = this.abort.signal;
    this.backup({ stage: 'checking', error: null });
    try {
      const folder = await this.drive.status();
      if (!this.current(epoch, account.subject)) return;
      this.update({ folder });
      if (!folder.configured) { this.backup({ stage: 'disconnected', files: [], error: null }); return; }
      const files = await this.drive.list(account.subject, signal);
      if (!this.current(epoch, account.subject)) return;
      const d = this.dataset();
      const latest = files[0];
      const sameHead = latest?.id === d.headId;
      const knownEmpty = files.length === 0 && d.headId === null && d.recoveryChecked;
      const choice = !sameHead && !knownEmpty;
      // First account connection always asks, even when the backup is empty.
      this.backup({ files, stage: choice ? 'choice' : 'ready', error: null });
      if (!choice) { d.recoveryChecked = true; await this.persist(); this.schedule(); }
    } catch (error) {
      if (this.current(epoch) && !abortError(error)) this.backup({ stage: 'error', error: message(error) });
    }
  };
  chooseLocal = async (useGuest: boolean) => {
    if (!this.vault || !this.view.account || this.view.backup.stage !== 'choice') return;
    // Explicit confirmation in Profile & Backups authorizes keeping this dataset over backup history.
    const d = this.dataset();
    d.rollback = d.state;
    if (useGuest) this.switchDomain(this.vault.datasets.guest.state);
    d.headId = this.view.backup.files[0]?.id ?? null;
    d.lastHash = null; d.recoveryChecked = true; d.enabled = true; d.dirty = true; d.hasEdits = true; d.revision++; d.updatedAt = Date.now();
    this.syncMeta(); this.backup({ stage: 'ready', error: null });
    await this.persist(); this.schedule();
  };
  setAutoBackup = async (enabled: boolean) => {
    if (!this.vault || !this.view.account) return;
    if (enabled && !this.view.folder.configured) throw new Error('Choose a backup folder first.');
    this.dataset().enabled = enabled;
    if (!enabled) { this.cancel(); this.backup({ stage: 'ready' }); }
    this.syncMeta(); await this.persist();
    if (enabled) await this.checkFolder();
  };
  previewBackup = async (id: string) => {
    const account = this.view.account;
    const file = this.view.backup.files.find(f => f.id === id);
    if (!account || !file) return;
    const epoch = this.epoch;
    this.update({ working: true });
    try {
      const snapshot = await this.drive.download(account.subject, file, this.abort.signal);
      if (this.current(epoch, account.subject)) this.update({ preview: { snapshot, file } });
    } finally { if (this.current(epoch)) this.update({ working: false }); }
  };
  previewImport = async (raw: string) => {
    if (new TextEncoder().encode(raw).byteLength > 16 * 1024 * 1024) throw new Error('Choose a backup smaller than 16 MB.');
    let encrypted = false;
    try { encrypted = JSON.parse(raw)?.header?.format === 'anchoros-encrypted'; } catch { /* The snapshot parser returns the readable invalid-JSON error. */ }
    const snapshot = encrypted ? await this.drive.decode(raw) : await readSnapshot(raw);
    this.update({ preview: { snapshot, file: null } });
  };
  dismissPreview = () => this.update({ preview: null });
  restorePreview = async () => {
    const preview = this.view.preview; if (!preview) return;
    this.cancel();
    const data = backupPayload(preview.snapshot.payload);
    if (data.pomodoro.status === 'running') {
      data.pomodoro = { ...data.pomodoro, status: 'paused', endsAt: null, remainingMs: Math.max(1000, Math.min(data.pomodoro.phaseMs, (data.pomodoro.endsAt ?? Date.now()) - Date.now())) };
    }
    const recoveringDevice = !this.vault || this.view.blocked;
    if (recoveringDevice) {
      this.vault = { format: 1, installationId: crypto.randomUUID(), activeScope: 'guest', datasets: { guest: newDataset(emptyState()) }, accounts: {} };
      this.update({ blocked: false, storageError: null, account: null, ready: true });
    }
    const d = this.dataset();
    d.rollback = d.state;
    this.switchDomain(data);
    d.revision++; d.hasEdits = true; d.dirty = !preview.file || canonical(backupPayload(d.state)) !== canonical(backupPayload(preview.snapshot.payload)); d.updatedAt = Date.now();
    d.headId = preview.file?.id ?? d.headId;
    d.lastHash = preview.file ? preview.snapshot.payloadSha256 : null;
    d.lastBackupAt = preview.file ? Date.parse(preview.file.createdTime) : d.lastBackupAt;
    d.recoveryChecked = false; d.enabled = false;
    this.syncMeta(); this.backup({ stage: this.view.account ? 'checking' : 'disconnected', error: null });
    await this.persist();
    if (recoveringDevice) {
      const identity = await this.auth.status();
      this.update({ configured: identity.configured });
      if (identity.account) await this.attachAccount(identity.account);
    }
    // Folder writes remain paused after restore until explicitly enabled and checked against the latest copy.
    if (this.view.account) await this.checkFolder();
  };
  restoreRollback = async () => {
    if (!this.vault || !this.dataset().rollback || this.view.working) throw new Error('There is no previous dataset to restore.');
    this.cancel();
    const previous = this.dataset().rollback!; this.dataset().rollback = this.dataset().state;
    this.switchDomain(previous);
    this.dataset().revision++; this.dataset().hasEdits = true; this.dataset().dirty = true; this.dataset().updatedAt = Date.now();
    this.dataset().enabled = false; this.dataset().recoveryChecked = false;
    this.syncMeta(); this.backup({ stage: this.view.account ? 'choice' : 'disconnected', error: null });
    await this.persist();
  };
  exportData = async () => {
    if (!this.vault || this.view.blocked) throw new Error('Export the original device file to preserve unreadable data.');
    const snapshot = await createSnapshot(this.withoutToast(this.view.state), { accountSubject: this.view.account?.subject ?? null, installationId: this.vault.installationId, revision: this.dataset().revision, parentSnapshotId: this.dataset().headId });
    return this.drive.encode(snapshot);
  };
  exportOriginal = () => this.repository.original();
  backupNow = async (force = false) => {
    if (this.inFlight || !this.vault || !this.view.account || this.view.storageError || (!this.dataset().enabled && !force) || !this.dataset().recoveryChecked || this.view.backup.stage === 'choice' || this.view.backup.stage === 'checking' || this.view.backup.stage === 'disconnected') return;
    const epoch = this.epoch; const account = this.view.account; const signal = this.abort.signal;
    this.inFlight = true; this.clearTimers();
    this.backup({ stage: 'uploading', error: null });
    try {
      await this.repository.flush();
      const files = await this.drive.list(account.subject, signal);
      if (!this.current(epoch, account.subject)) return;
      const d = this.dataset();
      const recoverable = files[0]?.appProperties?.installation === this.vault.installationId && files[0]?.appProperties?.revision === String(d.revision);
      if ((files[0]?.id ?? null) !== d.headId && !recoverable) { this.backup({ stage: 'choice', files, error: 'Another backup is available. Choose which data to keep.' }); return; }
      if (!d.dirty) { this.backup({ stage: 'ready', files }); return; }
      const revision = d.revision;
      const snapshot = await createSnapshot(d.state, { accountSubject: account.subject, installationId: this.vault.installationId, revision, parentSnapshotId: d.headId });
      if (!this.current(epoch, account.subject)) return;
      if (snapshot.payloadSha256 === d.lastHash) {
        d.dirty = d.revision !== revision; this.syncMeta(); await this.persist(); this.backup({ stage: 'ready', files }); return;
      }
      // Detect a timed-out upload that succeeded before local acknowledgment.
      const duplicate = files.find(f => f.appProperties?.hash === snapshot.payloadSha256 && f.appProperties?.installation === snapshot.installationId && f.appProperties?.revision === String(revision));
      if (recoverable && !duplicate) { this.backup({ stage: 'choice', files, error: 'Folder data differs from your device. Review it before continuing.' }); return; }
      const uploaded = duplicate ?? await this.drive.upload(account.subject, snapshot, signal);
      const verified = await this.drive.download(account.subject, uploaded, signal);
      if (!this.current(epoch, account.subject)) return;
      if (verified.payloadSha256 !== snapshot.payloadSha256 || verified.accountSubject !== account.subject) throw new Error('The backup read-back did not match. The previous copy is still safe.');
      const latest = this.dataset();
      latest.headId = uploaded.id; latest.lastHash = verified.payloadSha256; latest.lastBackupAt = Date.now(); latest.dirty = latest.revision !== revision;
      await this.persist(); this.syncMeta(); this.retries = 0;
      this.backup({ stage: 'ready', files: [uploaded, ...files.filter(f => f.id !== uploaded.id)], error: null });
      // Prune only after read-back verification and durable acknowledgment. Never delete an unreadable file.
      for (const file of retentionCandidates(this.view.backup.files).slice(0, 100)) {
        if (!this.current(epoch, account.subject)) break;
        try { await this.drive.download(account.subject, file, signal); await this.drive.remove(account.subject, file.id, signal);
          if (this.current(epoch)) this.backup({ files: this.view.backup.files.filter(f => f.id !== file.id) }); }
        catch { /* Retention can wait until the next successful backup. */ }
      }
    } catch (error) {
      if (!this.current(epoch) || abortError(error)) return;
      this.backup({ stage: 'error', error: message(error) });
      const retryable = !(error instanceof BackupError) || error.status === 429 || error.status >= 500;
      if (this.autoSchedule && retryable && this.retries < 6) {
        const delay = Math.max(error instanceof BackupError ? error.retryAfter : 0, Math.min(300_000, 5000 * 2 ** this.retries++) + Math.random() * 1000);
        this.retryTimer = setTimeout(() => void this.backupNow(), delay);
      }
    } finally {
      this.inFlight = false;
      if (this.current(epoch)) this.schedule();
    }
  };
  resume = async () => {
    if (!this.view.ready || this.view.blocked) return;
    this.dispatch({ type: 'system/rollover', dayKey: dayKeyOf() });
    if (this.view.account && !this.inFlight) { await this.checkFolder(); await this.backupNow(); }
  };
  flush = () => this.repository.flush();
  dispose = () => { this.cancel(); this.listeners.clear(); };
}
