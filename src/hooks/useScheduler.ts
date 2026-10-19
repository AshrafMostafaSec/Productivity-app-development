import { useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { dueSoon, impulseRemainingHours } from '../state/selectors';
import { PRAYER_NAMES, PRAYER_ORDER, minutesOf } from '../lib/time';
import { chime, haptic, systemNotify } from '../lib/notify';

const PHASE_COPY = {
  focus: { title: 'Focus block done', body: 'Nice work. Take your break — stand up, drink water.' },
  short: { title: 'Break’s over', body: 'Back to it. One more block.' },
  long: { title: 'Long break over', body: 'Ready for a fresh set?' },
} as const;

/**
 * Runs while the app is open: fires the Pomodoro phase change, prayer reminders,
 * deadline nudges, cooled-off purchases and alarms. Each reminder is keyed so it fires once a day.
 */
export default function useScheduler() {
  const { state, dispatch } = useStore();
  const ref = useRef(state);
  ref.current = state;

  useEffect(() => {
    const send = (key: string, title: string, body: string, sound: 'soft' | 'alarm' = 'soft') => {
      const s = ref.current;
      if (s.notified[key]) return;
      dispatch({ type: 'notify/mark', key });
      if (s.notifications.sound) chime(sound);
      haptic([20, 40, 20]);
      // In the foreground an in-app banner is enough; system notifications cover the background.
      if (document.hidden) systemNotify(title, body, key);
      else dispatch({ type: 'toast/show', text: `${title} — ${body}` });
    };

    const tick = () => {
      const s = ref.current;
      const now = new Date();
      const nowMs = now.getTime();
      const mins = now.getHours() * 60 + now.getMinutes();

      // Pomodoro phase end
      const p = s.pomodoro;
      if (p.status === 'running' && p.endsAt && p.endsAt <= nowMs) {
        dispatch({ type: 'pomo/complete' });
        if (s.notifications.pomodoro) {
          const copy = PHASE_COPY[p.phase];
          if (s.notifications.sound) chime('soft');
          haptic([30, 60, 30]);
          if (document.hidden) systemNotify(copy.title, copy.body, `pomo-${p.endsAt}`);
        }
      }

      // Prayer reminders: at the adhan time and once more 20 minutes in if still unprayed.
      if (s.notifications.prayers) {
        for (const id of PRAYER_ORDER) {
          const t = minutesOf(s.prayerTimes[id]);
          if (s.prayers[id].status !== 'none') continue;
          const name = PRAYER_NAMES[id].en;
          if (mins >= t && mins < t + 5) send(`prayer:${id}`, `${name} · ${PRAYER_NAMES[id].ar}`, 'It’s time to pray. Take a moment, then log your prayer.');
          if (mins >= t + 20 && mins < t + 25) send(`prayer-late:${id}`, `${name} still waiting`, 'A few minutes now beats rushing later.');
        }
      }

      // Morning deadline nudge at 9:00
      if (s.notifications.deadlines && mins >= 9 * 60) {
        const soon = dueSoon(s, now);
        if (soon.length) {
          const first = soon[0];
          const next = first.steps.find((st) => !st.done);
          send('deadlines', `${soon.length} deadline${soon.length > 1 ? 's' : ''} soon`, `${first.course}: ${next ? `next step is “${next.title}”` : first.title}`);
        }
      }

      // Cooled-off impulse buys
      if (s.notifications.wallet) {
        for (const item of s.impulses) {
          if (item.status === 'cooling' && impulseRemainingHours(item, nowMs) <= 0) {
            send(`impulse:${item.id}`, 'Cooling-off is over', `Still want “${item.title}”? Decide calmly now.`);
          }
        }
      }

      // Alarms (fire within their minute)
      if (!s.ringingAlarm) {
        for (const a of s.alarms) {
          if (!a.enabled || s.notified[`alarm:${a.id}`]) continue;
          const t = minutesOf(a.time);
          if (mins >= t && mins < t + 2) {
            dispatch({ type: 'alarm/ring', id: a.id });
            chime('alarm');
            haptic([200, 100, 200, 100, 200]);
            if (document.hidden) systemNotify(a.label, 'Tap to stop the alarm', `alarm-${a.id}`);
            break;
          }
        }
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [dispatch]);
}
