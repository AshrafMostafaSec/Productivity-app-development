import { useState } from 'react';
import { useStore } from '../../state/store';
import { lastDays, studyBySubject } from '../../state/selectors';
import Sheet from '../../ui/Sheet';
import Card from '../../ui/Card';
import Segmented from '../../ui/Segmented';
import BarChart from '../../ui/BarChart';
import { RING_COLORS } from '../today/DayRings';

const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type Metric = 'prayers' | 'focusMins' | 'tasksDone' | 'quranPages' | 'earned';
const METRICS: { value: Metric; label: string; unit: string }[] = [
  { value: 'prayers', label: 'Salah', unit: 'prayers' },
  { value: 'focusMins', label: 'Focus', unit: 'min' },
  { value: 'tasksDone', label: 'Tasks', unit: 'done' },
  { value: 'quranPages', label: 'Quran', unit: 'pages' },
];

/** Weekly / monthly progress across every area of the app. */
export default function InsightsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = useStore();
  const [range, setRange] = useState<7 | 30>(7);
  const [metric, setMetric] = useState<Metric>('focusMins');
  const days = lastDays(state, range);
  const sum = (k: Metric) => days.reduce((a, d) => a + d[k], 0);
  const avg = (k: Metric) => sum(k) / days.length;
  const perfect = days.filter((d) => d.prayers === 5).length;
  const subjects = studyBySubject(state, range);
  const maxSub = Math.max(1, ...subjects.map((s) => s.minutes));
  const goal = metric === 'prayers' ? 5 : metric === 'focusMins' ? state.focusGoalMins : metric === 'quranPages' ? state.quran.goalPages : undefined;
  const best = Math.max(...days.map((d) => d.focusMins));

  return (
    <Sheet open={open} onClose={onClose} title="Progress" hideCancel tall>
      <div className="mb-4">
        <Segmented label="Range" value={range} onChange={setRange} options={[{ value: 7, label: 'Week' }, { value: 30, label: 'Month' }]} />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Stat label="Prayers logged" value={`${sum('prayers')}`} detail={`${perfect} perfect days`} color={RING_COLORS.salah} />
        <Stat label="Focus time" value={`${Math.round(sum('focusMins') / 60 * 10) / 10}h`} detail={`${Math.round(avg('focusMins'))} min / day avg`} color={RING_COLORS.focus} />
        <Stat label="Routine tasks" value={`${sum('tasksDone')}`} detail="completed" color={RING_COLORS.tasks} />
        <Stat label="Minutes earned" value={`${sum('earned')}`} detail={`${state.prayerStreak}-day prayer streak`} color="#007AFF" />
      </div>

      <Card className="mb-4">
        <div className="mb-4">
          <Segmented label="Metric" value={metric} onChange={setMetric} options={METRICS.map((m) => ({ value: m.value, label: m.label }))} />
        </div>
        <BarChart
          data={days.map((d, i) => ({
            label: range === 7 ? WEEKDAY[new Date(d.dayKey + 'T12:00').getDay()] : i % 5 === 4 || i === days.length - 1 ? String(new Date(d.dayKey + 'T12:00').getDate()) : '',
            value: d[metric],
            highlight: i === days.length - 1,
          }))}
          goal={goal}
          height={140}
        />
        <p className="mt-3 text-[13px] text-secondary">
          Average {Math.round(avg(metric) * 10) / 10} {METRICS.find((m) => m.value === metric)!.unit} a day
          {metric === 'focusMins' && best > 0 && ` · best day ${best} min`}
        </p>
      </Card>

      <Card>
        <p className="mb-3 text-[15px] font-semibold">Study by subject</p>
        {subjects.length === 0 && <p className="text-[14px] text-secondary">Finish a Pomodoro to see where your study time goes.</p>}
        <div className="space-y-3">
          {subjects.map((s) => (
            <div key={s.subject}>
              <div className="mb-1 flex justify-between text-[14px]">
                <span>{s.subject}</span>
                <span className="tabular text-secondary">
                  {Math.floor(s.minutes / 60) > 0 && `${Math.floor(s.minutes / 60)}h `}
                  {s.minutes % 60}m
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-fill">
                <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${(s.minutes / maxSub) * 100}%`, background: RING_COLORS.focus }} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </Sheet>
  );
}

function Stat({ label, value, detail, color }: { label: string; value: string; detail: string; color: string }) {
  return (
    <div className="rounded-[16px] bg-card p-3.5">
      <p className="text-[12px] font-medium text-secondary">{label}</p>
      <p className="tabular mt-0.5 text-[26px] font-bold tracking-[-0.02em]" style={{ color }}>
        {value}
      </p>
      <p className="text-[12px] text-secondary">{detail}</p>
    </div>
  );
}
