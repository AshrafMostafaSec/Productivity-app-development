import { PRAYER_ORDER } from '../../lib/time';
import { useStore } from '../../state/store';
import { focusMinutesOn } from '../../state/selectors';
import { ProgressRing } from '../../ui/Progress';
import AnimatedNumber from '../../ui/AnimatedNumber';

export const RING_COLORS = { salah: '#007AFF', focus: '#32ADE6', tasks: '#5856D6' };

/** Three nested rings for the day — Salah, Focus, Tasks. */
export default function DayRings({ onOpen }: { onOpen: () => void }) {
  const { state } = useStore();
  const prayed = PRAYER_ORDER.filter((p) => state.prayers[p].status !== 'none').length;
  const focus = focusMinutesOn(state, state.dayKey);
  const done = state.routines.filter((r) => r.done).length;
  const total = Math.max(1, state.routines.length);

  const rows = [
    { key: 'salah', label: 'Salah', value: prayed, goal: 5, unit: '', color: RING_COLORS.salah },
    { key: 'focus', label: 'Focus', value: focus, goal: state.focusGoalMins, unit: 'm', color: RING_COLORS.focus },
    { key: 'tasks', label: 'Tasks', value: done, goal: total, unit: '', color: RING_COLORS.tasks },
  ];

  return (
    <button onClick={onOpen} className="flex w-full items-center gap-5 rounded-[20px] bg-card p-4 text-left transition-transform active:scale-[0.985]">
      <div className="relative h-[108px] w-[108px] shrink-0">
        {rows.map((r, i) => {
          const size = 108 - i * 30;
          return (
            <div key={r.key} className="absolute" style={{ inset: i * 15 }}>
              <ProgressRing value={r.value / r.goal} size={size} stroke={12} color={r.color} track={`${r.color}22`} />
            </div>
          );
        })}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {rows.map((r) => (
          <div key={r.key}>
            <p className="text-[13px] font-medium text-secondary">{r.label}</p>
            <p className="text-[19px] font-semibold leading-tight tracking-[-0.01em]" style={{ color: r.color }}>
              <AnimatedNumber value={r.value} />
              <span className="text-[14px] font-medium text-secondary">
                /{r.goal}
                {r.unit}
              </span>
            </p>
          </div>
        ))}
      </div>
    </button>
  );
}
