import { z } from 'zod';
import type { AppState } from '../types';
import { createInitialState } from '../state/initialState';

export const MAX_BYTES = 8 * 1024 * 1024;
const text = z.string().max(4000);
const id = z.string().min(1).max(256).refine(v => !['__proto__', 'constructor', 'prototype'].includes(v));
const number = z.number().finite();
const positive = number.nonnegative();
const integer = positive.int();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const [y, m, d] = v.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
});
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const prayers = z.enum(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']);
const record = <T extends z.ZodType>(value: T) => z.record(id, value);
const array = <T extends z.ZodType>(value: T) => z.array(value).max(20000);
const step = z.object({ id, title: text, done: z.boolean() });
const prayerDay = z.object({ status: z.enum(['none', 'on_time', 'late']), sunnah: z.boolean() });
const five = <T extends z.ZodType>(value: T) => z.object({ fajr: value, dhuhr: value, asr: value, maghrib: value, isha: value });

export const appStateSchema = z.object({
  version: z.literal(2), dayKey: day, balance: positive,
  transactions: array(z.object({ id, label: text, delta: number, source: z.enum(['prayer', 'routine', 'uni', 'shield', 'wallet', 'deen', 'focus']), at: positive })),
  earned: record(z.boolean()), prayerTimes: five(time), prayers: five(prayerDay), prayerStreak: integer,
  routines: array(z.object({ id, title: text, anchor: prayers, minutes: positive, starter: text, steps: array(step), done: z.boolean() })),
  brainDump: array(z.object({ id, text, at: positive })),
  assignments: array(z.object({ id, course: text, title: text, dueDate: day, steps: array(step) })),
  apps: array(z.object({ id, name: text, cost: positive, unlockedUntil: positive.nullable(), blockedToday: integer })),
  strictPrayerLock: z.boolean(),
  pomodoro: z.object({ phase: z.enum(['focus', 'short', 'long']), status: z.enum(['idle', 'running', 'paused', 'ready']), endsAt: positive.nullable(), remainingMs: positive, phaseMs: positive, cycle: integer, subject: text, task: text }),
  pomodoroSettings: z.object({ focus: positive.min(1).max(240), short: positive.min(1).max(60), long: positive.min(1).max(120), cyclesBeforeLong: integer.min(1).max(12), autoStart: z.boolean() }),
  studyLog: array(z.object({ id, at: positive, dayKey: day, minutes: positive, subject: text, task: text })),
  focusGoalMins: positive,
  alarms: array(z.object({ id, time, label: text, enabled: z.boolean(), mission: z.enum(['math', 'tap']) })),
  ringingAlarm: id.nullable(),
  adhkar: z.record(z.string().regex(/^(morning|evening|sleep|after:(fajr|dhuhr|asr|maghrib|isha))$/), record(integer)),
  qiyam: z.object({ rakaat: integer, witr: z.boolean() }),
  quran: z.object({ goalPages: positive.min(1).max(604), pagesToday: positive, position: integer.max(604), streak: integer }),
  tasbih: z.object({ phraseId: id, target: integer.min(1), count: integer, totalToday: integer }),
  habits: record(z.boolean()), budget: z.object({ daily: positive, currency: z.string().min(1).max(12) }),
  expenses: array(z.object({ id, title: text, amount: positive, category: z.enum(['Food', 'Study', 'Transport', 'Personal']), at: positive, dayKey: day })),
  impulses: array(z.object({ id, title: text, price: positive, trigger: text, addedAt: positive, waitHours: positive, status: z.enum(['cooling', 'skipped', 'bought']) })),
  savedTotal: positive,
  history: array(z.object({ dayKey: day, prayers: integer.max(5), onTime: integer.max(5), focusMins: positive, tasksDone: integer, tasksTotal: integer, spent: positive, quranPages: positive, adhkar: integer, earned: number })),
  notifications: z.object({ prayers: z.boolean(), pomodoro: z.boolean(), deadlines: z.boolean(), wallet: z.boolean(), sound: z.boolean() }),
  notified: record(z.boolean()), onboarded: z.boolean(),
});

function assertSafe(value: unknown, depth = 0): void {
  if (depth > 64) throw new Error('This data is nested too deeply.');
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('This data contains an unsafe field name.');
    assertSafe((value as Record<string, unknown>)[key], depth + 1);
  }
}
export function parseState(input: unknown): AppState {
  assertSafe(input);
  if (!input || typeof input !== 'object') throw new Error('This file does not contain app data.');
  const old = input as Record<string, unknown>;
  if (old.version === 1) {
    // Known v1 fields are preserved. New fields are filled recursively, never by trusting a type cast.
    const merged = mergeDefaults(createInitialState(), old) as Record<string, unknown>;
    merged.version = 2;
    const result = appStateSchema.safeParse(merged);
    if (!result.success) throw new Error('This saved data has invalid or missing values. Choose a valid backup.');
    return result.data;
  }
  if (old.version !== 2) throw new Error('This data version is not supported. Update the app before restoring it.');
  const result = appStateSchema.safeParse(input);
  if (!result.success) throw new Error('This saved data has invalid or missing values. Choose a valid backup.');
  return result.data;
}

function mergeDefaults(fresh: unknown, saved: unknown): unknown {
  if (saved === undefined) return fresh;
  if (!fresh || typeof fresh !== 'object' || Array.isArray(fresh) || !saved || typeof saved !== 'object' || Array.isArray(saved)) return saved;
  return Object.fromEntries(Object.entries(fresh).map(([key, value]) => [key, mergeDefaults(value, (saved as Record<string, unknown>)[key])]));
}

export function parseJson(raw: string): unknown {
  if (new TextEncoder().encode(raw).byteLength > MAX_BYTES) throw new Error('This file is too large. The limit is 8 MB.');
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('This file is not valid JSON. Your existing data has not been changed.'); }
  assertSafe(value); return value;
}

export const profileSchema = z.object({ subject: id, email: z.string().max(320), name: text });
export type Account = z.infer<typeof profileSchema>;
const datasetSchema = z.object({
  state: appStateSchema, revision: integer, updatedAt: positive, hasEdits: z.boolean(), dirty: z.boolean(),
  headId: id.nullable(), lastHash: z.string().max(64).nullable(), lastBackupAt: positive.nullable(),
  enabled: z.boolean(), recoveryChecked: z.boolean(), rollback: appStateSchema.nullable().default(null),
});
export type Dataset = z.infer<typeof datasetSchema>;
export const vaultSchema = z.object({
  format: z.literal(1), installationId: id, activeScope: id,
  datasets: record(datasetSchema), accounts: record(profileSchema),
});
export type Vault = z.infer<typeof vaultSchema>;

export function parseVault(raw: string): Vault {
  const parsed = vaultSchema.safeParse(parseJson(raw));
  if (!parsed.success) throw new Error('Device data is incomplete or from an unsupported version. Restore a valid backup.');
  const vault = parsed.data;
  if (!vault.datasets[vault.activeScope] || !vault.datasets.guest) throw new Error('Device data is incomplete. Restore a backup to continue.');
  return vault;
}

export function newDataset(state = createInitialState()): Dataset {
  return { state: parseState(state), revision: 0, updatedAt: Date.now(), hasEdits: false, dirty: false, headId: null, lastHash: null, lastBackupAt: null, enabled: false, recoveryChecked: false, rollback: null };
}

export function emptyState(): AppState {
  return { ...createInitialState(), routines: [], assignments: [], brainDump: [], alarms: [], balance: 0, onboarded: true };
}
