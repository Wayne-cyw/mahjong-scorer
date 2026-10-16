'use client';

import { useEffect, useRef, useState } from 'react';
import type { HandDraft } from '@/lib/game';
import {
  draftFromRecognition,
  failureMessage,
  type RecognitionResult,
  type RecognizeErrorCode,
  type UncertainTiles,
} from '@/lib/recognition';
import type { WinnerPickerResult } from '@/components/hand/winner-picker';

/** What the camera step handed to the review screen. Empty when the player skipped it. */
export interface Recognition {
  photoUrl?: string;
  draft?: HandDraft;
  uncertain?: UncertainTiles;
  warnings: string[];
  notice?: string;
}

/** Which way the hand is being scored: photographing it, the tile review screen, or typing fan. */
export type EntryMode = 'camera' | 'tiles' | 'fan';

const INITIAL_FAN = 0;
const INITIAL_ENTRY: EntryMode = 'camera';
const emptyRecognition = (): Recognition => ({ warnings: [] });

export interface HandDraftState {
  selection: WinnerPickerResult | null;
  fan: number;
  entry: EntryMode;
  recognition: Recognition;
  /** Changes whenever a new review should start, so the review screen remounts fresh. */
  reviewKey: number;
  /** When the winner was picked, in epoch ms; undefined before that. */
  getStartedAt: () => number | undefined;
  setFan: (fan: number) => void;
  setEntry: (entry: EntryMode) => void;
  selectWinner: (result: WinnerPickerResult) => void;
  backToWinner: () => void;
  openReview: (next: Recognition) => void;
  handleRecognized: (result: RecognitionResult, url: string) => void;
  handleCameraFailure: (code: RecognizeErrorCode, url: string) => void;
}

/**
 * The in-progress hand on the `/hand` page: who won, how it is being scored, the
 * recognised draft and the manual fan. Owns the photo's object URL and releases it
 * whenever the draft is reset or the page unmounts (PD-27).
 */
export function useHandDraft(): HandDraftState {
  const [selection, setSelection] = useState<WinnerPickerResult | null>(null);
  const [fan, setFan] = useState(INITIAL_FAN);
  const [entry, setEntry] = useState<EntryMode>(INITIAL_ENTRY);
  const [recognition, setRecognition] = useState<Recognition>(emptyRecognition);
  const [reviewKey, setReviewKey] = useState(0);
  const startedAt = useRef<number | undefined>(undefined);
  const photoUrl = useRef<string | undefined>(undefined);

  /** The photo lives only as an object URL in memory (PD-27); release it as soon as it is not needed. */
  const releasePhoto = (): void => {
    if (!photoUrl.current) return;
    URL.revokeObjectURL(photoUrl.current);
    photoUrl.current = undefined;
  };

  useEffect(() => releasePhoto, []);

  const resetScoring = (): void => {
    releasePhoto();
    setRecognition(emptyRecognition());
    setEntry(INITIAL_ENTRY);
    setFan(INITIAL_FAN);
  };

  const selectWinner = (result: WinnerPickerResult): void => {
    resetScoring();
    startedAt.current = Date.now();
    setSelection(result);
  };

  const backToWinner = (): void => {
    resetScoring();
    setSelection(null);
  };

  const openReview = (next: Recognition): void => {
    photoUrl.current = next.photoUrl;
    setRecognition(next);
    setReviewKey((key) => key + 1);
    setEntry('tiles');
  };

  const handleRecognized = (result: RecognitionResult, url: string): void => {
    if (!selection) return;
    const isSelfDrawn = selection.discarder === undefined;
    openReview({ photoUrl: url, ...draftFromRecognition(result, isSelfDrawn) });
  };

  const handleCameraFailure = (code: RecognizeErrorCode, url: string): void => {
    openReview({ photoUrl: url, warnings: [], notice: failureMessage(code) });
  };

  return {
    selection,
    fan,
    entry,
    recognition,
    reviewKey,
    getStartedAt: () => startedAt.current,
    setFan,
    setEntry,
    selectWinner,
    backToWinner,
    openReview,
    handleRecognized,
    handleCameraFailure,
  };
}
