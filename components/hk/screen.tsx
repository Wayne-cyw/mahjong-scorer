'use client';

import type { ReactNode } from 'react';
import { m } from 'motion/react';
import { EASE_OUT_EXPO } from '@/components/motion/tokens';
import { TitleBar, type TitleBarProps } from './title-bar';

export interface ScreenProps extends TitleBarProps {
  children: ReactNode;
}

/** The common page frame: a phone-width column under a title bar, content rising in on mount. */
export function Screen({ children, ...bar }: ScreenProps) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <TitleBar {...bar} />
      <m.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
        className="flex flex-1 flex-col gap-5 px-4 pt-5 pb-10"
      >
        {children}
      </m.div>
    </main>
  );
}
