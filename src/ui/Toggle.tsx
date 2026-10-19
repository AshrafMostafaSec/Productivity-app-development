import { motion } from 'motion/react';
import { spring } from './motion';

interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  label: string;
}

export default function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative flex h-[31px] w-[51px] shrink-0 items-center rounded-full p-[2px] transition-colors duration-200 ${
        checked ? 'justify-end bg-accent' : 'justify-start bg-fill-strong'
      }`}
    >
      <motion.span
        layout
        transition={spring}
        className="h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)]"
      />
    </button>
  );
}
