import type { ReactNode } from 'react';
import { AnimatePresence } from 'motion/react';

interface GroupProps {
  header?: ReactNode;
  headerAction?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Inset-grouped list section. Rows inside animate in and out. */
export default function Group({ header, headerAction, footer, children, className = '' }: GroupProps) {
  return (
    <section className={`mb-7 ${className}`}>
      {(header || headerAction) && (
        <div className="mb-1.5 flex items-end justify-between px-4">
          <h3 className="text-[13px] uppercase tracking-[0.02em] text-secondary">{header}</h3>
          {headerAction}
        </div>
      )}
      <div className="ios-group overflow-hidden rounded-[12px] bg-card">
        <AnimatePresence initial={false}>
          {children}
        </AnimatePresence>
      </div>
      {footer && <p className="mt-1.5 px-4 text-[13px] leading-snug text-secondary">{footer}</p>}
    </section>
  );
}
