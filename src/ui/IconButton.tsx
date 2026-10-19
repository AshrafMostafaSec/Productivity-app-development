import type { ReactNode } from 'react';

export default function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full text-tertiary transition-colors hover:bg-fill hover:text-secondary active:bg-fill-strong"
    >
      {children}
    </button>
  );
}
