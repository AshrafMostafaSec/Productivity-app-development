import { describe, it, expect } from 'vitest';
import { notificationPlan } from '../src/platform/notificationPlan';
import { createInitialState } from '../src/state/initialState';
import { dayKeyOf } from '../src/lib/time';
import { retentionCandidates } from '../src/backup/retention';
import type { BackupFile } from '../src/services/filesBackup';

describe('native reminder plan', () => {
  const now = new Date(2026, 9, 19, 4, 0);
  it('schedules future reminders, keeps IDs unique, and never exceeds the iOS budget', () => {
    const state = createInitialState(now); const plan = notificationPlan(state, now);
    expect(new Set(plan.map(n => n.id)).size).toBe(plan.length); expect(plan.length).toBeLessThanOrEqual(60);
    expect(plan.every(n => !n.schedule?.at || n.schedule.at > now)).toBe(true);
    expect(plan.some(n => n.extra.kind === 'alarm' && n.schedule?.repeats)).toBe(true);
  });
  it('cancels today’s prayer reminders after logging it and respects toggles', () => {
    const state = createInitialState(now); state.prayers.fajr.status = 'on_time';
    expect(notificationPlan(state, now).some(n => n.extra.key === `prayer:fajr:${dayKeyOf(now)}`)).toBe(false);
    state.notifications.prayers = false; state.alarms = [];
    expect(notificationPlan(state, now)).toEqual([]);
  });
  it('replaces a paused or completed timer notification', () => {
    const state = createInitialState(now); state.pomodoro = { ...state.pomodoro, status: 'running', endsAt: now.getTime() + 60000 };
    expect(notificationPlan(state, now).filter(n => n.extra.kind === 'pomodoro')).toHaveLength(1);
    state.pomodoro.status = 'paused'; expect(notificationPlan(state, now).filter(n => n.extra.kind === 'pomodoro')).toHaveLength(0);
  });
});
it('retains 20 recent revisions, daily copies for 30 days, and unknown-format files', () => {
  const now = Date.UTC(2026, 9, 19, 12);
  const files: BackupFile[] = Array.from({ length: 100 }, (_, i) => ({ id: `${i}`, name: 'b', createdTime: new Date(now - i * 86400_000 / 2).toISOString(), appProperties: { format: '1' } }));
  const deleted = retentionCandidates(files, now);
  expect(deleted.every(f => Number(f.id) >= 20)).toBe(true);
  const kept = files.filter(f => !deleted.includes(f));
  expect(new Set(kept.filter(f => now - Date.parse(f.createdTime) <= 30 * 86400_000).map(f => f.createdTime.slice(0, 10))).size).toBe(31);
  expect(retentionCandidates([{ ...files[99], appProperties: { format: 'future' } }], now)).toEqual([]);
});
