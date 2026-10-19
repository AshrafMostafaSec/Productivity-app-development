import { useEffect, useRef } from 'react';
import { animate } from 'motion/react';

/** Counts smoothly between values instead of jumping. */
export default function AnimatedNumber({ value, format = (n) => String(Math.round(n)) }: { value: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const controls = animate(prev.current, value, {
      duration: 0.6,
      ease: [0.32, 0.72, 0, 1],
      onUpdate: (v) => (node.textContent = format(v)),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, format]);
  return (
    <span ref={ref} className="tabular">
      {format(value)}
    </span>
  );
}
