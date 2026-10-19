import { motion } from 'motion/react';
import { Moon, Sun, Target, Wallet, type LucideIcon } from 'lucide-react';
import type { TabId } from '../types';
import { haptic } from '../lib/notify';

export const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'today', label: 'Today', icon: Sun },
  { id: 'deen', label: 'Deen', icon: Moon },
  { id: 'focus', label: 'Focus', icon: Target },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
];

interface TabBarProps {
  active: TabId;
  onChange: (tab: TabId) => void;
  badges?: Partial<Record<TabId, boolean>>;
}

export default function TabBar({ active, onChange, badges = {} }: TabBarProps) {
  return (
    <nav
      aria-label="Tabs"
      className="absolute inset-x-0 bottom-0 z-30 border-t-[0.5px] border-separator bg-white/80 pb-[max(env(safe-area-inset-bottom),8px)] backdrop-blur-xl backdrop-saturate-[1.8] sm:pb-[26px]"
    >
      <div className="grid grid-cols-4 pt-1.5">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = id === active;
          return (
            <button
              key={id}
              onClick={() => {
                if (!isActive) haptic(8);
                onChange(id);
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-col items-center gap-[3px] py-0.5 transition-colors duration-200 ${isActive ? 'text-accent' : 'text-[#999999]'}`}
            >
              <motion.span
                className="relative"
                animate={isActive ? { scale: [1, 0.82, 1.08, 1], y: [0, 1, -2, 0] } : { scale: 1, y: 0 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
              >
                <Icon className="h-[25px] w-[25px]" strokeWidth={isActive ? 2.2 : 1.9} fill={isActive ? 'currentColor' : 'none'} fillOpacity={0.18} />
                {badges[id] && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-white"
                  />
                )}
              </motion.span>
              <span className="text-[10px] font-medium tracking-[0.01em]">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
