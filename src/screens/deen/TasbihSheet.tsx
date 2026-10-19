import { useStore } from '../../state/store';
import { TASBIH_PHRASES } from '../../data/adhkar';
import Sheet from '../../ui/Sheet';
import Segmented from '../../ui/Segmented';
import Button from '../../ui/Button';
import { ProgressRing } from '../../ui/Progress';
import { motion } from 'motion/react';
import { haptic } from '../../lib/notify';

export default function TasbihSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const { tasbih } = state;
  const phrase = TASBIH_PHRASES.find((p) => p.id === tasbih.phraseId) ?? TASBIH_PHRASES[0];
  const inRound = tasbih.count % tasbih.target;
  const rounds = Math.floor(tasbih.count / tasbih.target);

  return (
    <Sheet open={open} onClose={onClose} title="Tasbih" hideCancel tall>
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        {TASBIH_PHRASES.map((p) => (
          <button
            key={p.id}
            onClick={() => dispatch({ type: 'tasbih/set', phraseId: p.id })}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[15px] font-medium transition-colors ${
              p.id === phrase.id ? 'bg-accent text-white' : 'bg-card text-label'
            }`}
          >
            {p.title}
          </button>
        ))}
      </div>
      <Segmented
        label="Target"
        value={tasbih.target}
        onChange={(target) => dispatch({ type: 'tasbih/set', target })}
        options={[33, 99, 100].map((n) => ({ value: n, label: String(n) }))}
      />

      <div className="flex flex-col items-center py-8">
        <p dir="rtl" lang="ar" className="mb-6 font-arabic text-[34px] leading-snug">
          {phrase.arabic}
        </p>
        <motion.button
          onClick={() => {
            haptic((inRound + 1) % tasbih.target === 0 ? [30, 50, 30] : 8);
            dispatch({ type: 'tasbih/tap' });
          }}
          whileTap={{ scale: 0.94 }}
          aria-label={`Count ${phrase.title}`}
          className="rounded-full bg-card p-3 shadow-[0_10px_30px_rgba(0,0,0,0.06)]"
        >
          <ProgressRing value={inRound / tasbih.target} size={220} stroke={8}>
            <div className="text-center">
              <motion.p key={tasbih.count} initial={{ y: 10, opacity: 0.3 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.18 }} className="tabular text-[64px] font-semibold leading-none tracking-[-0.04em]">
                {inRound}
              </motion.p>
              <p className="mt-1 text-[15px] text-secondary">of {tasbih.target}</p>
            </div>
          </ProgressRing>
        </motion.button>
        <p className="mt-6 text-[15px] text-secondary">
          {rounds > 0 && `${rounds} ${rounds === 1 ? 'round' : 'rounds'} · `}
          {tasbih.totalToday} today
        </p>
      </div>
      <Button variant="gray" block onClick={() => dispatch({ type: 'tasbih/reset' })}>
        Reset counter
      </Button>
    </Sheet>
  );
}
