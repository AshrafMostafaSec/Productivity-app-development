import type { LocalNotificationSchema } from '@capacitor/local-notifications';
import type { AppState } from '../types';
import { PRAYER_NAMES, PRAYER_ORDER, dayKeyOf } from '../lib/time';

/** Refresh rolling reminders on app use; daily alarms repeat independently of JavaScript. */
export function notificationPlan(state: AppState, now = new Date()): LocalNotificationSchema[] {
  const result: (LocalNotificationSchema & { priority: number })[] = [];
  const sound = state.notifications.sound ? undefined : '';
  const push = (key: string, title: string, body: string, at: Date, priority: number, extra: Record<string, unknown> = {}) => {
    if (at.getTime() <= now.getTime()) return;
    result.push({ id: 0, title, body, sound, schedule: { at }, extra: { anchoros: true, key, ...extra }, priority });
  };
  for (let offset = 0; offset < 3; offset++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    if (state.notifications.prayers) for (const prayer of PRAYER_ORDER) {
      if (offset === 0 && state.dayKey === dayKeyOf(now) && state.prayers[prayer].status !== 'none') continue;
      const [h, m] = state.prayerTimes[prayer].split(':').map(Number);
      const at = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m);
      push(`prayer:${prayer}:${dayKeyOf(date)}`, `${PRAYER_NAMES[prayer].en} prayer`, 'Take a moment to pray. Log it when you are ready.', at, 2);
      push(`nudge:${prayer}:${dayKeyOf(date)}`, `${PRAYER_NAMES[prayer].en} reminder`, 'If you have not prayed yet, make a little space now.', new Date(at.getTime() + 20 * 60_000), 3);
    }
    if (state.notifications.deadlines) {
      const due = state.assignments.filter(a => a.dueDate >= dayKeyOf(date) && a.dueDate <= dayKeyOf(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 2)) && a.steps.some(s => !s.done));
      if (due.length) push(`deadline:${dayKeyOf(date)}`, 'A small study step', `${due[0].course}: ${due[0].title}`, new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9), 4);
    }
  }
  if (state.notifications.pomodoro && state.pomodoro.status === 'running' && state.pomodoro.endsAt) {
    push('pomodoro', state.pomodoro.phase === 'focus' ? 'Focus block done' : 'Break finished', 'Open AnchorOS to continue.', new Date(state.pomodoro.endsAt), 0, { kind: 'pomodoro' });
  }
  if (state.notifications.wallet) for (const item of state.impulses.filter(i => i.status === 'cooling')) {
    push(`impulse:${item.id}`, 'Cooling-off finished', `Still want “${item.title}”? Decide calmly.`, new Date(item.addedAt + item.waitHours * 3600_000), 4);
  }
  for (const alarm of state.alarms.filter(a => a.enabled).slice(0, 20)) {
    const [hour, minute] = alarm.time.split(':').map(Number);
    result.push({ id: 0, title: alarm.label, body: alarm.mission === 'math' ? 'Open AnchorOS for your wake-up mission.' : 'Open AnchorOS when you are ready.', sound, schedule: { on: { hour, minute }, repeats: true }, extra: { anchoros: true, kind: 'alarm', alarmId: alarm.id, key: `alarm:${alarm.id}` }, priority: 1 });
  }
  // Stay below iOS's pending notification limit; reserve room for system scheduling.
  return result.sort((a, b) => a.priority - b.priority || (a.schedule?.at?.getTime() ?? 0) - (b.schedule?.at?.getTime() ?? 0)).slice(0, 60).map(({ priority: _, ...notification }, index) => ({ ...notification, id: 1000 + index }));
}
