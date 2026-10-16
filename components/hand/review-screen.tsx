'use client';

import { useMemo, useState } from 'react';
import type { FanLine, Ruleset, ScoreResult, WinningHand } from '@/lib/scoring';
import { ENGINE_VERSION, scoreHand } from '@/lib/scoring';
import type { Seat, Wind } from '@/lib/tiles';
import { draftToHand, emptyDraft, seatWind, type HandDraft } from '@/lib/game';
import { countCorrections, type UncertainTiles } from '@/lib/recognition';
import { Button } from '@/components/ui/button';
import { FanBreakdown } from '@/components/hand/fan-breakdown';
import { FlagsPanel } from '@/components/hand/flags-panel';
import { HandEditor } from '@/components/hand/hand-editor';
import { MeldEditor } from '@/components/hand/meld-editor';

export interface ReviewConfirmation {
  hand: WinningHand;
  fan: number;
  breakdown: FanLine[];
  engineVersion: string;
  /** Tiles changed from the recognised hand; 0 when the hand was typed from scratch. */
  corrections: number;
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
  /** A recognised hand to start from (melds exposed, no winning tile; ADR-46). */
  initialDraft?: HandDraft;
  /** Tiles the photo reader flagged, highlighted until the tile list changes (ADR-45). */
  initialUncertain?: UncertainTiles;
  /** Non-blocking notes from recognition, e.g. an unexpected tile count. */
  warnings?: string[];
  /** Why the photo could not be read; the manual picker is the way forward (ADR-49). */
  notice?: string;
  /** Object URL of the photo, shown for reference. Owned and revoked by the caller. */
  photoUrl?: string;
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
  initialDraft,
  initialUncertain,
  warnings = [],
  notice,
  photoUrl,
}: ReviewScreenProps) {
  const [start] = useState<HandDraft>(() => initialDraft ?? emptyDraft(discarder === undefined));
  const [draft, setDraft] = useState<HandDraft>(start);
  const [uncertain, setUncertain] = useState<UncertainTiles | undefined>(initialUncertain);

  // Highlights are positions, so adding or removing a tile makes them unreliable: drop them then.
  const change = (next: HandDraft): void => {
    const shifted =
      next.concealed.length !== draft.concealed.length ||
      next.bonus.length !== draft.bonus.length ||
      next.melds.length !== draft.melds.length ||
      next.melds.some((m, i) => m.tiles.length !== draft.melds[i]?.tiles.length);
    if (shifted) setUncertain(undefined);
    setDraft(next);
  };

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
      corrections: countCorrections(start, draft),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {notice && (
        <p role="status" className="bg-cream-raised rounded-md p-3 text-base">
          {notice}
        </p>
      )}
      {uncertain &&
        (uncertain.concealed.size > 0 || uncertain.melds.size > 0 || uncertain.bonus.size > 0) && (
          <p role="status" className="bg-cream-raised rounded-md p-3 text-base">
            Tiles outlined in amber were hard to read. Check them against the photo.
          </p>
        )}
      {warnings.length > 0 && (
        <ul className="text-ink-dim list-disc pl-5 text-sm">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      {photoUrl && (
        // A blob object URL held in memory only (PD-27); next/image cannot optimise it.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt="Photo of your hand, for reference"
          className="bg-cream-deep max-h-48 w-full rounded-md object-contain"
        />
      )}
      <HandEditor draft={draft} onChange={change} uncertain={uncertain} />
      <MeldEditor draft={draft} onChange={change} uncertain={uncertain?.melds} />
      <FlagsPanel draft={draft} onChange={change} />

      {result === null ? (
        <p role="status" className="text-ink-dim text-base">
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
