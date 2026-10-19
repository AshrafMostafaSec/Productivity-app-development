import type { ReactNode } from 'react';

export default function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[16px] bg-card p-4 ${className}`}>{children}</div>;
}
