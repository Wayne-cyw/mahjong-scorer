'use client';

import type { Seat } from '@/lib/tiles';
import type { Ruleset } from '@/lib/scoring';
import { basePointsFor, settle } from '@/lib/scoring';
import type { WinnerPickerResult } from '@/components/hand/winner-picker';
import { ManualFanEntry } from '@/components/hand/manual-fan-entry';
import { PaymentsPreview } from '@/components/hand/payments-preview';
import { Button } from '@/components/ui/button';

/** Payments are only meaningful once at least one fan is entered. */
const MIN_PREVIEW_FAN = 1;

export interface FanEntryStepProps {
  selection: WinnerPickerResult;
  ruleset: Ruleset;
  fan: number;
  submitting: boolean;
  seatLabel: (seat: Seat) => string;
  onFanChange: (fan: number) => void;
  onBack: () => void;
  onConfirm: () => void;
  onScoreFromTiles: () => void;
}

export const isFanInRange = (fan: number, ruleset: Ruleset): boolean =>
  fan >= ruleset.minFan && fan <= ruleset.capFan;

/** Direct fan entry with a live payments preview, Back, Confirm and a way back to tiles. */
export function FanEntryStep({
  selection,
  ruleset,
  fan,
  submitting,
  seatLabel,
  onFanChange,
  onBack,
  onConfirm,
  onScoreFromTiles,
}: FanEntryStepProps) {
  const payments =
    fan >= MIN_PREVIEW_FAN
      ? settle({
          winner: selection.winner,
          discarder: selection.discarder,
          basePoints: basePointsFor(fan, ruleset),
          model: ruleset.payment,
        })
      : null;
  const canConfirm = isFanInRange(fan, ruleset) && !submitting;

  return (
    <>
      <ManualFanEntry
        fan={fan}
        minFan={ruleset.minFan}
        capFan={ruleset.capFan}
        onChange={onFanChange}
      />

      {payments && <PaymentsPreview payments={payments} seatLabel={seatLabel} />}

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
          onClick={onConfirm}
          disabled={!canConfirm}
          className="h-12 flex-1 px-4 text-base"
        >
          Confirm
        </Button>
      </div>
      <Button
        type="button"
        variant="secondary"
        onClick={onScoreFromTiles}
        disabled={submitting}
        className="h-12 px-4 text-base"
      >
        Score from tiles
      </Button>
    </>
  );
}
