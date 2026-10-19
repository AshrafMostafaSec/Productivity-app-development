import { motion } from 'motion/react';
import { softSpring } from './motion';

interface BarChartProps {
  data: { label: string; value: number; highlight?: boolean }[];
  max?: number;
  goal?: number;
  height?: number;
  format?: (v: number) => string;
}

/** Minimal week chart: one bar per day, today in full accent, optional goal line. */
export default function BarChart({ data, max, goal, height = 120, format = (v) => String(Math.round(v)) }: BarChartProps) {
  const top = Math.max(max ?? 0, goal ?? 0, ...data.map((d) => d.value), 1);
  return (
    <div>
      <div className="relative flex items-end gap-2" style={{ height }}>
        {goal !== undefined && goal > 0 && (
          <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-accent/50" style={{ bottom: `${(goal / top) * 100}%` }}>
            <span className="absolute -top-4 right-0 text-[10px] font-semibold text-accent">Goal</span>
          </div>
        )}
        {data.map((d, i) => (
          <div key={i} className="group flex h-full flex-1 flex-col justify-end" title={`${d.label}: ${format(d.value)}`}>
            <motion.div
              className={`w-full rounded-[6px] ${d.highlight ? 'bg-accent' : 'bg-accent/25'}`}
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(d.value > 0 ? 4 : 2, (d.value / top) * 100)}%` }}
              transition={{ ...softSpring, delay: i * 0.035 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
        {data.map((d, i) => (
          <span key={i} className={`flex-1 text-center text-[11px] font-medium ${d.highlight ? 'text-accent' : 'text-secondary'}`}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
