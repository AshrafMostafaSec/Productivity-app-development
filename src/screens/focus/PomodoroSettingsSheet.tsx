import { useStore } from '../../state/store';
import Sheet from '../../ui/Sheet';
import Group from '../../ui/Group';
import Row from '../../ui/Row';
import Stepper from '../../ui/Stepper';
import Toggle from '../../ui/Toggle';
import type { PomodoroSettings } from '../../types';

const LIMITS: Record<'focus' | 'short' | 'long' | 'cyclesBeforeLong', { min: number; max: number; step: number; unit: string; label: string }> = {
  focus: { min: 5, max: 90, step: 5, unit: 'min', label: 'Focus' },
  short: { min: 1, max: 30, step: 1, unit: 'min', label: 'Short break' },
  long: { min: 5, max: 45, step: 5, unit: 'min', label: 'Long break' },
  cyclesBeforeLong: { min: 2, max: 8, step: 1, unit: 'blocks', label: 'Long break after' },
};

export default function PomodoroSettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const s = state.pomodoroSettings;
  const set = (patch: Partial<PomodoroSettings>) => dispatch({ type: 'pomo/settings', patch });

  return (
    <Sheet open={open} onClose={onClose} title="Timer" hideCancel>
      <Group header="Durations" footer="Classic Pomodoro is 25 / 5, with a long break every 4 blocks. On hard days try 15 / 5.">
        {(Object.keys(LIMITS) as (keyof typeof LIMITS)[]).map((key) => {
          const l = LIMITS[key];
          const v = s[key];
          return (
            <Row
              key={key}
              title={l.label}
              trailing={
                <>
                  <span className="tabular w-[68px] text-right text-[17px] text-secondary">
                    {v} {l.unit}
                  </span>
                  <Stepper
                    label={l.label}
                    canDecrement={v > l.min}
                    onDecrement={() => set({ [key]: Math.max(l.min, v - l.step) })}
                    onIncrement={() => set({ [key]: Math.min(l.max, v + l.step) })}
                  />
                </>
              }
            />
          );
        })}
      </Group>
      <Group footer="When on, breaks and the next block begin automatically.">
        <Row title="Auto-start next phase" trailing={<Toggle label="Auto-start" checked={s.autoStart} onChange={() => set({ autoStart: !s.autoStart })} />} />
        <Row title="Sound" trailing={<Toggle label="Sound" checked={state.notifications.sound} onChange={() => dispatch({ type: 'notify/settings', patch: { sound: !state.notifications.sound } })} />} />
      </Group>
      <Group header="Daily goal">
        <Row
          title="Focus goal"
          trailing={
            <>
              <span className="tabular w-[68px] text-right text-[17px] text-secondary">{state.focusGoalMins} min</span>
              <Stepper
                label="focus goal"
                canDecrement={state.focusGoalMins > 30}
                onDecrement={() => dispatch({ type: 'focus/goal', minutes: state.focusGoalMins - 15 })}
                onIncrement={() => dispatch({ type: 'focus/goal', minutes: Math.min(600, state.focusGoalMins + 15) })}
              />
            </>
          }
        />
      </Group>
    </Sheet>
  );
}
