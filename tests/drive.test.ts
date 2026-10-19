import { describe, it, expect, vi } from 'vitest';
import { GoogleDrive, DriveError } from '../src/services/googleDrive';
import { FakeAuth, accountA } from './support';
import { createSnapshot, snapshotText } from '../src/backup/snapshot';
import { createInitialState } from '../src/state/initialState';

describe('Google Drive HTTP boundary', () => {
  const file = { id: 'file-1', name: 'backup.json', createdTime: '2026-10-19T01:00:00Z', size: '100' };
  function client(http: typeof fetch) { const auth = new FakeAuth(); auth.current = accountA; return new GoogleDrive(auth, http); }
  it('paginates appDataFolder only and sends the authorized account token', async () => {
    const http = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ files: [file], nextPageToken: 'next' })).mockResolvedValueOnce(Response.json({ files: [] }));
    const files = await client(http).list(accountA.subject); expect(files).toHaveLength(1);
    const query = new URL(String(http.mock.calls[0][0])); expect(query.searchParams.get('spaces')).toBe('appDataFolder');
    expect((http.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
    expect(new URL(String(http.mock.calls[1][0])).searchParams.get('pageToken')).toBe('next');
  });
  it('does not contact Drive when the signed-in account differs', async () => {
    const http = vi.fn<typeof fetch>(); await expect(client(http).list('other-account')).rejects.toThrow('Wrong account'); expect(http).not.toHaveBeenCalled();
  });
  it('verifies account identity and integrity after download', async () => {
    const snapshot = await createSnapshot(createInitialState(), { accountSubject: accountA.subject, installationId: 'device', revision: 1, parentSnapshotId: null });
    const http = vi.fn<typeof fetch>().mockResolvedValue(new Response(snapshotText(snapshot)));
    expect((await client(http).download(accountA.subject, file)).payloadSha256).toBe(snapshot.payloadSha256);
    snapshot.payload.balance++;
    http.mockResolvedValue(new Response(snapshotText(snapshot)));
    await expect(client(http).download(accountA.subject, file)).rejects.toThrow(/damaged/);
  });
  it('uploads immutable app-specific snapshots with no credentials in the JSON', async () => {
    const snapshot = await createSnapshot(createInitialState(), { accountSubject: accountA.subject, installationId: 'device', revision: 1, parentSnapshotId: null });
    const http = vi.fn<typeof fetch>().mockResolvedValue(Response.json(file)); await client(http).upload(accountA.subject, snapshot);
    expect(String(http.mock.calls[0][0])).toContain('uploadType=multipart');
    const body = String(http.mock.calls[0][1]?.body); expect(body).toContain('appDataFolder'); expect(body).not.toContain('test-token');
  });
  it('honors Retry-After and surfaces auth failures without erasing data', async () => {
    const http = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 429, headers: { 'Retry-After': '7' } }));
    await expect(client(http).list(accountA.subject)).rejects.toMatchObject({ status: 429, retryAfter: 7000 });
    http.mockResolvedValue(new Response('', { status: 403 })); await expect(client(http).list(accountA.subject)).rejects.toBeInstanceOf(DriveError);
  });
  it('limits a streaming download even without Content-Length', async () => {
    const huge = new Uint8Array(8 * 1024 * 1024 + 1);
    const http = vi.fn<typeof fetch>().mockResolvedValue(new Response(huge));
    await expect(client(http).download(accountA.subject, file)).rejects.toThrow(/8 MB/);
  });
});
