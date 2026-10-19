import type { ReactNode } from 'react';
import { BatteryFull, Signal, Wifi } from 'lucide-react';
import useNow from '../lib/useNow';
import { clockTime } from '../lib/time';

/**
 * Full-screen on phones; an iPhone-sized device frame on larger screens.
 * The simulated status bar and home indicator only render inside the desktop frame,
 * since a real phone supplies its own.
 */
export default function PhoneFrame({ children }: { children: ReactNode }) {
  const now = useNow(15_000);
  return (
    <div className="flex h-dvh w-full items-center justify-center sm:min-h-screen sm:bg-[radial-gradient(ellipse_at_top,#f5f5f7,#dcdce1)] sm:p-6">
      <div className="flex flex-col items-center gap-5">
        <div className="relative h-dvh w-screen overflow-hidden bg-canvas sm:h-[852px] sm:max-h-[calc(100vh-88px)] sm:w-[393px] sm:rounded-[56px] sm:shadow-[0_0_0_11px_#1c1c1e,0_0_0_12px_#3a3a3c,0_40px_80px_-20px_rgba(0,0,0,0.35)]">
          <div className="flex h-full flex-col pt-[env(safe-area-inset-top)] sm:pt-0">
            <div className="relative hidden h-[54px] shrink-0 items-center justify-between px-8 pt-1.5 sm:flex">
              <span className="tabular w-[54px] text-center text-[17px] font-semibold">{clockTime(now)}</span>
              <span aria-hidden className="absolute left-1/2 top-[11px] h-[35px] w-[124px] -translate-x-1/2 rounded-full bg-black" />
              <span className="flex items-center gap-1.5">
                <Signal className="h-[15px] w-[15px]" strokeWidth={3} />
                <Wifi className="h-[15px] w-[15px]" strokeWidth={3} />
                <BatteryFull className="h-[22px] w-[22px]" strokeWidth={1.8} />
              </span>
            </div>
            <div className="relative min-h-0 flex-1">{children}</div>
          </div>
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-2 left-1/2 z-[60] hidden h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-black sm:block"
          />
        </div>
        <p className="hidden text-[13px] text-secondary sm:block">AnchorOS · Personal routines, study, and balance</p>
      </div>
    </div>
  );
}
