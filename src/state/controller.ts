import type { AppState } from '../types';
import { reducer, rollover, type Action, type StoreState } from './reducer';
import { createInitialState } from './initialState';
import { dayKeyOf } from '../lib/time';
import { Repository } from '../storage/repository';
import { newDataset, emptyState, parseState, type Account, type Dataset, type Vault } from '../storage/schema';
import { backupPayload, canonical, createSnapshot, readSnapshot, snapshotText, type Snapshot } from '../backup/snapshot';
import { retentionCandidates } from '../backup/retention';
import { DriveError, type CloudFile, type Drive } from '../services/googleDrive';
import type { Auth } from '../services/googleAuth';

type CloudStage = 'disconnected' | 'checking' | 'choice' | 'ready' | 'uploading' | 'error';
export interface AppView {
  state: StoreState; ready: boolean; blocked: boolean; saving: boolean; storageError: string | null;
  configured: boolean; account: Account | null; working: boolean;
  cloud: { stage: CloudStage; files: CloudFile[]; error: string | null; enabled: boolean; dirty: boolean; lastBackupAt: number | null };
  preview: { snapshot: Snapshot; file: CloudFile | null } | null;
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
    configured: false, account: null, working: false,
    cloud: { stage: 'disconnected', files: [], error: null, enabled: false, dirty: false, lastBackupAt: null }, preview: null,
  };
  constructor(private repository: Repository, private auth: Auth, private drive: Drive, private autoSchedule = true) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.view;
  private update(patch: Partial<AppView>) { this.view = { ...this.view, ...patch }; this.listeners.forEach(l => l()); }
  private cloud(patch: Partial<AppView['cloud']>) { this.update({ cloud: { ...this.view.cloud, ...patch } }); }
  private dataset(): Dataset {
    if (!this.vault) throw new Error('Device data has not loaded yet.');
    return this.vault.datasets[this.vault.activeScope];
  }
  private syncMeta() {
    const d = this.dataset();
    this.cloud({ enabled: d.enabled, dirty: d.dirty, lastBackupAt: d.lastBackupAt });
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
    if (!this.autoSchedule || !this.vault || !this.view.account || !this.dataset().enabled || !this.dataset().dirty || this.view.storageError || this.view.cloud.stage !== 'ready') return;
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
        await this.checkCloud();
      }
    } catch (error) { this.cloud({ stage: 'error', error: message(error) }); }
  }
  dispatch = (action: Action) => {
    if (!this.vault || this.view.blocked || this.view.working) return;
    if (action.type === 'system/reset') {
      this.cancel();
      const rollback = this.dataset().state;
      const reset = reducer(this.view.state, { ...action, meta: { now: Date.now(), id: crypto.randomUUID() } });
      Object.assign(this.dataset(), newDataset(this.withoutToast(reset)), { rollback });
      this.update({ state: reset }); this.syncMeta();
      this.cloud({ stage: this.view.account ? 'choice' : 'disconnected', error: null });
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
    const scope = `google:${account.subject}`;
    this.vault.accounts[scope] = account;
    this.vault.datasets[scope] ??= newDataset(emptyState());
    this.vault.activeScope = scope;
    this.dataset().recoveryChecked = false;
    this.update({ account }); this.switchDomain(this.dataset().state);
    this.cloud({ stage: 'checking', files: [], error: null });
    await this.persist();
  }
  connect = async () => {
    if (!this.vault || this.view.blocked || this.view.working) return;
    this.update({ working: true }); this.cancel();
    try {
      await this.repository.flush();
      const account = await this.auth.signIn();
      await this.auth.authorizeDrive();
      await this.attachAccount(account);
      await this.checkCloud();
    } catch (error) { this.cloud({ stage: 'error', error: message(error) }); }
    finally { this.update({ working: false }); }
  };
  signOut = async () => {
    if (!this.vault || this.view.working) return;
    this.update({ working: true }); this.cancel();
    try {
      await this.repository.flush();
      await this.auth.signOut();
      this.vault.activeScope = 'guest';
      this.update({ account: null }); this.switchDomain(this.dataset().state);
      this.cloud({ stage: 'disconnected', files: [], error: null });
      await this.persist();
    } catch (error) { this.cloud({ stage: 'error', error: message(error) }); }
    finally { this.update({ working: false }); }
  };
  checkCloud = async () => {
    const account = this.view.account;
    if (!account || !this.vault || this.view.storageError) return;
    const epoch = this.epoch; const signal = this.abort.signal;
    this.cloud({ stage: 'checking', error: null });
    try {
      const files = await this.drive.list(account.subject, signal);
      if (!this.current(epoch, account.subject)) return;
      const d = this.dataset();
      const latest = files[0];
      const sameHead = latest?.id === d.headId;
      const knownEmpty = files.length === 0 && d.headId === null && d.recoveryChecked;
      const choice = !sameHead && !knownEmpty;
      // First account connection always asks, even when the cloud is empty.
      this.cloud({ files, stage: choice ? 'choice' : 'ready', error: null });
      if (!choice) { d.recoveryChecked = true; await this.persist(); this.schedule(); }
    } catch (error) {
      if (this.current(epoch) && !abortError(error)) this.cloud({ stage: 'error', error: message(error) });
    }
  };
  chooseLocal = async (useGuest: boolean) => {
    if (!this.vault || !this.view.account || this.view.cloud.stage !== 'choice') return;
    // Explicit confirmation in AccountSheet authorizes keeping this dataset over cloud history.
    const d = this.dataset();
    d.rollback = d.state;
    if (useGuest) this.switchDomain(this.vault.datasets.guest.state);
    d.headId = this.view.cloud.files[0]?.id ?? null;
    d.lastHash = null; d.recoveryChecked = true; d.enabled = true; d.dirty = true; d.hasEdits = true; d.revision++; d.updatedAt = Date.now();
    this.syncMeta(); this.cloud({ stage: 'ready', error: null });
    await this.persist(); this.schedule();
  };
  setAutoBackup = async (enabled: boolean) => {
    if (!this.vault || !this.view.account) return;
    this.dataset().enabled = enabled;
    if (!enabled) { this.cancel(); this.cloud({ stage: 'ready' }); }
    this.syncMeta(); await this.persist();
    if (enabled) await this.checkCloud();
  };
  previewCloud = async (id: string) => {
    const account = this.view.account;
    const file = this.view.cloud.files.find(f => f.id === id);
    if (!account || !file) return;
    const epoch = this.epoch;
    this.update({ working: true });
    try {
      const snapshot = await this.drive.download(account.subject, file, this.abort.signal);
      if (this.current(epoch, account.subject)) this.update({ preview: { snapshot, file } });
    } finally { if (this.current(epoch)) this.update({ working: false }); }
  };
  previewImport = async (raw: string) => {
    const snapshot = await readSnapshot(raw);
    if (snapshot.accountSubject && this.view.account && snapshot.accountSubject !== this.view.account.subject) throw new Error('Sign out first to import a backup from another account.');
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
    this.syncMeta(); this.cloud({ stage: this.view.account ? 'checking' : 'disconnected', error: null });
    await this.persist();
    if (recoveringDevice) {
      try { this.update({ configured: (await this.auth.status()).configured }); } catch { /* Local recovery remains available without Google. */ }
    }
    // Cloud writes remain paused after restore until explicitly enabled and checked against the latest copy.
    if (this.view.account) await this.checkCloud();
  };
  restoreRollback = async () => {
    if (!this.vault || !this.dataset().rollback || this.view.working) throw new Error('There is no previous dataset to restore.');
    this.cancel();
    const previous = this.dataset().rollback!; this.dataset().rollback = this.dataset().state;
    this.switchDomain(previous);
    this.dataset().revision++; this.dataset().hasEdits = true; this.dataset().dirty = true; this.dataset().updatedAt = Date.now();
    this.dataset().enabled = false; this.dataset().recoveryChecked = false;
    this.syncMeta(); this.cloud({ stage: this.view.account ? 'choice' : 'disconnected', error: null });
    await this.persist();
  };
  exportData = async () => {
    if (!this.vault || this.view.blocked) throw new Error('Export the original device file to preserve unreadable data.');
    const snapshot = await createSnapshot(this.withoutToast(this.view.state), { accountSubject: this.view.account?.subject ?? null, installationId: this.vault.installationId, revision: this.dataset().revision, parentSnapshotId: this.dataset().headId });
    return snapshotText(snapshot);
  };
  exportOriginal = () => this.repository.original();
  backupNow = async (force = false) => {
    if (this.inFlight || !this.vault || !this.view.account || this.view.storageError || (!this.dataset().enabled && !force) || !this.dataset().recoveryChecked || this.view.cloud.stage === 'choice' || this.view.cloud.stage === 'checking') return;
    const epoch = this.epoch; const account = this.view.account; const signal = this.abort.signal;
    this.inFlight = true; this.clearTimers();
    this.cloud({ stage: 'uploading', error: null });
    try {
      await this.repository.flush();
      const files = await this.drive.list(account.subject, signal);
      if (!this.current(epoch, account.subject)) return;
      const d = this.dataset();
      const recoverable = files[0]?.appProperties?.installation === this.vault.installationId && files[0]?.appProperties?.revision === String(d.revision);
      if ((files[0]?.id ?? null) !== d.headId && !recoverable) { this.cloud({ stage: 'choice', files, error: 'Another backup is available. Choose which data to keep.' }); return; }
      if (!d.dirty) { this.cloud({ stage: 'ready', files }); return; }
      const revision = d.revision;
      const snapshot = await createSnapshot(d.state, { accountSubject: account.subject, installationId: this.vault.installationId, revision, parentSnapshotId: d.headId });
      if (!this.current(epoch, account.subject)) return;
      if (snapshot.payloadSha256 === d.lastHash) {
        d.dirty = d.revision !== revision; this.syncMeta(); await this.persist(); this.cloud({ stage: 'ready', files }); return;
      }
      // Detect a timed-out upload that succeeded before local acknowledgment.
      const duplicate = files.find(f => f.appProperties?.hash === snapshot.payloadSha256 && f.appProperties?.installation === snapshot.installationId && f.appProperties?.revision === String(revision));
      if (recoverable && !duplicate) { this.cloud({ stage: 'choice', files, error: 'Cloud data differs from your device. Review it before continuing.' }); return; }
      const uploaded = duplicate ?? await this.drive.upload(account.subject, snapshot, signal);
      const verified = await this.drive.download(account.subject, uploaded, signal);
      if (!this.current(epoch, account.subject)) return;
      if (verified.payloadSha256 !== snapshot.payloadSha256 || verified.accountSubject !== account.subject) throw new Error('Google returned an unexpected backup. The previous copy is still safe.');
      const latest = this.dataset();
      latest.headId = uploaded.id; latest.lastHash = verified.payloadSha256; latest.lastBackupAt = Date.now(); latest.dirty = latest.revision !== revision;
      await this.persist(); this.syncMeta(); this.retries = 0;
      this.cloud({ stage: 'ready', files: [uploaded, ...files.filter(f => f.id !== uploaded.id)], error: null });
      // Prune only after read-back verification and durable acknowledgment. Never delete an unreadable file.
      for (const file of retentionCandidates(this.view.cloud.files).slice(0, 100)) {
        if (!this.current(epoch, account.subject)) break;
        try { await this.drive.download(account.subject, file, signal); await this.drive.remove(account.subject, file.id, signal);
          if (this.current(epoch)) this.cloud({ files: this.view.cloud.files.filter(f => f.id !== file.id) }); }
        catch { /* Retention can wait until the next successful backup. */ }
      }
    } catch (error) {
      if (!this.current(epoch) || abortError(error)) return;
      this.cloud({ stage: 'error', error: message(error) });
      const retryable = !(error instanceof DriveError) || error.status === 429 || error.status >= 500;
      if (this.autoSchedule && retryable && this.retries < 6) {
        const delay = Math.max(error instanceof DriveError ? error.retryAfter : 0, Math.min(300_000, 5000 * 2 ** this.retries++) + Math.random() * 1000);
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
    if (this.view.account && !this.inFlight) { await this.checkCloud(); await this.backupNow(); }
  };
  dispose = () => { this.cancel(); this.listeners.clear(); };
}
