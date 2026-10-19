import { useEffect, useState } from 'react';
import type { PrayerId } from '../../types';
import { useStore } from '../../state/store';
import { PRAYER_NAMES, PRAYER_ORDER, minutesOf } from '../../lib/time';
import Sheet from '../../ui/Sheet';
import Group from '../../ui/Group';

export default function PrayerTimesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const [times, setTimes] = useState(state.prayerTimes);

  useEffect(() => {
    if (open) setTimes(state.prayerTimes);
  }, [open, state.prayerTimes]);

  const ordered = PRAYER_ORDER.every((p, i) => i === 0 || minutesOf(times[PRAYER_ORDER[i - 1]]) < minutesOf(times[p]));
  const complete = PRAYER_ORDER.every((p) => /^\d{2}:\d{2}$/.test(times[p]));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Prayer Times"
      action={{
        label: 'Save',
        disabled: !ordered || !complete,
        onClick: () => {
          dispatch({ type: 'prayer/setTimes', times });
          onClose();
        },
      }}
    >
      <Group
        footer={
          ordered
            ? 'Copy today’s times from your local mosque or prayer app. Routines and the app shield follow these.'
            : 'Times need to be in order from Fajr to Isha.'
        }
      >
        {PRAYER_ORDER.map((p: PrayerId) => (
          <label key={p} className="ios-row flex items-center pl-4">
            <span className="ios-row-content flex min-h-[44px] flex-1 items-center justify-between pr-4">
              <span className="text-[17px]">{PRAYER_NAMES[p].en}</span>
              <input
                type="time"
                value={times[p]}
                onChange={(e) => setTimes((t) => ({ ...t, [p]: e.target.value }))}
                className="tabular rounded-[8px] bg-fill px-2.5 py-1 text-[17px] outline-none"
              />
            </span>
          </label>
        ))}
      </Group>
    </Sheet>
  );
}
