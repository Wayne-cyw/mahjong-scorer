'use client';

import { useState } from 'react';
import { useGameStore } from '@/stores/game-store';
import type { OverrideValues } from './override-sheet';

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * The table's end-game and override flows: which panel is open, and the store calls behind
 * them. A refusal resolves false and sets the store's error, so the panel stays open; a
 * thrown write failure is surfaced through `actionError`.
 */
export function useTableActions(onGameEnded?: () => void) {
  const endGame = useGameStore((s) => s.endGame);
  const overrideState = useGameStore((s) => s.overrideState);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [overriding, setOverriding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const finish = async (reason: 'completed' | 'manual'): Promise<void> => {
    setActionError(null);
    try {
      if (!(await endGame(reason))) return;
      setConfirmingEnd(false);
      onGameEnded?.();
    } catch (error) {
      setActionError(messageOf(error));
    }
  };

  const applyOverride = async (values: OverrideValues): Promise<void> => {
    setActionError(null);
    try {
      if (!(await overrideState(values))) return;
      setOverriding(false);
    } catch (error) {
      setActionError(messageOf(error));
    }
  };

  return {
    confirmingEnd,
    setConfirmingEnd,
    overriding,
    setOverriding,
    actionError,
    finish,
    applyOverride,
  };
}
