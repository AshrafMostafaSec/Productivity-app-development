import type { ReactNode } from 'react';

export default function IconTile({ children, tone = 'accent' }: { children: ReactNode; tone?: 'accent' | 'gray' }) {
  return (
    <span
      className={`flex h-[30px] w-[30px] items-center justify-center rounded-[8px] text-[15px] font-semibold ${
        tone === 'accent' ? 'bg-accent text-white' : 'bg-fill-strong text-secondary'
      }`}
    >
      {children}
    </span>
  );
}
