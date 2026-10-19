import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, Moon, Target, Wallet } from 'lucide-react';
import { useStore } from '../state/store';
import { requestNotificationPermission } from '../lib/notify';
import Button from '../ui/Button';
import { ease } from '../ui/motion';

const PAGES = [
  {
    icon: Moon,
    title: 'Your day, anchored to prayer',
    body: 'Five fixed landmarks. Small routines hang off each one, so the day has a shape even when your brain doesn’t.',
  },
  {
    icon: Target,
    title: 'Earn your screen time',
    body: 'Prayers, Pomodoros and finished steps earn minutes. Distracting apps cost minutes, and they stay locked until you pray.',
  },
  {
    icon: Wallet,
    title: 'Pause before you buy',
    body: 'A daily safe-to-spend number, and a cooling-off timer for impulse buys. Most urges fade on their own.',
  },
  {
    icon: Bell,
    title: 'Gentle reminders',
    body: 'Prayer times, Pomodoro breaks, deadlines and your Fajr alarm. Allow notifications so they reach you.',
  },
];

export default function Onboarding() {
  const { dispatch } = useStore();
  const [page, setPage] = useState(0);
  const P = PAGES[page];
  const last = page === PAGES.length - 1;

  const finish = async (ask: boolean) => {
    if (ask) await requestNotificationPermission();
    dispatch({ type: 'system/onboarded' });
  };

  return (
    <motion.div className="absolute inset-0 z-[58] flex flex-col bg-canvas px-6 pb-14 pt-16" exit={{ opacity: 0 }}>
      <div className="flex justify-end">
        {!last && (
          <button onClick={() => finish(false)} className="text-[17px] text-accent">
            Skip
          </button>
        )}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <AnimatePresence mode="wait">
          <motion.div key={page} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.35, ease }} className="flex flex-col items-center">
            <motion.div
              initial={{ scale: 0.6, rotate: -12 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              className="flex h-24 w-24 items-center justify-center rounded-[28px] bg-accent text-white shadow-[0_16px_40px_rgba(0,122,255,0.35)]"
            >
              <P.icon className="h-11 w-11" strokeWidth={2} />
            </motion.div>
            <h1 className="mt-8 text-[30px] font-bold leading-tight tracking-[-0.025em]">{P.title}</h1>
            <p className="mt-3 max-w-[300px] text-[17px] leading-snug text-secondary">{P.body}</p>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mb-6 flex justify-center gap-2">
        {PAGES.map((_, i) => (
          <motion.span key={i} animate={{ width: i === page ? 22 : 8, opacity: i === page ? 1 : 0.3 }} className="h-2 rounded-full bg-accent" />
        ))}
      </div>
      {last ? (
        <div className="space-y-2.5">
          <Button block size="lg" onClick={() => finish(true)}>
            Allow notifications
          </Button>
          <Button block size="lg" variant="plain" onClick={() => finish(false)}>
            Not now
          </Button>
        </div>
      ) : (
        <Button block size="lg" onClick={() => setPage(page + 1)}>
          Continue
        </Button>
      )}
    </motion.div>
  );
}
