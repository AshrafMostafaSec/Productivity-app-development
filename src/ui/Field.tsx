import type { InputHTMLAttributes } from 'react';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

/** A text input laid out as a grouped-list row. Place inside <Group>. */
export default function Field({ label, className = '', ...rest }: FieldProps) {
  return (
    <label className="ios-row flex items-center pl-4">
      <span className="ios-row-content flex min-h-[44px] flex-1 items-center gap-3 pr-4">
        {label && <span className="w-24 shrink-0 text-[17px]">{label}</span>}
        <input
          {...rest}
          className={`min-w-0 flex-1 bg-transparent py-[11px] text-[17px] outline-none placeholder:text-tertiary ${className}`}
        />
      </span>
    </label>
  );
}
