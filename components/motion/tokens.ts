import type { Transition } from 'motion/react';

/** Shared easing and spring tokens so every screen moves with the same hand. */
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

export const SPRING_SNAP: Transition = { type: 'spring', stiffness: 520, damping: 30, mass: 0.8 };
export const SPRING_SOFT: Transition = { type: 'spring', stiffness: 260, damping: 26 };
export const SPRING_BOUNCE: Transition = { type: 'spring', stiffness: 380, damping: 16 };
/** Loose, heavy landing for thrown dice. */
export const SPRING_TUMBLE: Transition = { type: 'spring', stiffness: 240, damping: 13, mass: 0.9 };

export const ENTER: Transition = { duration: 0.5, ease: EASE_OUT_EXPO };

/** Stagger delay in seconds for the nth child of a group. */
export const stagger = (index: number, step = 0.07): number => index * step;
