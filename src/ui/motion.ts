/** Shared motion presets so every animation in the app feels like the same system. */
export const spring = { type: 'spring', stiffness: 520, damping: 38, mass: 0.9 } as const;
export const softSpring = { type: 'spring', stiffness: 260, damping: 30 } as const;
export const sheetSpring = { type: 'spring', stiffness: 380, damping: 40, mass: 1 } as const;
export const ease = [0.32, 0.72, 0, 1] as const;
