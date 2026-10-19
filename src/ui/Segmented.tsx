import { useId } from 'react';
import { motion } from 'motion/react';
import { spring } from './motion';

interface SegmentedProps<T extends string | number> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}

export default function Segmented<T extends string | number>({ value, options, onChange, label }: SegmentedProps<T>) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-[9px] bg-fill p-[2px]">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className="relative h-7 flex-1 rounded-[7px] px-1 text-[13px]"
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={spring}
                className="absolute inset-0 rounded-[7px] bg-white shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)]"
              />
            )}
            <span className={`relative block truncate ${active ? 'font-semibold' : 'font-medium'}`}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
