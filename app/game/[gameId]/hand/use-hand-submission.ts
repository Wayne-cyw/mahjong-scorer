'use client';

import { useState } from 'react';
import { useGameStore } from '@/stores/game-store';

const DEFAULT_REFUSAL = 'This hand was not saved.';

/** A refused action resolves false and leaves its reason in the store's error. */
const refusalMessage = (): string => useGameStore.getState().error ?? DEFAULT_REFUSAL;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export interface HandSubmission {
  submitting: boolean;
  submitError: string | null;
  clearError: () => void;
  /**
   * Runs one store write. On success calls `onSaved`; on refusal or failure keeps the
   * user here with the reason in `submitError`.
   */
  submit: (write: () => Promise<boolean>, onSaved: () => void) => Promise<void>;
}

/** Tracks the single in-flight write (win or draw) for the `/hand` page and its error. */
export function useHandSubmission(): HandSubmission {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fail = (message: string): void => {
    setSubmitError(message);
    setSubmitting(false);
  };

  const submit = async (write: () => Promise<boolean>, onSaved: () => void): Promise<void> => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (!(await write())) {
        fail(refusalMessage());
        return;
      }
      onSaved();
    } catch (error) {
      fail(errorMessage(error));
    }
  };

  return { submitting, submitError, clearError: () => setSubmitError(null), submit };
}
