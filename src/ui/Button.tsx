import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'filled' | 'tinted' | 'gray' | 'plain';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  destructive?: boolean;
  icon?: ReactNode;
}

const variants: Record<Variant, string> = {
  filled: 'bg-accent text-white disabled:bg-fill-strong disabled:text-tertiary',
  tinted: 'bg-accent/12 text-accent disabled:bg-fill disabled:text-tertiary',
  gray: 'bg-fill text-label disabled:text-tertiary',
  plain: 'text-accent disabled:text-tertiary',
};

const sizes: Record<Size, string> = {
  sm: 'h-[30px] px-3.5 text-[15px] rounded-full font-semibold',
  md: 'h-11 px-5 text-[17px] rounded-[12px] font-semibold',
  lg: 'h-[50px] px-5 text-[17px] rounded-[14px] font-semibold',
};

export default function Button({
  variant = 'filled',
  size = 'md',
  block,
  destructive,
  icon,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const tone = destructive
    ? variant === 'filled'
      ? 'bg-danger text-white'
      : variant === 'tinted'
        ? 'bg-danger/12 text-danger'
        : 'text-danger'
    : variants[variant];
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-[transform,opacity] active:scale-[0.97] active:opacity-80 disabled:active:scale-100 ${
        sizes[size]
      } ${variant === 'plain' ? 'px-0' : ''} ${tone} ${block ? 'w-full' : ''} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}
