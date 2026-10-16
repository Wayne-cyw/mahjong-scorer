'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export interface DrawSectionProps {
  submitting: boolean;
  onConfirmDraw: () => Promise<void>;
}

/** The Draw button and its inline "Record this hand as a draw?" confirmation. */
export function DrawSection({ submitting, onConfirmDraw }: DrawSectionProps) {
  const [confirmingDraw, setConfirmingDraw] = useState(false);

  const confirmDraw = async (): Promise<void> => {
    try {
      await onConfirmDraw();
    } finally {
      setConfirmingDraw(false);
    }
  };

  return (
    <div className="bg-cream-deep flex flex-col gap-3 rounded-md p-4">
      {!confirmingDraw ? (
        <Button
          type="button"
          variant="secondary"
          onClick={() => setConfirmingDraw(true)}
          className="h-12 px-4 text-base"
        >
          <span aria-hidden="true" className="font-display font-black">
            流局
          </span>
          Draw
        </Button>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="font-display text-lg font-black">Record this hand as a draw?</p>
          <div className="flex gap-3">
            <Button
              type="button"
              onClick={() => void confirmDraw()}
              disabled={submitting}
              className="h-12 flex-1 px-4 text-base"
            >
              Confirm draw
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmingDraw(false)}
              disabled={submitting}
              className="h-12 flex-1 px-4 text-base"
            >
              Never mind
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
