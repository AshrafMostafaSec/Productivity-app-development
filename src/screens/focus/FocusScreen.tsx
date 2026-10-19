import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { ShieldApp } from '../../types';
import { useStore } from '../../state/store';
import { prayerLockReason } from '../../state/reducer';
import { REWARDS } from '../../state/rewards';
import useNow from '../../lib/useNow';
import { currentPrayer, daysUntil, dueLabel, timeLabel } from '../../lib/time';
import Screen, { CircleAction } from '../../ui/Screen';
import SubTabs from '../../ui/SubTabs';
import useSection from '../../ui/useSection';
import Group from '../../ui/Group';
import Row from '../../ui/Row';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import Toggle from '../../ui/Toggle';
import IconTile from '../../ui/IconTile';
import EmptyState from '../../ui/EmptyState';
import AnimatedNumber from '../../ui/AnimatedNumber';
import { ProgressRing } from '../../ui/Progress';
import PomodoroPanel from './PomodoroPanel';
import AssignmentSheet from './AssignmentSheet';
import AddAssignmentSheet from './AddAssignmentSheet';
import InterceptSheet from './InterceptSheet';

const SECTIONS = ['pomodoro', 'uni', 'shield'] as const;
type Section = (typeof SECTIONS)[number];

export default function FocusScreen() {
  const { state } = useStore();
  const now = useNow(15_000);
  const { section, direction, setSection } = useSection<Section>(SECTIONS);
  const [addingAssignment, setAddingAssignment] = useState(false);
  const urgent = state.assignments.some((a) => a.steps.some((s) => !s.done) && daysUntil(a.dueDate, now) <= 1);

  return (
    <Screen
      eyebrow={`${state.balance} min earned`}
      title="Focus"
      action={
        section === 'uni' && (
          <CircleAction label="Add deadline" onClick={() => setAddingAssignment(true)}>
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </CircleAction>
        )
      }
      tabs={
        <SubTabs
          value={section}
          onChange={setSection}
          options={[
            { value: 'pomodoro', label: 'Pomodoro' },
            { value: 'uni', label: 'Uni', badge: urgent },
            { value: 'shield', label: 'Shield' },
          ]}
        />
      }
      sectionKey={section}
      direction={direction}
    >
      {section === 'pomodoro' && <PomodoroPanel />}
      {section === 'uni' && <UniPanel onStudy={() => setSection('pomodoro')} onAdd={() => setAddingAssignment(true)} />}
      {section === 'shield' && <ShieldPanel />}
      <AddAssignmentSheet open={addingAssignment} onClose={() => setAddingAssignment(false)} />
    </Screen>
  );
}

function UniPanel({ onStudy, onAdd }: { onStudy: () => void; onAdd: () => void }) {
  const { state } = useStore();
  const now = useNow(60_000);
  const [openId, setOpenId] = useState<string | null>(null);
  const sorted = [...state.assignments].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const isDone = (a: (typeof sorted)[number]) => a.steps.length > 0 && a.steps.every((s) => s.done);
  const week = sorted.filter((a) => !isDone(a) && daysUntil(a.dueDate, now) <= 7);
  const later = sorted.filter((a) => !isDone(a) && daysUntil(a.dueDate, now) > 7);
  const done = sorted.filter(isDone);

  const list = (items: typeof sorted) =>
    items.map((a) => {
      const doneSteps = a.steps.filter((s) => s.done).length;
      const next = a.steps.find((s) => !s.done);
      const days = daysUntil(a.dueDate, now);
      return (
        <Row
          key={a.id}
          leading={<ProgressRing value={a.steps.length ? doneSteps / a.steps.length : 0} size={32} stroke={4} />}
          title={`${a.course} · ${a.title}`}
          muted={isDone(a)}
          subtitle={
            isDone(a) ? (
              'All steps done'
            ) : (
              <>
                <span className={days <= 1 ? 'font-semibold text-danger' : ''}>{dueLabel(a.dueDate, now)}</span>
                {next && ` · ${next.title}`}
              </>
            )
          }
          onClick={() => setOpenId(a.id)}
          chevron
        />
      );
    });

  return (
    <>
      {state.assignments.length === 0 ? (
        <Card className="mb-7 text-center">
          <p className="text-[17px] font-semibold">No deadlines yet</p>
          <p className="mt-1 text-[15px] text-secondary">Add one and split it into steps small enough to start today.</p>
          <Button className="mt-4" onClick={onAdd}>
            Add deadline
          </Button>
        </Card>
      ) : (
        <>
          <Group header="This week">{week.length ? list(week) : <EmptyState title="Clear week" detail="Nothing due in the next 7 days." />}</Group>
          {later.length > 0 && <Group header="Later">{list(later)}</Group>}
          {done.length > 0 && <Group header="Finished">{list(done)}</Group>}
        </>
      )}
      <AssignmentSheet id={openId} onClose={() => setOpenId(null)} onStudy={onStudy} />
    </>
  );
}

