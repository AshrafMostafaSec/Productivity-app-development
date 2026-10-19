import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../state/store';
import useNow from '../lib/useNow';
import { clockTime } from '../lib/time';
import { chime, haptic } from '../lib/notify';
import { REWARDS } from '../state/rewards';

function makeProblems() {
  return Array.from({ length: 3 }, () => {
    const a = 12 + Math.floor(Math.random() * 38);
    const b = 6 + Math.floor(Math.random() * 27);
    return { q: `${a} + ${b}`, a: a + b };
  });
}

/** Full-screen ringing alarm. The math mission makes sure you're awake before it stops. */
export default function AlarmOverlay() {
  const { state, dispatch } = useStore();
  const now = useNow(1000);
  const alarm = state.alarms.find((a) => a.id === state.ringingAlarm) ?? null;
  const problems = useMemo(makeProblems, [alarm?.id]);
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState('');
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    setStep(0);
    setAnswer('');
  }, [alarm?.id]);

  // Re-chime every few seconds until stopped.
  useEffect(() => {
    if (!alarm) return;
    const id = setInterval(() => {
      if (state.notifications.sound) chime('alarm');
      haptic([200, 100, 200]);
    }, 4000);
    return () => clearInterval(id);
  }, [alarm, state.notifications.sound]);

  const submit = () => {
    if (Number(answer) === problems[step].a) {
      haptic(20);
      if (step === problems.length - 1) dispatch({ type: 'alarm/dismiss', solved: true });
      else {
        setStep(step + 1);
        setAnswer('');
      }
    } else {
      haptic([60, 40, 60]);
      setWrong(true);
      setTimeout(() => setWrong(false), 400);
      setAnswer('');
    }
  };

  return (
    <AnimatePresence>
      {alarm && (
        <motion.div
          className="absolute inset-0 z-[55] flex flex-col items-center justify-between overflow-hidden px-6 pb-14 pt-14 text-white"
          style={{ background: 'linear-gradient(180deg,#0f1b3d 0%,#2b3f78 55%,#ff9e7a 130%)' }}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ duration: 0.4 }}
          role="alertdialog"
          aria-label={alarm.label}
        >
          <motion.div aria-hidden className="absolute left-1/2 top-[38%] h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-[#ffcf8f]/30 blur-[80px]" animate={{ scale: [0.9, 1.15, 0.9] }} transition={{ duration: 2, repeat: Infinity }} />
          <div className="relative text-center">
            <p className="text-[17px] font-medium text-white/70">{alarm.label}</p>
            <motion.p animate={{ scale: [1, 1.03, 1] }} transition={{ duration: 1, repeat: Infinity }} className="tabular mt-1 text-[92px] font-extralight leading-none tracking-[-0.04em]">
              {clockTime(now)}
            </motion.p>
          </div>

          {alarm.mission === 'math' ? (
            <div className="relative w-full max-w-[300px] text-center">
              <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-white/60">
                Wake-up mission · {step + 1} of {problems.length}
              </p>
              <motion.p key={step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, x: wrong ? [0, -10, 10, -6, 6, 0] : 0 }} className="tabular mt-3 text-[48px] font-semibold">
                {problems[step].q} = ?
              </motion.p>
              <input
                autoFocus
                inputMode="numeric"
                value={answer}
                onChange={(e) => setAnswer(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                aria-label="Answer"
                className="tabular mt-4 w-full rounded-[16px] bg-white/15 py-3 text-center text-[32px] font-semibold outline-none placeholder:text-white/30"
                placeholder="—"
              />
              <button onClick={submit} disabled={!answer} className="mt-3 h-[52px] w-full rounded-[16px] bg-white text-[17px] font-semibold text-[#0f1b3d] disabled:opacity-50">
                Check
              </button>
            </div>
          ) : (
            <div />
          )}

          <div className="relative w-full max-w-[300px] space-y-2.5">
            {alarm.mission === 'tap' && (
              <button onClick={() => dispatch({ type: 'alarm/dismiss', solved: true })} className="h-[56px] w-full rounded-full bg-white text-[18px] font-semibold text-[#0f1b3d]">
                I’m up · +{REWARDS.alarm} min
              </button>
            )}
            <p className="text-center text-[13px] text-white/60">
              {alarm.mission === 'math' ? `Solve all three to stop it and earn +${REWARDS.alarm} min.` : 'Stand up before you tap.'}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
