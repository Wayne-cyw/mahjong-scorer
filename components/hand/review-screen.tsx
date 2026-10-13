'use client';

import { useMemo, useState } from 'react';
import type { FanLine, Ruleset, ScoreResult, WinningHand } from '@/lib/scoring';
import { scoreHand } from '@/lib/scoring';
import type { Seat, Wind } from '@/lib/tiles';
import { draftToHand, emptyDraft, seatWind, type HandDraft } from '@/lib/game';
import packageInfo from '@/package.json';
import { Button } from '@/components/ui/button';
import { FanBreakdown } from '@/components/hand/fan-breakdown';
import { FlagsPanel } from '@/components/hand/flags-panel';
import { HandEditor } from '@/components/hand/hand-editor';
import { MeldEditor } from '@/components/hand/meld-editor';

const ENGINE_VERSION: string = packageInfo.version;

export interface ReviewConfirmation {
  hand: WinningHand;
  fan: number;
  breakdown: FanLine[];
  engineVersion: string;
}

export interface ReviewScreenProps {
  winner: Seat;
  /** Absent for a self-drawn win. */
  discarder?: Seat;
  dealer: Seat;
  prevailing: Wind;
  ruleset: Ruleset;
  seatLabel: (seat: Seat) => string;
  onConfirm: (confirmation: ReviewConfirmation) => void;
  onEnterFanDirectly: () => void;
  onBack: () => void;
  submitting?: boolean;
}

/**
 * Builds a hand tile by tile and re-scores it on every change (PD-10, PD-12). Nothing leaves this
 * component until Confirm, which is enabled only for a valid result (ADR-40, PD-14).
 */
export function ReviewScreen({
  winner,
  discarder,
  dealer,
  prevailing,
  ruleset,
  seatLabel,
  onConfirm,
  onEnterFanDirectly,
  onBack,
  submitting = false,
}: ReviewScreenProps) {
  const [draft, setDraft] = useState<HandDraft>(() => emptyDraft(discarder === undefined));

  const hand = useMemo(() => draftToHand(draft), [draft]);
  const result: ScoreResult | null = useMemo(
    () =>
      hand === null
        ? null
        : scoreHand(
            hand,
            { seatWind: seatWind(winner, dealer), prevailing, winner, discarder, dealer },
            ruleset,
          ),
    [hand, winner, discarder, dealer, prevailing, ruleset],
  );

  const canConfirm = hand !== null && result !== null && result.valid && !submitting;

  const confirm = (): void => {
    if (!canConfirm || hand === null || result === null) return;
    onConfirm({
      hand,
      fan: result.scoredFan,
      breakdown: result.breakdown,
      engineVersion: ENGINE_VERSION,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <HandEditor draft={draft} onChange={setDraft} />
      <MeldEditor draft={draft} onChange={setDraft} />
      <FlagsPanel draft={draft} onChange={setDraft} />

      {result === null ? (
        <p role="status" className="text-muted-foreground text-sm">
          Add your tiles and mark the winning tile to see the score.
        </p>
      ) : (
        <FanBreakdown
          result={result}
          minimumFan={ruleset.minFan}
          capFan={ruleset.capFan}
          seatLabel={seatLabel}
        />
      )}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={submitting}
          className="h-12 flex-1 px-4 text-base"
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={confirm}
          disabled={!canConfirm}
          className="h-12 flex-1 px-4 text-base"
        >
          Confirm
        </Button>
      </div>
      <Button
        type="button"
        variant="secondary"
        onClick={onEnterFanDirectly}
        disabled={submitting}
        className="h-12 px-4 text-base"
      >
        Enter fan directly
      </Button>
    </div>
  );
}
