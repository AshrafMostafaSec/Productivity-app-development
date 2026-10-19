import { useId } from 'react';
import { motion } from 'motion/react';
import { spring } from './motion';

interface SubTabsProps<T extends string> {
  value: T;
  options: { value: T; label: string; badge?: boolean }[];
  onChange: (value: T) => void;
}

/** Top-of-screen section switcher that keeps each tab short. Sticks under the large title while scrolling. */
export default function SubTabs<T extends string>({ value, options, onChange }: SubTabsProps<T>) {
  const id = useId();
  return (
    <div role="tablist" className="flex gap-1 rounded-full bg-fill p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`relative h-8 flex-1 rounded-full text-[14px] transition-colors ${active ? 'font-semibold text-white' : 'font-medium text-label/70 hover:text-label'}`}
          >
            {active && <motion.span layoutId={`sub-${id}`} transition={spring} className="absolute inset-0 rounded-full bg-accent shadow-[0_2px_8px_rgba(0,122,255,0.35)]" />}
            <span className="relative">{o.label}</span>
            {o.badge && !active && <span className="absolute right-2.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />}
          </button>
        );
      })}
    </div>
  );
}
