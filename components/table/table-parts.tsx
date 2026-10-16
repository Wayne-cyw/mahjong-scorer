'use client';

import type { ReactNode } from 'react';
import { RotateCw } from 'lucide-react';
import { m, type Transition } from 'motion/react';
import { Button } from '@/components/ui/button';

/** Spring for the slide-up panels (complete, confirm end, override). No shared token matches. */
const PANEL_SPRING: Transition = { type: 'spring', stiffness: 380, damping: 30 };
/** Spring for the rotate icon's quarter turn. No shared token matches. */
const ROTATE_ICON_SPRING: Transition = { type: 'spring', stiffness: 300, damping: 18 };
/** Degrees the rotate icon starts from before springing back to rest. */
const ROTATE_ICON_FROM_DEG = -90;

/** Shared enter/exit motion for the table's slide-up panels. */
export const panelMotion = {
  initial: { opacity: 0, y: 14, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 8 },
  transition: PANEL_SPRING,
} as const;

/** Rotate control; `turn` re-keys the icon so each tap replays its spin. */
export function RotateButton({ turn, onRotate }: { turn: number; onRotate: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onRotate}
      className="size-12 shrink-0 px-0"
      aria-label="Rotate table"
    >
      <m.span
        key={turn}
        initial={{ rotate: ROTATE_ICON_FROM_DEG }}
        animate={{ rotate: 0 }}
        transition={ROTATE_ICON_SPRING}
        className="inline-flex"
      >
        <RotateCw className="size-6" aria-hidden="true" />
      </m.span>
    </Button>
  );
}

/** An animated cream panel; give it a `key` when it is a direct child of AnimatePresence. */
export function PanelSection({ children }: { children: ReactNode }) {
  return (
    <m.section {...panelMotion} className="bg-cream-raised flex flex-col gap-3 rounded-md p-4">
      {children}
    </m.section>
  );
}

export interface ActionBarProps {
  inProgress: boolean;
  onHandOver?: () => void;
  onHistory?: () => void;
  onOverride: () => void;
  onEndNow: () => void;
}

/** The sticky bottom bar: hand-over stays under the thumb, with history/override/end below. */
export function ActionBar({
  inProgress,
  onHandOver,
  onHistory,
  onOverride,
  onEndNow,
}: ActionBarProps) {
  return (
    <div className="bg-background sticky bottom-0 -mx-4 mt-auto flex flex-col gap-3 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <span className="trim-canvas -mx-4 block h-2" aria-hidden="true" />
      {inProgress && (
        <Button
          type="button"
          onClick={() => onHandOver?.()}
          className="h-16 w-full px-4 text-2xl tracking-wide"
        >
          <span aria-hidden="true" className="font-display font-black">
            胡
          </span>
          Hand over
        </Button>
      )}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onHistory}
          className="h-12 flex-1 px-3 text-base"
        >
          History
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onOverride}
          className="h-12 flex-1 px-3 text-base"
        >
          Override
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={onEndNow}
          className="h-12 flex-1 px-3 text-base"
        >
          End now
        </Button>
      </div>
    </div>
  );
}
