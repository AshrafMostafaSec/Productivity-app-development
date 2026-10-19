import { useRef } from 'react';

/** Keeps the last non-null value so a sheet can keep rendering its content while animating out. */
export default function useSticky<T>(value: T | null | undefined): T | null {
  const ref = useRef<T | null>(null);
  if (value !== null && value !== undefined) ref.current = value;
  return value === null || value === undefined ? ref.current : value;
}
