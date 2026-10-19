import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls } from 'motion/react';
import { useOverlayHost } from './overlay';
import { sheetSpring } from './motion';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Trailing header action, e.g. "Add" or "Save". */
  action?: { label: string; onClick: () => void; disabled?: boolean };
  /** Hide the leading Cancel button (read-only sheets only need Done). */
  hideCancel?: boolean;
  tall?: boolean;
}

export default function Sheet({ open, onClose, title, children, action, hideCancel, tall }: SheetProps) {
  const host = useOverlayHost();
  const drag = useDragControls();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!host) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div key="sheet" className="absolute inset-0 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={title}>
          <motion.button
            aria-label="Close"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          />
          <motion.div
            className={`relative flex flex-col rounded-t-[16px] bg-canvas shadow-[0_-10px_40px_rgba(0,0,0,0.14)] ${tall ? 'h-[94%]' : 'max-h-[94%]'}`}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={sheetSpring}
            drag="y"
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.9 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
          >
            <div className="touch-none cursor-grab active:cursor-grabbing" onPointerDown={(e) => drag.start(e)}>
              <div className="mx-auto mt-1.5 h-[5px] w-9 rounded-full bg-fill-strong" />
              <header className="grid grid-cols-[1fr_auto_1fr] items-center px-4 pb-2 pt-2.5">
                <div>
                  {!hideCancel && (
                    <button onClick={onClose} className="text-[17px] text-accent">
                      Cancel
                    </button>
                  )}
                </div>
                <h2 className="max-w-[200px] truncate text-[17px] font-semibold">{title}</h2>
                <div className="text-right">
                  {action ? (
                    <button
                      onClick={action.onClick}
                      disabled={action.disabled}
                      className="text-[17px] font-semibold text-accent transition-colors disabled:text-tertiary"
                    >
                      {action.label}
                    </button>
                  ) : (
                    hideCancel && (
                      <button onClick={onClose} className="text-[17px] font-semibold text-accent">
                        Done
                      </button>
                    )
                  )}
                </div>
              </header>
            </div>
            <div className="no-scrollbar flex-1 overflow-y-auto overscroll-contain px-4 pb-10 pt-2">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    host,
  );
}
