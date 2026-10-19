import { motion } from 'motion/react';
import { haptic } from '../lib/notify';
import { spring } from './motion';

interface CheckProps {
  checked: boolean;
  onChange: () => void;
  label: string;
  size?: 'md' | 'lg';
}

export default function Check({ checked, onChange, label, size = 'md' }: CheckProps) {
  const px = size === 'lg' ? 28 : 23;
  return (
    <motion.button
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        if (!checked) haptic(10);
        onChange();
      }}
      whileTap={{ scale: 0.82 }}
      transition={spring}
      className="relative flex shrink-0 items-center justify-center rounded-full"
      style={{ width: px, height: px }}
    >
      <motion.span
        className="absolute inset-0 rounded-full"
        initial={false}
        animate={{
          backgroundColor: checked ? 'var(--color-accent)' : 'rgba(0,0,0,0)',
          boxShadow: checked ? 'inset 0 0 0 0px var(--color-tertiary)' : 'inset 0 0 0 1.5px var(--color-tertiary)',
          scale: checked ? [1, 1.18, 1] : 1,
        }}
        transition={{ duration: 0.32 }}
      />
      <svg viewBox="0 0 24 24" className="relative" width={px * 0.62} height={px * 0.62} fill="none">
        <motion.path
          d="M5 12.5l4.5 4.5L19 7.5"
          stroke="white"
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ duration: 0.28, delay: checked ? 0.06 : 0 }}
        />
      </svg>
    </motion.button>
  );
}
