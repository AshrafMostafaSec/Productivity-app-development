import { useEffect, useState } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { isIOS } from '../platform/native';
import { useStore } from '../state/store';
import { notificationPlan } from '../platform/notificationPlan';
import { refreshNotificationPermission } from '../lib/notify';

let queue: Promise<void> = Promise.resolve();
export default function useNativeReminders() {
  const { state, dispatch } = useStore();
  const [error, setError] = useState<string | null>(null);
  const [minute, setMinute] = useState(0);
  useEffect(() => {
    if (!isIOS()) return;
    const changed = () => setMinute(n => n + 1);
    const timer = setInterval(changed, 60_000);
    window.addEventListener('anchoros-permission', changed);
    document.addEventListener('visibilitychange', changed);
    const handle = LocalNotifications.addListener('localNotificationActionPerformed', event => {
      const extra = event.notification.extra;
      if (extra?.anchoros && extra.kind === 'alarm' && typeof extra.alarmId === 'string') dispatch({ type: 'alarm/ring', id: extra.alarmId, test: true });
    });
    return () => { clearInterval(timer); window.removeEventListener('anchoros-permission', changed); document.removeEventListener('visibilitychange', changed); void handle.then(h => h.remove()); };
  }, [dispatch]);
  useEffect(() => {
    if (!isIOS()) return;
    let cancelled = false;
    const desired = notificationPlan(state);
    queue = queue.catch(() => {}).then(async () => {
      if (cancelled) return;
      if (await refreshNotificationPermission() !== 'granted') return;
      const pending = await LocalNotifications.getPending();
      const owned = pending.notifications.filter(n => n.extra?.anchoros).map(n => ({ id: n.id }));
      if (cancelled) return;
      if (owned.length) await LocalNotifications.cancel({ notifications: owned });
      // If state changes mid-call, the next queued reconciliation will replace this set.
      if (desired.length) await LocalNotifications.schedule({ notifications: desired });
      setError(null);
    }).catch(() => { if (!cancelled) setError('Reminders could not be scheduled. Open Settings to check notification access.'); });
    return () => { cancelled = true; };
  }, [state.prayerTimes, state.prayers, state.pomodoro, state.alarms, state.assignments, state.impulses, state.notifications, state.dayKey, minute]);
  return error;
}
