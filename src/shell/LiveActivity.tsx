import { AnimatePresence, motion } from 'motion/react';
import { Pause, Play } from 'lucide-react';
import { useStore } from '../state/store';
import useNow from '../lib/useNow';
import { ProgressRing } from '../ui/Progress';
import { spring } from '../ui/motion';

export const PHASE_LABEL = { focus: 'Focus', short: 'Short break', long: 'Long break' } as const;

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Floating pill above the tab bar while a Pomodoro is active and you're on another tab. */
export default function LiveActivity({ hidden, onOpen }: { hidden: boolean; onOpen: () => void }) {
  const { state, dispatch } = useStore();
  const now = useNow(1000);
  const p = state.pomodoro;
  const active = p.status === 'running' || p.status === 'paused';
  const remaining = p.status === 'running' && p.endsAt ? p.endsAt - now.getTime() : p.remainingMs;

  return (
    <AnimatePresence>
      {active && !hidden && (
        <motion.div
          initial={{ y: 40, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0, scale: 0.9 }}
          transition={spring}
          className="absolute inset-x-0 bottom-[92px] z-30 flex justify-center px-4 sm:bottom-[104px]"
        >
          <div className="flex items-center gap-3 rounded-full bg-[#1c1c1e] py-1.5 pl-1.5 pr-2 text-white shadow-[0_12px_30px_rgba(0,0,0,0.3)]">
            <button onClick={onOpen} className="flex items-center gap-3" aria-label="Open Pomodoro">
              <ProgressRing value={1 - remaining / p.phaseMs} size={34} stroke={3.5} color="#0a84ff" track="rgba(255,255,255,0.18)">
                <span className={`h-1.5 w-1.5 rounded-full bg-[#0a84ff] ${p.status === 'running' ? 'animate-pulse' : ''}`} />
              </ProgressRing>
              <span className="text-left">
                <span className="tabular block text-[17px] font-semibold leading-tight">{formatClock(remaining)}</span>
                <span className="block max-w-[150px] truncate text-[11px] text-white/60">
                  {PHASE_LABEL[p.phase]}
                  {p.subject ? ` · ${p.subject}` : ''}
                </span>
              </span>
            </button>
            <button
              onClick={() => dispatch({ type: p.status === 'running' ? 'pomo/pause' : 'pomo/resume' })}
              aria-label={p.status === 'running' ? 'Pause' : 'Resume'}
              className="ml-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 active:bg-white/25"
            >
              {p.status === 'running' ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4" fill="currentColor" />}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
