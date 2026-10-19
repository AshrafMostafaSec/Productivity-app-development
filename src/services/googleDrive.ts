import { z } from 'zod';
import type { Auth } from './googleAuth';
import { MAX_BYTES } from '../storage/schema';
import { readSnapshot, snapshotText, type Snapshot } from '../backup/snapshot';

const fileSchema = z.object({ id: z.string().min(1), name: z.string(), createdTime: z.string().refine(value => Number.isFinite(Date.parse(value))), size: z.string().optional(), appProperties: z.record(z.string(), z.string()).optional() });
export type CloudFile = z.infer<typeof fileSchema>;
export class DriveError extends Error {
  constructor(message: string, public status: number, public retryAfter = 0) { super(message); }
}
export interface Drive {
  list(subject: string, signal?: AbortSignal): Promise<CloudFile[]>;
  download(subject: string, file: CloudFile, signal?: AbortSignal): Promise<Snapshot>;
  upload(subject: string, snapshot: Snapshot, signal?: AbortSignal): Promise<CloudFile>;
  remove(subject: string, id: string, signal?: AbortSignal): Promise<void>;
}

export class GoogleDrive implements Drive {
  constructor(private auth: Auth, private http: typeof fetch = (...args) => fetch(...args)) {}
  private async request(subject: string, path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<Response> {
    const accessToken = await this.auth.token(subject);
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, 30_000);
    try {
      const response = await this.http(`https://www.googleapis.com/${path}`, { ...init, signal: controller.signal, headers: { ...init.headers, Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) {
        const retry = response.headers.get('Retry-After');
        const retryAfter = retry ? (Number.isFinite(Number(retry)) ? Number(retry) * 1000 : Math.max(0, Date.parse(retry) - Date.now())) : 0;
        const message = response.status === 401 || response.status === 403 ? 'Google access needs attention. Reconnect your account and allow Drive backup.' : response.status === 429 ? 'Google is busy. Your changes are safe on this device. We will retry.' : `Backup request failed (${response.status}). Your device data is safe.`;
        throw new DriveError(message, response.status, retryAfter);
      }
      // Consume the body before clearing the timeout. Response streams can otherwise stall forever.
      const reader = response.body?.getReader();
      if (!reader) return response;
      const chunks: Uint8Array[] = []; let size = 0;
      while (true) {
        const next = await reader.read(); if (next.done) break;
        size += next.value.byteLength;
        if (size > MAX_BYTES) { await reader.cancel(); throw new Error('The cloud file exceeds the 8 MB limit.'); }
        chunks.push(next.value);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return new Response(response.status === 204 ? null : bytes, { status: response.status, headers: response.headers });
    } catch (error) {
      if (controller.signal.aborted && !signal?.aborted) throw new DriveError('The backup connection timed out. Your changes are still pending on this device.', 503);
      if (error instanceof TypeError) throw new DriveError('The internet connection is unavailable. Your changes will stay pending on this device.', 503);
      throw error;
    } finally {
      clearTimeout(timeout); signal?.removeEventListener('abort', abort);
    }
  }
  async list(subject: string, signal?: AbortSignal): Promise<CloudFile[]> {
    const files: CloudFile[] = []; let token: string | undefined;
    for (let page = 0; page < 100; page++) {
      const query = new URLSearchParams({ spaces: 'appDataFolder', pageSize: '100', orderBy: 'createdTime desc', q: "trashed = false and appProperties has { key='app' and value='anchoros' }", fields: 'nextPageToken,files(id,name,createdTime,size,appProperties)', ...(token ? { pageToken: token } : {}) });
      const response = await this.request(subject, `drive/v3/files?${query}`, {}, signal);
      const result = z.object({ nextPageToken: z.string().optional(), files: z.array(fileSchema) }).parse(await response.json());
      files.push(...result.files); token = result.nextPageToken;
      if (!token) return files;
    }
    throw new Error('There are too many cloud backups. Export your data and contact support.');
  }
  async download(subject: string, file: CloudFile, signal?: AbortSignal) {
    if (Number(file.size) > MAX_BYTES) throw new Error('This cloud backup exceeds 8 MB.');
    const result = await this.request(subject, `drive/v3/files/${encodeURIComponent(file.id)}?alt=media`, {}, signal);
    return readSnapshot(await result.text(), subject);
  }
  async upload(subject: string, snapshot: Snapshot, signal?: AbortSignal): Promise<CloudFile> {
    if (snapshot.accountSubject !== subject) throw new Error('Account mismatch. Upload stopped.');
    const boundary = `anchoros_${crypto.randomUUID()}`;
    const metadata = { name: `anchoros-${snapshot.createdAt}-${snapshot.revision}.json`, parents: ['appDataFolder'], mimeType: 'application/json', appProperties: { app: 'anchoros', format: '1', hash: snapshot.payloadSha256, installation: snapshot.installationId, revision: String(snapshot.revision) } };
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${snapshotText(snapshot)}\r\n--${boundary}--`;
    const response = await this.request(subject, 'upload/drive/v3/files?uploadType=multipart&fields=id,name,createdTime,size,appProperties', { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body }, signal);
    return fileSchema.parse(await response.json());
  }
  async remove(subject: string, id: string, signal?: AbortSignal) { await this.request(subject, `drive/v3/files/${encodeURIComponent(id)}`, { method: 'DELETE' }, signal); }
}
