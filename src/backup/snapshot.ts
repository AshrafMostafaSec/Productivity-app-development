import { z } from 'zod';
import type { AppState } from '../types';
import { MAX_BYTES, parseJson, parseState } from '../storage/schema';
import { sha256 } from '../platform/crypto';

const envelopeSchema = z.object({
  format: z.literal('anchoros-backup'), formatVersion: z.literal(1), stateSchemaVersion: z.literal(2),
  accountSubject: z.string().min(1).max(256).nullable(), installationId: z.string().min(1).max(256),
  revision: z.number().int().nonnegative(), parentSnapshotId: z.string().max(256).nullable(),
  createdAt: z.number().finite().nonnegative(), appVersion: z.string().max(64),
  payloadSha256: z.string().regex(/^[a-f0-9]{64}$/), payload: z.unknown(),
});
export interface Snapshot extends Omit<z.infer<typeof envelopeSchema>, 'payload'> { payload: AppState }

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export async function digest(value: unknown): Promise<string> {
  return sha256(canonical(value));
}
export function backupPayload(state: AppState): AppState {
  const parsed = parseState(state);
  return { ...parsed, notified: {}, ringingAlarm: null, apps: parsed.apps.map(a => ({ ...a, unlockedUntil: null })),
    // A restored timer never auto-starts a break or earns time while the app was absent.
    pomodoroSettings: { ...parsed.pomodoroSettings },
  };
}
export async function createSnapshot(state: AppState, meta: Pick<Snapshot, 'accountSubject' | 'installationId' | 'revision' | 'parentSnapshotId'>): Promise<Snapshot> {
  const payload = backupPayload(state);
  return { format: 'anchoros-backup', formatVersion: 1, stateSchemaVersion: 2, ...meta, createdAt: Date.now(), appVersion: '0.3.0', payloadSha256: await digest(payload), payload };
}
export async function readSnapshot(raw: string, subject?: string): Promise<Snapshot> {
  const checked = envelopeSchema.safeParse(parseJson(raw));
  if (!checked.success) throw new Error('This backup format is unsupported or incomplete. Choose an AnchorOS backup.');
  const envelope = checked.data;
  if (subject && envelope.accountSubject !== subject) throw new Error('This backup belongs to a different local profile.');
  // Hash original bytes as canonical JSON before parsing, so unexpected payload fields cannot be dropped silently.
  if (await digest(envelope.payload) !== envelope.payloadSha256) throw new Error('This backup is damaged. Choose an older copy.');
  const payload = parseState(envelope.payload);
  return { ...envelope, payload };
}
export function snapshotText(snapshot: Snapshot): string {
  const text = JSON.stringify(snapshot);
  if (new TextEncoder().encode(text).byteLength > MAX_BYTES) throw new Error('This backup exceeds 8 MB.');
  return text;
}
