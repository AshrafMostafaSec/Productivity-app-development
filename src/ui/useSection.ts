import { useState } from 'react';

/** Section state for SubTabs plus the slide direction for the transition. */
export default function useSection<T extends string>(order: readonly T[], initial: T = order[0]) {
  const [section, setSection] = useState<T>(initial);
  const [direction, setDirection] = useState(1);
  const change = (next: T) => {
    setDirection(order.indexOf(next) >= order.indexOf(section) ? 1 : -1);
    setSection(next);
  };
  return { section, direction, setSection: change };
}