function ShieldPanel() {
  const { state, dispatch } = useStore();
  const now = useNow(15_000);
  const [intercept, setIntercept] = useState<ShieldApp | null>(null);
  const lock = prayerLockReason(state, currentPrayer(state.prayerTimes, now));
  const nowMs = now.getTime();

  return (
    <>
      <Card className="mb-7">
        <p className="text-[13px] font-semibold uppercase tracking-[0.02em] text-secondary">Screen-time bank</p>
        <p className="mt-0.5 text-[48px] font-bold leading-tight tracking-[-0.03em]">
          <AnimatedNumber value={state.balance} />
          <span className="text-[22px] font-semibold text-secondary"> min</span>
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            { v: `+${REWARDS.prayerOnTime}`, l: 'Prayer on time' },
            { v: '+1/min', l: 'Pomodoro' },
            { v: `+${REWARDS.routineDone}`, l: 'Routine done' },
          ].map((x) => (
            <div key={x.l} className="rounded-[10px] bg-fill px-1 py-2">
              <p className="tabular text-[15px] font-semibold text-accent">{x.v}</p>
              <p className="text-[11px] text-secondary">{x.l}</p>
            </div>
          ))}
        </div>
        {lock && <p className="mt-3 rounded-[10px] bg-accent/10 px-3 py-2 text-[14px] font-medium text-accent">{lock} — apps stay locked until then.</p>}
      </Card>

      <Group footer="While a prayer window is open and unprayed, apps stay locked — even with minutes in the bank.">
        <Row title="Pray before unlocking" trailing={<Toggle label="Pray before unlocking" checked={state.strictPrayerLock} onChange={() => dispatch({ type: 'shield/toggleStrict' })} />} />
      </Group>

      <Group header="Apps" footer="Tap an app to rehearse the pause you'll get when you reach for it.">
        {state.apps.map((app) => {
          const open = app.unlockedUntil !== null && app.unlockedUntil > nowMs;
          const minsLeft = open ? Math.ceil((app.unlockedUntil! - nowMs) / 60_000) : 0;
          return (
            <Row
              key={app.id}
              leading={<IconTile tone={open ? 'accent' : 'gray'}>{app.name[0]}</IconTile>}
              title={app.name}
              subtitle={open ? `Open · ${minsLeft} min left` : `Locked${app.blockedToday > 0 ? ` · resisted ${app.blockedToday}× today` : ''}`}
              onClick={() => setIntercept(app)}
              trailing={
                open ? (
                  <Button size="sm" variant="gray" onClick={() => dispatch({ type: 'shield/lock', appId: app.id })}>
                    Lock
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="tinted"
                    disabled={!!lock || state.balance < app.cost}
                    onClick={() => dispatch({ type: 'shield/unlock', appId: app.id })}
                    aria-label={`Unlock ${app.name} for 15 minutes, costs ${app.cost} minutes`}
                  >
                    {app.cost}m
                  </Button>
                )
              }
            />
          );
        })}
      </Group>

      <Group header="Activity">
        {state.transactions.length === 0 && <EmptyState title="No activity yet" detail="Minutes you earn and spend show up here." />}
        {state.transactions.slice(0, 10).map((t) => (
          <Row
            key={t.id}
            title={t.label}
            subtitle={timeLabel(t.at)}
            trailing={<span className={`tabular text-[15px] font-semibold ${t.delta > 0 ? 'text-accent' : 'text-secondary'}`}>{t.delta > 0 ? `+${t.delta}` : `−${Math.abs(t.delta)}`}</span>}
          />
        ))}
      </Group>

      <InterceptSheet app={intercept} lockReason={lock} onClose={() => setIntercept(null)} />
    </>
  );
}
