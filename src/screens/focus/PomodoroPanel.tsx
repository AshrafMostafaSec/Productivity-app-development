import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Maximize2, Minimize2, Pause, Play, SkipForward, SlidersHorizontal, Square } from 'lucide-react';
import { useStore } from '../../state/store';
import { courses, focusMinutesOn, lastDays, pomodorosToday } from '../../state/selectors';
import useNow from '../../lib/useNow';
import { timeLabel } from '../../lib/time';
import { formatClock, PHASE_LABEL } from '../../shell/LiveActivity';
import { useOverlayHost } from '../../ui/overlay';
import Card from '../../ui/Card';
import Group from '../../ui/Group';
import Row from '../../ui/Row';
import BarChart from '../../ui/BarChart';
import AnimatedNumber from '../../ui/AnimatedNumber';
import EmptyState from '../../ui/EmptyState';
import { ProgressRing } from '../../ui/Progress';
import { spring } from '../../ui/motion';
import PomodoroSettingsSheet from './PomodoroSettingsSheet';

const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function usePomodoroClock() {
  const { state } = useStore();
  const now = useNow(250);
  const p = state.pomodoro;
  const s = state.pomodoroSettings;
  const idleMs = s.focus * 60_000;
  const total = p.status === 'idle' ? idleMs : p.phaseMs;
  const remaining = p.status === 'running' && p.endsAt ? Math.max(0, p.endsAt - now.getTime()) : p.status === 'idle' ? idleMs : p.remainingMs;
  return { p, s, total, remaining, progress: total ? 1 - remaining / total : 0 };
}

export default function PomodoroPanel() {
  const { state, dispatch } = useStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const { p, s, remaining, progress } = usePomodoroClock();
  const subjects = ['General', ...courses(state)];
  const todayMins = focusMinutesOn(state, state.dayKey);
  const week = lastDays(state, 7);
  const sessions = state.studyLog.filter((x) => x.dayKey === state.dayKey);
  const isBreak = p.phase !== 'focus';
  const editable = p.status === 'idle' || p.status === 'ready';

  return (
    <>
      <Card className={`mb-4 overflow-hidden transition-colors duration-500 ${isBreak ? 'bg-[#eef6ff]' : ''}`}>
        <div className="flex items-center justify-between">
          <motion.span
            key={p.phase}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${isBreak ? 'bg-white text-accent' : 'bg-accent/10 text-accent'}`}
          >
            {p.status === 'ready' ? `Up next · ${PHASE_LABEL[p.phase]}` : PHASE_LABEL[p.phase]}
          </motion.span>
          <div className="flex items-center gap-1">
            <IconCircle label="Timer settings" onClick={() => setSettingsOpen(true)}>
              <SlidersHorizontal className="h-4 w-4" />
            </IconCircle>
            <IconCircle label="Immersive focus mode" onClick={() => setImmersive(true)}>
              <Maximize2 className="h-4 w-4" />
            </IconCircle>
          </div>
        </div>

        <div className="flex flex-col items-center pb-2 pt-4">
          <ProgressRing value={progress} size={232} stroke={12}>
            <div className="text-center">
              <p className="tabular text-[58px] font-semibold leading-none tracking-[-0.04em]">{formatClock(remaining)}</p>
              <p className="mt-2 text-[14px] text-secondary">
                {p.status === 'paused' ? 'Paused' : isBreak ? 'Breathe. Move. Water.' : `Block ${(p.cycle % s.cyclesBeforeLong) + 1} of ${s.cyclesBeforeLong}`}
              </p>
            </div>
          </ProgressRing>
          <CycleDots done={p.cycle % s.cyclesBeforeLong} total={s.cyclesBeforeLong} />
        </div>

        <Controls />

        <div className="mt-5 border-t-[0.5px] border-separator pt-4">
          <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.02em] text-secondary">Studying</p>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {subjects.map((sub) => {
              const value = sub === 'General' ? '' : sub;
              const active = p.subject === value;
              return (
                <motion.button
                  key={sub}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => dispatch({ type: 'pomo/set', subject: value })}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-[14px] font-medium transition-colors ${active ? 'bg-label text-white' : 'bg-fill text-label'}`}
                >
                  {sub}
                </motion.button>
              );
            })}
          </div>
          <input
            value={p.task}
            onChange={(e) => dispatch({ type: 'pomo/set', task: e.target.value })}
            placeholder="What exactly will you do this block?"
            aria-label="Current task"
            readOnly={!editable && p.status !== 'paused'}
            className="mt-3 w-full rounded-[10px] bg-fill px-3 py-2.5 text-[16px] outline-none placeholder:text-tertiary"
          />
        </div>
      </Card>

      <div className="mb-7 grid grid-cols-2 gap-3">
        <Card className="!p-3.5">
          <p className="text-[12px] font-medium text-secondary">Today</p>
          <div className="mt-1 flex items-center justify-between">
            <p className="text-[26px] font-bold tracking-[-0.02em]">
              <AnimatedNumber value={todayMins} />
              <span className="text-[15px] font-semibold text-secondary">/{state.focusGoalMins}m</span>
            </p>
            <ProgressRing value={todayMins / state.focusGoalMins} size={34} stroke={4} />
          </div>
        </Card>
        <Card className="!p-3.5">
          <p className="text-[12px] font-medium text-secondary">Pomodoros</p>
          <p className="mt-1 text-[26px] font-bold tracking-[-0.02em]">
            <AnimatedNumber value={pomodorosToday(state)} />
            <span className="text-[15px] font-semibold text-secondary"> today</span>
          </p>
        </Card>
      </div>

      <section className="mb-7">
        <h3 className="mb-1.5 px-4 text-[13px] uppercase tracking-[0.02em] text-secondary">This week</h3>
        <Card>
          <BarChart
            data={week.map((d, i) => ({
              label: WEEKDAY[new Date(d.dayKey + 'T12:00').getDay()],
              value: d.focusMins,
              highlight: i === week.length - 1,
            }))}
            goal={state.focusGoalMins}
            format={(v) => `${Math.round(v)} min`}
          />
          <p className="mt-3 text-[13px] text-secondary">
            {week.reduce((a, d) => a + d.focusMins, 0)} min focused · {week.filter((d) => d.focusMins >= state.focusGoalMins).length} goal days
          </p>
        </Card>
      </section>

      <Group header="Sessions today">
        {sessions.length === 0 && <EmptyState title="No sessions yet" detail="Start one block. Just one. Momentum does the rest." />}
        {sessions.map((x) => (
          <Row
            key={x.id}
            title={x.task || x.subject || 'Focus session'}
            subtitle={`${x.subject || 'General'} · ${timeLabel(x.at)}`}
            trailing={<span className="tabular text-[15px] font-semibold text-accent">{x.minutes}m</span>}
          />
        ))}
      </Group>

      <PomodoroSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <Immersive open={immersive} onClose={() => setImmersive(false)} />
    </>
  );
}

