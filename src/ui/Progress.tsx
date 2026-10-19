import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { softSpring } from './motion';

interface RingProps {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
}

export function ProgressRing({ value, size = 28, stroke = 3.5, color = 'var(--color-accent)', track = 'var(--color-fill-strong)', children }: RingProps) {
  const r = (size - stroke) / 2;
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={false}
          animate={{ pathLength: clamped, opacity: clamped > 0 ? 1 : 0 }}
          transition={softSpring}
        />
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  );
}

export function ProgressBar({ value, tone = 'accent' }: { value: number; tone?: 'accent' | 'danger' }) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-fill">
      <motion.div
        className={`h-full rounded-full ${tone === 'danger' ? 'bg-danger' : 'bg-accent'}`}
        initial={false}
        animate={{ width: `${clamped * 100}%` }}
        transition={softSpring}
      />
    </div>
  );
}
