import type { AdhkarSessionId, AppState, DayRecord, Impulse } from '../types';
import { collectionFor } from '../data/adhkar';
import { PRAYER_ORDER, dayKeyOf, daysUntil } from '../lib/time';

export function spentToday(state: AppState): number {
  return state.expenses.filter((e) => e.dayKey === state.dayKey).reduce((sum, e) => sum + e.amount, 0);
}

export function safeToSpend(state: AppState): number {
  return state.budget.daily - spentToday(state);
}

export function money(state: AppState, amount: number): string {
  const sign = amount < 0 ? '−' : '';
  return `${sign}${state.budget.currency}${Math.abs(amount).toFixed(Math.abs(amount) % 1 === 0 ? 0 : 2)}`;
}

export function dueSoon(state: AppState, now: Date) {
  return state.assignments.filter((a) => a.steps.some((s) => !s.done) && daysUntil(a.dueDate, now) <= 2);
}

export function adhkarProgress(state: AppState, session: AdhkarSessionId) {
  const items = collectionFor(session).items;
  const progress = state.adhkar[session] ?? {};
  const done = items.filter((i) => (progress[i.id] ?? 0) >= i.count).length;
  return { done, total: items.length, complete: done === items.length };
}

export function impulseRemainingHours(item: Impulse, now: number): number {
  return Math.max(0, item.waitHours - (now - item.addedAt) / 3_600_000);
}

export function focusMinutesOn(state: AppState, dayKey: string): number {
  return state.studyLog.filter((s) => s.dayKey === dayKey).reduce((sum, s) => sum + s.minutes, 0);
}

export function pomodorosToday(state: AppState): number {
  return state.studyLog.filter((s) => s.dayKey === state.dayKey && s.minutes >= 10).length;
}

/** Snapshot of a day for the progress view. Used live for today and frozen into history at rollover. */
export function recordFor(state: AppState): DayRecord {
  const prayers = PRAYER_ORDER.filter((p) => state.prayers[p].status !== 'none');
  return {
    dayKey: state.dayKey,
    prayers: prayers.length,
    onTime: prayers.filter((p) => state.prayers[p].status === 'on_time').length,
    focusMins: focusMinutesOn(state, state.dayKey),
    tasksDone: state.routines.filter((r) => r.done).length,
    tasksTotal: state.routines.length,
    spent: spentToday(state),
    quranPages: state.quran.pagesToday,
    adhkar: Object.keys(state.earned).filter((k) => k.startsWith('adhkar:')).length,
    earned: state.transactions
      .filter((t) => t.delta > 0 && dayKeyOf(new Date(t.at)) === state.dayKey)
      .reduce((sum, t) => sum + t.delta, 0),
  };
}

/** The last `n` days ending today, oldest first, with empty records for days without data. */
export function lastDays(state: AppState, n = 7): DayRecord[] {
  const today = recordFor(state);
  const byKey = new Map(state.history.map((h) => [h.dayKey, h]));
  const [y, m, d] = state.dayKey.split('-').map(Number);
  const out: DayRecord[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const key = dayKeyOf(new Date(y, m - 1, d - i));
    out.push(
      i === 0
        ? today
        : byKey.get(key) ?? { dayKey: key, prayers: 0, onTime: 0, focusMins: 0, tasksDone: 0, tasksTotal: 0, spent: 0, quranPages: 0, adhkar: 0, earned: 0 },
    );
  }
  return out;
}

export function studyBySubject(state: AppState, days = 7): { subject: string; minutes: number }[] {
  const [y, m, d] = state.dayKey.split('-').map(Number);
  const from = dayKeyOf(new Date(y, m - 1, d - days + 1));
  const totals = new Map<string, number>();
  for (const s of state.studyLog) {
    if (s.dayKey < from) continue;
    const key = s.subject || 'General';
    totals.set(key, (totals.get(key) ?? 0) + s.minutes);
  }
  return [...totals.entries()].map(([subject, minutes]) => ({ subject, minutes })).sort((a, b) => b.minutes - a.minutes);
}

export function courses(state: AppState): string[] {
  return [...new Set(state.assignments.map((a) => a.course))];
}
