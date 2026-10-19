import { forwardRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { ChevronRight } from 'lucide-react';

interface RowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  muted?: boolean;
  destructive?: boolean;
  accent?: boolean;
}

/** A grouped-list row. Animates in, out and between positions when its list changes. */
const Row = forwardRef<HTMLDivElement, RowProps>(function Row(
  { title, subtitle, leading, trailing, onClick, chevron, muted, destructive, accent },
  ref,
) {
  const titleColor = destructive ? 'text-danger' : accent ? 'text-accent' : muted ? 'text-secondary' : 'text-label';
  const body = (
    <>
      <span className={`relative block text-[17px] leading-[22px] transition-colors ${titleColor}`}>
        {title}
        <motion.span
          aria-hidden
          className="absolute left-0 top-1/2 h-[1.5px] origin-left bg-tertiary"
          initial={false}
          animate={{ scaleX: muted ? 1 : 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{ width: '100%' }}
        />
      </span>
      {subtitle && <span className="mt-0.5 block text-[13px] leading-[18px] text-secondary">{subtitle}</span>}
    </>
  );
  const mainClass = 'row-main flex min-h-[44px] min-w-0 flex-1 flex-col justify-center py-[11px] text-left';

  return (
    <motion.div
      ref={ref}
      layout="position"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
      className="ios-row flex items-stretch overflow-hidden pl-4 transition-colors has-[.row-main:active]:bg-fill"
    >
      {leading && <div className="mr-3 flex shrink-0 items-center">{leading}</div>}
      <div className="ios-row-content flex min-w-0 flex-1 items-center gap-3 pr-4">
        {onClick ? (
          <button onClick={onClick} className={mainClass}>
            {body}
          </button>
        ) : (
          <div className={mainClass}>{body}</div>
        )}
        {trailing && <div className="flex shrink-0 items-center gap-2">{trailing}</div>}
        {chevron && <ChevronRight aria-hidden className="-mr-1 h-[18px] w-[18px] shrink-0 text-tertiary" strokeWidth={2.5} />}
      </div>
    </motion.div>
  );
});

export default Row;