function Controls({ dark }: { dark?: boolean }) {
  const { dispatch } = useStore();
  const { p } = usePomodoroClock();
  const running = p.status === 'running';
  const secondary = dark ? 'bg-white/12 text-white' : 'bg-fill text-label';

  const main = () => {
    if (running) dispatch({ type: 'pomo/pause' });
    else if (p.status === 'paused') dispatch({ type: 'pomo/resume' });
    else dispatch({ type: 'pomo/start' });
  };

  return (
    <div className="flex items-center justify-center gap-6">
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={() => dispatch({ type: 'pomo/stop' })}
        disabled={p.status === 'idle'}
        aria-label="Stop and save"
        className={`flex h-12 w-12 items-center justify-center rounded-full transition-opacity disabled:opacity-30 ${secondary}`}
      >
        <Square className="h-4 w-4" fill="currentColor" />
      </motion.button>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={main}
        aria-label={running ? 'Pause' : 'Start'}
        className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-accent text-white shadow-[0_10px_24px_rgba(0,122,255,0.35)]"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={running ? 'pause' : 'play'} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={spring}>
            {running ? <Pause className="h-7 w-7" fill="currentColor" /> : <Play className="ml-1 h-7 w-7" fill="currentColor" />}
          </motion.span>
        </AnimatePresence>
      </motion.button>
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={() => dispatch({ type: 'pomo/skip' })}
        aria-label="Skip to next phase"
        className={`flex h-12 w-12 items-center justify-center rounded-full ${secondary}`}
      >
        <SkipForward className="h-5 w-5" fill="currentColor" />
      </motion.button>
    </div>
  );
}

function CycleDots({ done, total, dark }: { done: number; total: number; dark?: boolean }) {
  return (
    <div className="mt-4 flex gap-2" aria-label={`${done} of ${total} blocks done`}>
      {Array.from({ length: total }, (_, i) => (
        <motion.span
          key={i}
          initial={false}
          animate={{ width: i < done ? 22 : 8, opacity: i < done ? 1 : 0.35 }}
          transition={spring}
          className={`h-2 rounded-full ${dark ? 'bg-[#0a84ff]' : 'bg-accent'}`}
        />
      ))}
    </div>
  );
}

function IconCircle({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <motion.button whileTap={{ scale: 0.88 }} aria-label={label} title={label} onClick={onClick} className="flex h-8 w-8 items-center justify-center rounded-full text-secondary hover:bg-fill">
      {children}
    </motion.button>
  );
}

/** Distraction-free, dark full-screen timer with a slow breathing glow. */
function Immersive({ open, onClose }: { open: boolean; onClose: () => void }) {
  const host = useOverlayHost();
  const { p, s, remaining, progress } = usePomodoroClock();
  if (!host) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-[46] flex flex-col items-center justify-between overflow-hidden bg-[#0b0d12] px-6 pb-16 pt-10 text-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          <motion.div
            aria-hidden
            className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0a84ff]/25 blur-[90px]"
            animate={{ scale: p.status === 'running' ? [0.85, 1.1, 0.85] : 0.8, opacity: p.status === 'running' ? [0.5, 0.9, 0.5] : 0.3 }}
            transition={{ duration: p.phase === 'focus' ? 8 : 5, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="relative flex w-full items-center justify-between">
            <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-white/50">{PHASE_LABEL[p.phase]}</span>
            <button onClick={onClose} aria-label="Exit focus mode" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10">
              <Minimize2 className="h-4 w-4" />
            </button>
          </div>
          <div className="relative flex flex-col items-center text-center">
            <ProgressRing value={progress} size={280} stroke={6} color="#0a84ff" track="rgba(255,255,255,0.08)">
              <p className="tabular text-[76px] font-extralight leading-none tracking-[-0.04em]">{formatClock(remaining)}</p>
            </ProgressRing>
            <p className="mt-6 max-w-[280px] text-[19px] font-medium leading-snug">{p.task || p.subject || 'One thing at a time'}</p>
            <CycleDots done={p.cycle % s.cyclesBeforeLong} total={s.cyclesBeforeLong} dark />
          </div>
          <div className="relative">
            <Controls dark />
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    host,
  );
}
