import type { Snapshot } from '../backup/snapshot';
import type { LocalAccess } from './localAccess';
import { Native, isIOS } from '../platform/native';
export interface BackupFile { id: string; name: string; createdTime: string; size?: string; appProperties?: Record<string, string> }
export interface FolderStatus { configured: boolean; name: string | null; token: string | null }
export class BackupError extends Error { constructor(message: string, public status = 503, public retryAfter = 0) { super(message); } }
export interface FilesDestination {
  status(): Promise<FolderStatus>;
  select(): Promise<FolderStatus>;
  list(subject: string, signal?: AbortSignal): Promise<BackupFile[]>;
  download(subject: string, file: BackupFile, signal?: AbortSignal): Promise<Snapshot>;
  upload(subject: string, snapshot: Snapshot, signal?: AbortSignal): Promise<BackupFile>;
  remove(subject: string, id: string, signal?: AbortSignal): Promise<void>;
  encode(snapshot: Snapshot): Promise<string>;
  decode(raw: string): Promise<Snapshot>;
}
const cancelled = (signal?: AbortSignal) => { if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError'); };
export class FilesBackup implements FilesDestination {
  constructor(private access: LocalAccess) {}
  async status(): Promise<FolderStatus> { return isIOS() ? Native.folderStatus() : { configured: false, name: null, token: null }; }
  async select(): Promise<FolderStatus> { if (!isIOS()) throw new Error('Choose a backup folder in the iPhone app. This browser supports encrypted export and restore.'); return Native.selectBackupFolder(); }
  private async token(subject: string, signal?: AbortSignal) {
    cancelled(signal);
    if (this.access.profile.subject !== subject) throw new Error('The local profile changed. Unlock it again.');
    const status = await this.status(); cancelled(signal);
    if (!status.configured || !status.token) throw new BackupError('Choose your backup folder again in Profile & Backups.');
    return status.token;
  }
  async list(subject: string, signal?: AbortSignal) {
    const token = await this.token(subject, signal); const result = await Native.listBackups({ token }); cancelled(signal);
    if (result.files.some(file => file.appProperties.profile !== subject)) throw new BackupError('This folder contains a different profile. Restore its encrypted file using its password, or choose an empty folder.', 409);
    return result.files.sort((a, b) => Date.parse(b.createdTime) - Date.parse(a.createdTime));
  }
  async download(subject: string, file: BackupFile, signal?: AbortSignal) {
    const token = await this.token(subject, signal); const { value } = await Native.readBackup({ token, id: file.id }); cancelled(signal);
    const snapshot = await this.access.decode(value); cancelled(signal); return snapshot;
  }
  async upload(subject: string, snapshot: Snapshot, signal?: AbortSignal) {
    const token = await this.token(subject, signal);
    if (snapshot.accountSubject !== subject) throw new Error('The backup profile does not match.');
    const value = await this.encode(snapshot); cancelled(signal);
    const id = `anchoros-${snapshot.createdAt}-${crypto.randomUUID()}.anchorbackup`;
    await Native.writeBackup({ token, id, value }); cancelled(signal);
    return { id, name: id, createdTime: new Date(snapshot.createdAt).toISOString(), size: String(new TextEncoder().encode(value).byteLength), appProperties: { app: 'anchoros', format: '1', installation: snapshot.installationId, revision: String(snapshot.revision), hash: snapshot.payloadSha256, profile: subject } };
  }
  async remove(subject: string, id: string, signal?: AbortSignal) { const token = await this.token(subject, signal); await Native.removeBackup({ token, id }); cancelled(signal); }
  encode = (snapshot: Snapshot) => this.access.encode(snapshot);
  decode = (raw: string) => this.access.decode(raw);
}
