import { AnimatePresence, motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { useStore } from '../state/store';
import { spring } from './motion';

const PARTICLES = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle), size: 4 + (i % 3) * 2, delay: (i % 4) * 0.02 };
});

export default function Toast() {
  const { state } = useStore();
  const t = state.toast;
  const celebrate = !!t?.delta && t.delta >= 10;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-50 flex justify-center px-4" role="status" aria-live="polite">
      <AnimatePresence mode="popLayout">
        {t && (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: -24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={spring}
            className="relative flex max-w-full items-center gap-2.5 rounded-full bg-white/95 py-2 pl-2 pr-4 shadow-[0_10px_34px_rgba(0,0,0,0.14)] ring-[0.5px] ring-black/5 backdrop-blur-xl"
          >
            {celebrate &&
              PARTICLES.map((p, i) => (
                <motion.span
                  key={i}
                  className="absolute left-6 top-1/2 rounded-full bg-accent"
                  style={{ width: p.size, height: p.size, opacity: i % 2 ? 0.5 : 1 }}
                  initial={{ x: 0, y: 0, scale: 0 }}
                  animate={{ x: p.x * 46, y: p.y * 34, scale: [0, 1.2, 0] }}
                  transition={{ duration: 0.9, delay: p.delay, ease: 'easeOut' }}
                />
              ))}
            {t.delta !== undefined && t.delta !== 0 ? (
              <motion.span
                initial={{ scale: 0.4, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ ...spring, delay: 0.05 }}
                className={`tabular flex h-7 items-center gap-1 rounded-full px-2.5 text-[14px] font-bold ${
                  t.delta > 0 ? 'bg-accent text-white' : 'bg-fill text-secondary'
                }`}
              >
                {t.delta > 0 && <Sparkles className="h-3.5 w-3.5" />}
                {t.delta > 0 ? `+${t.delta}` : `−${Math.abs(t.delta)}`}m
              </motion.span>
            ) : (
              <span className="ml-2" />
            )}
            <span className="truncate text-[15px] font-medium">{t.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
