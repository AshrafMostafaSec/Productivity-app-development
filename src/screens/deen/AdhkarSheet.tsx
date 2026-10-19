import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import type { AdhkarSessionId, PrayerId } from '../../types';
import { useStore } from '../../state/store';
import { collectionFor } from '../../data/adhkar';
import { PRAYER_NAMES } from '../../lib/time';
import Sheet from '../../ui/Sheet';
import Button from '../../ui/Button';
import { ProgressRing } from '../../ui/Progress';
import useSticky from '../../ui/useSticky';
import { AnimatePresence, motion } from 'motion/react';
import { haptic } from '../../lib/notify';

/** One dhikr at a time with a big tap target — fewer things on screen, easier to stay with it. */
export default function AdhkarSheet({ session: requested, onClose }: { session: AdhkarSessionId | null; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const session = useSticky(requested);
  const [index, setIndex] = useState(0);
  const advanceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const collection = session ? collectionFor(session) : null;
  const progress = (session && state.adhkar[session]) || {};

  // Open on the first unfinished dhikr.
  useEffect(() => {
    if (!session || !collection) return;
    const first = collection.items.findIndex((i) => (progress[i.id] ?? 0) < i.count);
    setIndex(first === -1 ? 0 : first);
    return () => clearTimeout(advanceTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  if (!session || !collection) return null;

  const items = collection.items;
  const item = items[index];
  const count = progress[item.id] ?? 0;
  const itemDone = count >= item.count;
  const doneItems = items.filter((i) => (progress[i.id] ?? 0) >= i.count).length;
  const allDone = doneItems === items.length;
  const title = session.startsWith('after:')
    ? `After ${PRAYER_NAMES[session.slice(6) as PrayerId].en}`
    : collection.title;

  const tap = () => {
    if (itemDone) return;
    haptic(8);
    dispatch({ type: 'adhkar/tap', session, itemId: item.id });
    if (count + 1 >= item.count && index < items.length - 1) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(() => setIndex((i) => Math.min(i + 1, items.length - 1)), 350);
    }
  };

  return (
    <Sheet open={!!requested} onClose={onClose} title={title} hideCancel tall>
      <div className="flex h-full flex-col">
        <div className="mb-4 flex items-center gap-3 px-1">
          <div className="flex flex-1 gap-[3px]">
            {items.map((i, idx) => (
              <button
                key={`${i.id}-${idx}`}
                aria-label={`Go to ${i.title}`}
                onClick={() => setIndex(idx)}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  (progress[i.id] ?? 0) >= i.count ? 'bg-accent' : idx === index ? 'bg-label/40' : 'bg-fill-strong'
                }`}
              />
            ))}
          </div>
          <span className="tabular text-[13px] text-secondary">
            {doneItems}/{items.length}
          </span>
        </div>

        {allDone && (
          <div className="mb-4 rounded-[12px] bg-accent/10 px-4 py-3 text-center text-[15px] font-medium text-accent">
            All done — may Allah accept from you.
          </div>
        )}

        <button
          onClick={tap}
          aria-label={`Count ${item.title}`}
          className="flex flex-1 flex-col rounded-[20px] bg-card p-5 text-center transition-transform active:scale-[0.99]"
        >
          <p className="text-[13px] font-semibold uppercase tracking-[0.02em] text-secondary">{item.title}</p>
          <div className="flex flex-1 items-center justify-center py-4">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={item.id + index}
                dir="rtl"
                lang="ar"
                className="font-arabic text-[24px] leading-[2.1]"
                initial={{ opacity: 0, y: 14, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -14, filter: 'blur(4px)' }}
                transition={{ duration: 0.28 }}
              >
                {item.arabic}
              </motion.p>
            </AnimatePresence>
          </div>
          {item.note && <p className="mb-3 text-[13px] text-secondary">{item.note}</p>}
          <div className="flex items-center justify-center gap-3">
            <ProgressRing value={count / item.count} size={52} stroke={4.5}>
              <motion.span key={count} initial={{ scale: 1.5, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} className="tabular text-[15px] font-semibold">
                {count}
              </motion.span>
            </ProgressRing>
            <span className="text-[15px] text-secondary">{itemDone ? 'Done' : `of ${item.count} · tap anywhere`}</span>
          </div>
        </button>

        <div className="mt-4 flex items-center justify-between">
          <Button variant="gray" aria-label="Previous" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button variant="plain" icon={<RotateCcw className="h-4 w-4" />} onClick={() => dispatch({ type: 'adhkar/reset', session })}>
            Start over
          </Button>
          <Button
            variant="gray"
            aria-label="Next"
            onClick={() => setIndex((i) => Math.min(items.length - 1, i + 1))}
            disabled={index === items.length - 1}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
