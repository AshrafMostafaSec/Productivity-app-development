import { useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ease } from './motion';

interface ScreenProps {
  eyebrow?: ReactNode;
  title: string;
  action?: ReactNode;
  /** Section switcher rendered under the title; sticks to the top with a blurred bar. */
  tabs?: ReactNode;
  /** Changing this key animates the content in from the side. */
  sectionKey?: string;
  direction?: number;
  children: ReactNode;
}

/** A tab screen with an iOS large title that collapses into a compact bar on scroll. */
export default function Screen({ eyebrow, title, action, tabs, sectionKey = 'main', direction = 1, children }: ScreenProps) {
  const [scrolled, setScrolled] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  return (
    <div className="relative h-full">
      <motion.div
        className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-11 items-center justify-center border-b-[0.5px] border-separator bg-canvas/80 backdrop-blur-xl"
        initial={false}
        animate={{ opacity: scrolled ? 1 : 0 }}
        transition={{ duration: 0.18 }}
      >
        <span className="text-[17px] font-semibold">{title}</span>
      </motion.div>

      <div
        ref={scroller}
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 44)}
        className="no-scrollbar h-full overflow-y-auto overscroll-contain"
      >
        <div className="px-4 pb-36 pt-3">
          <header className="mb-4 flex items-end justify-between gap-3 px-1">
            <div className="min-w-0">
              {eyebrow && <div className="truncate text-[13px] font-semibold uppercase tracking-[0.02em] text-secondary">{eyebrow}</div>}
              <h1 className="text-[34px] font-bold leading-[41px] tracking-[-0.025em]">{title}</h1>
            </div>
            {action && <div className="mb-1.5 flex shrink-0 items-center gap-2">{action}</div>}
          </header>
          {tabs && <div className="sticky top-11 z-10 -mx-4 mb-3 bg-canvas/85 px-4 py-2 backdrop-blur-xl">{tabs}</div>}
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.div
              key={sectionKey}
              custom={direction}
              variants={{
                enter: (d: number) => ({ opacity: 0, x: 28 * d }),
                center: { opacity: 1, x: 0 },
                exit: (d: number) => ({ opacity: 0, x: -28 * d }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease }}
              onAnimationStart={() => scroller.current?.scrollTo({ top: 0 })}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export function CircleAction({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <motion.button
      aria-label={label}
      title={label}
      onClick={onClick}
      whileTap={{ scale: 0.86 }}
      className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-card text-accent shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
    >
      {children}
    </motion.button>
  );
}
