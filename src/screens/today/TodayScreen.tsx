import { useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { BarChart3, Brain, ListPlus, Plus, Settings, Timer, Wallet, X } from 'lucide-react';
import type { PrayerId, TabId } from '../../types';
import { useStore } from '../../state/store';
import useNow from '../../lib/useNow';
import { PRAYER_NAMES, PRAYER_ORDER, currentPrayer, format12, gregorianLabel, hijriLabel, nextPrayer, timeLabel } from '../../lib/time';
import Screen, { CircleAction } from '../../ui/Screen';
import SubTabs from '../../ui/SubTabs';
import useSection from '../../ui/useSection';
import Group from '../../ui/Group';
import Row from '../../ui/Row';
import Check from '../../ui/Check';
import Button from '../../ui/Button';
import EmptyState from '../../ui/EmptyState';
import IconButton from '../../ui/IconButton';
import SkyCard from './SkyCard';
import DayRings from './DayRings';
import AddTaskSheet from './AddTaskSheet';
import TaskSheet from './TaskSheet';

const SECTIONS = ['now', 'routine', 'inbox'] as const;
type Section = (typeof SECTIONS)[number];

interface Props {
  onNavigate: (tab: TabId) => void;
  onOpenInsights: () => void;
  onOpenSettings: () => void;
}

export default function TodayScreen({ onNavigate, onOpenInsights, onOpenSettings }: Props) {
  const { state, runtime } = useStore();
  const now = useNow();
  const { section, direction, setSection } = useSection<Section>(SECTIONS);
  const [adding, setAdding] = useState<PrayerId | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const current = currentPrayer(state.prayerTimes, now);
  const hijri = hijriLabel(now);

  return (
    <Screen
      eyebrow={`${runtime.account?.name ? `Hello, ${runtime.account.name} · ` : ''}${gregorianLabel(now)}${hijri ? ` · ${hijri}` : ''}`}
      title="Today"
      action={
        <>
          <CircleAction label="Progress" onClick={onOpenInsights}>
            <BarChart3 className="h-[18px] w-[18px]" strokeWidth={2.4} />
          </CircleAction>
          <CircleAction label="Settings" onClick={onOpenSettings}>
            <Settings className="h-[18px] w-[18px]" strokeWidth={2.4} />
          </CircleAction>
        </>
      }
      tabs={
        <SubTabs
          value={section}
          onChange={setSection}
          options={[
            { value: 'now', label: 'Now' },
            { value: 'routine', label: 'Routine' },
            { value: 'inbox', label: `Inbox${state.brainDump.length ? ` · ${state.brainDump.length}` : ''}` },
          ]}
        />
      }
      sectionKey={section}
      direction={direction}
    >
      {section === 'now' && (
        <NowSection
          now={now}
          current={current}
          onOpenTask={setOpenTaskId}
          onNavigate={onNavigate}
          onInbox={() => setSection('inbox')}
          onRoutine={() => setSection('routine')}
          onInsights={onOpenInsights}
        />
      )}
      {section === 'routine' && <RoutineSection current={current} onOpenTask={setOpenTaskId} onAdd={setAdding} />}
      {section === 'inbox' && <InboxSection anchor={current ?? 'fajr'} />}

      <AddTaskSheet open={adding !== null} onClose={() => setAdding(null)} defaultAnchor={adding ?? current ?? 'fajr'} />
      <TaskSheet taskId={openTaskId} onClose={() => setOpenTaskId(null)} />
    </Screen>
  );
}

function NowSection({
  now,
  current,
  onOpenTask,
  onNavigate,
  onInbox,
  onRoutine,
  onInsights,
}: {
  now: Date;
  current: PrayerId | null;
  onOpenTask: (id: string) => void;
  onNavigate: (tab: TabId) => void;
  onInbox: () => void;
  onRoutine: () => void;
  onInsights: () => void;
}) {
  const { state, dispatch } = useStore();
  // Show tasks for the current prayer block; if those are done, look ahead to the next block.
  const order = current ? PRAYER_ORDER.slice(PRAYER_ORDER.indexOf(current)) : [nextPrayer(state.prayerTimes, now).id];
  const anchor = order.find((p) => state.routines.some((r) => r.anchor === p && !r.done)) ?? current ?? order[0];
  const upNext = state.routines.filter((r) => r.anchor === anchor);

  return (
    <>
      <SkyCard now={now} current={current} />
      <div className="mt-3">
        <DayRings onOpen={onInsights} />
      </div>

      <div className="mb-7 mt-3 grid grid-cols-3 gap-3">
        <Quick icon={<Timer className="h-5 w-5" />} label="Pomodoro" onClick={() => onNavigate('focus')} />
        <Quick icon={<Brain className="h-5 w-5" />} label="Park thought" onClick={onInbox} />
        <Quick icon={<Wallet className="h-5 w-5" />} label="Log spend" onClick={() => onNavigate('wallet')} />
      </div>

      <Group
        header={`Up next · after ${PRAYER_NAMES[anchor].en}`}
        headerAction={
          <button onClick={onRoutine} className="text-[15px] text-accent">
            Full day
          </button>
        }
      >
        {upNext.length === 0 && <EmptyState title="Nothing anchored here" detail="Add a small habit for this part of the day." />}
        {upNext.map((t) => (
          <Row
            key={t.id}
            leading={<Check checked={t.done} label={`Complete ${t.title}`} onChange={() => dispatch({ type: 'routine/toggle', taskId: t.id })} />}
            title={t.title}
            muted={t.done}
            subtitle={t.done ? 'Done' : t.starter ? `Start: ${t.starter}` : `${t.steps.length} steps`}
            onClick={() => onOpenTask(t.id)}
            chevron
          />
        ))}
      </Group>
    </>
  );
}

function Quick({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <motion.button whileTap={{ scale: 0.94 }} onClick={onClick} className="flex flex-col items-start gap-2 rounded-[16px] bg-card p-3 text-left">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-accent">{icon}</span>
      <span className="text-[14px] font-semibold">{label}</span>
    </motion.button>
  );
}

/** The whole day as a vertical timeline, with the prayers as landmarks. */
function RoutineSection({ current, onOpenTask, onAdd }: { current: PrayerId | null; onOpenTask: (id: string) => void; onAdd: (p: PrayerId) => void }) {
  const { state, dispatch } = useStore();
  return (
    <div className="relative pb-4">
      <div className="absolute bottom-6 left-[15px] top-4 w-[2px] rounded-full bg-fill-strong" />
      {PRAYER_ORDER.map((p) => {
        const tasks = state.routines.filter((r) => r.anchor === p);
        const prayed = state.prayers[p].status !== 'none';
        const isNow = p === current;
        const doneCount = tasks.filter((t) => t.done).length;
        return (
          <section key={p} className="relative mb-6 pl-11">
            <motion.span
              initial={false}
              animate={{ scale: isNow ? [1, 1.15, 1] : 1 }}
              transition={{ duration: 2, repeat: isNow ? Infinity : 0 }}
              className={`absolute left-[5px] top-[3px] flex h-[22px] w-[22px] items-center justify-center rounded-full ring-4 ring-canvas ${
                prayed ? 'bg-accent' : isNow ? 'bg-white shadow-[inset_0_0_0_2.5px_var(--color-accent)]' : 'bg-white shadow-[inset_0_0_0_2px_var(--color-tertiary)]'
              }`}
            >
              {prayed && <span className="h-2 w-2 rounded-full bg-white" />}
            </motion.span>
            <div className="mb-2 flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <h3 className={`text-[20px] font-bold tracking-[-0.02em] ${isNow ? 'text-accent' : ''}`}>{PRAYER_NAMES[p].en}</h3>
                <span className="font-arabic text-[16px] text-secondary">{PRAYER_NAMES[p].ar}</span>
              </div>
              <span className="tabular text-[14px] text-secondary">
                {format12(state.prayerTimes[p])}
                {tasks.length > 0 && ` · ${doneCount}/${tasks.length}`}
              </span>
            </div>
            <div className="ios-group overflow-hidden rounded-[12px] bg-card">
              {tasks.map((t) => (
                <Row
                  key={t.id}
                  leading={<Check checked={t.done} label={`Complete ${t.title}`} onChange={() => dispatch({ type: 'routine/toggle', taskId: t.id })} />}
                  title={t.title}
                  muted={t.done}
                  subtitle={`${t.steps.filter((s) => s.done).length}/${t.steps.length} steps · ${t.minutes} min`}
                  onClick={() => onOpenTask(t.id)}
                  chevron
                />
              ))}
              <button onClick={() => onAdd(p)} className="ios-row flex w-full items-center gap-3 py-2.5 pl-4 text-[15px] text-accent active:bg-fill">
                <Plus className="h-[18px] w-[18px]" strokeWidth={2.5} /> Add after {PRAYER_NAMES[p].en}
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function InboxSection({ anchor }: { anchor: PrayerId }) {
  const { state, dispatch } = useStore();
  const [thought, setThought] = useState('');
  const park = () => {
    const text = thought.trim();
    if (!text) return;
    dispatch({ type: 'brain/add', text });
    setThought('');
  };

  return (
    <>
      <div className="mb-7 rounded-[20px] bg-card p-4">
        <p className="text-[15px] font-semibold">Get it out of your head</p>
        <p className="mt-0.5 text-[13px] text-secondary">Park any thought so it stops looping. Sort it later.</p>
        <textarea
          value={thought}
          onChange={(e) => setThought(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              park();
            }
          }}
          rows={3}
          placeholder="Email the TA about the lab… buy batteries…"
          aria-label="New thought"
          className="mt-3 w-full resize-none rounded-[12px] bg-fill px-3 py-2.5 text-[16px] outline-none placeholder:text-tertiary"
        />
        <Button block className="mt-3" onClick={park} disabled={!thought.trim()}>
          Park it
        </Button>
      </div>

      <Group header={`Parked · ${state.brainDump.length}`} footer={`The list icon turns a thought into a task after ${PRAYER_NAMES[anchor].en}.`}>
        {state.brainDump.length === 0 && <EmptyState title="Mind clear" detail="Nothing parked right now." />}
        {state.brainDump.map((b) => (
          <Row
            key={b.id}
            title={b.text}
            subtitle={timeLabel(b.at)}
            trailing={
              <>
                <IconButton label={`Make task after ${PRAYER_NAMES[anchor].en}`} onClick={() => dispatch({ type: 'brain/toTask', id: b.id, anchor })}>
                  <ListPlus className="h-[18px] w-[18px]" />
                </IconButton>
                <IconButton label="Delete thought" onClick={() => dispatch({ type: 'brain/remove', id: b.id })}>
                  <X className="h-[18px] w-[18px]" />
                </IconButton>
              </>
            }
          />
        ))}
      </Group>
    </>
  );
}
