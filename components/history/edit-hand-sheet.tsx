'use client';

import { useState } from 'react';
import type { HandRecord, HandWonPayload, StoredEvent } from '@/lib/game';
import { MANUAL_ENGINE_VERSION, previewEdit } from '@/lib/game';
import type { Ruleset } from '@/lib/scoring';
import { basePointsFor, settle } from '@/lib/scoring';
import type { Seat } from '@/lib/tiles';
import { Button } from '@/components/ui/button';

export type EditMode = 'undo' | 'edit';

export interface EditHandSheetProps {
  mode: EditMode;
  record: HandRecord;
  events: StoredEvent[];
  ruleset: Ruleset;
  seatNames: readonly string[];
  onCancel: () => void;
  /** `null` voids the hand (undo); a payload replaces it (edit). */
  onConfirm: (replacement: HandWonPayload | null) => Promise<void> | void;
}

const SELF_DRAWN = 'self';

/**
 * Confirmation step for undoing or correcting one hand (PD-15). It previews the
 * result with `previewEdit` and warns, before anything is written, when the
 * dealer would change. Edits are manual: fan and discarder only, payments are
 * recomputed from the ruleset.
 */
export function EditHandSheet({
  mode,
  record,
  events,
  ruleset,
  seatNames,
  onCancel,
  onConfirm,
}: EditHandSheetProps) {
  const [fanText, setFanText] = useState(String(record.fan ?? ruleset.minFan));
  const [discarder, setDiscarder] = useState<string>(
    record.discarder === undefined ? SELF_DRAWN : String(record.discarder),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fan = Number(fanText);
  const fanValid =
    fanText.trim() !== '' &&
    Number.isInteger(fan) &&
    fan >= ruleset.minFan &&
    fan <= ruleset.capFan;

  let replacement: HandWonPayload | null = null;
  if (mode === 'edit' && record.winner !== undefined && fanValid) {
    const discarderSeat = discarder === SELF_DRAWN ? undefined : (Number(discarder) as Seat);
    replacement = {
      winner: record.winner,
      discarder: discarderSeat,
      fan,
      breakdown: [],
      payments: settle({
        winner: record.winner,
        discarder: discarderSeat,
        basePoints: basePointsFor(fan, ruleset),
        model: ruleset.payment,
      }),
      engineVersion: MANUAL_ENGINE_VERSION,
      manual: true,
    };
  }

  const preview =
    mode === 'undo'
      ? previewEdit(events, record.id, null)
      : replacement
        ? previewEdit(events, record.id, replacement)
        : null;

  const confirm = async (): Promise<void> => {
    if (mode === 'edit' && replacement === null) {
      setError(`Fan must be a whole number from ${ruleset.minFan} to ${ruleset.capFan}.`);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm(mode === 'undo' ? null : replacement);
    } finally {
      setSubmitting(false);
    }
  };

  const title = mode === 'undo' ? 'Undo this hand?' : 'Edit this hand';

  return (
    <section aria-label={title} className="bg-felt-deep flex flex-col gap-3 rounded-md p-4">
      <h3 className="font-display text-xl font-black">{title}</h3>

      {mode === 'edit' && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-base">
            Fan
            <input
              type="number"
              inputMode="numeric"
              value={fanText}
              onChange={(e) => setFanText(e.target.value)}
              className="bg-felt border-felt-high focus-visible:border-sign h-12 rounded-md border-b-4 px-3 text-lg outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-base">
            Discarder
            <select
              value={discarder}
              onChange={(e) => setDiscarder(e.target.value)}
              className="bg-felt border-felt-high focus-visible:border-sign h-12 rounded-md border-b-4 px-3 text-lg outline-none"
            >
              <option value={SELF_DRAWN}>Self-drawn (自摸)</option>
              {[0, 1, 2, 3]
                .filter((seat) => seat !== record.winner)
                .map((seat) => (
                  <option key={seat} value={String(seat)}>
                    {seatNames[seat]}
                  </option>
                ))}
            </select>
          </label>
        </div>
      )}

      {preview && (
        <div className="flex flex-col gap-1 text-base">
          <p>Scores after: {preview.after.scores.join(' / ')}</p>
          {preview.laterHandsAffected > 0 && (
            <p>{preview.laterHandsAffected} later hand(s) will be re-scored.</p>
          )}
          {preview.dealerChanged && (
            <p role="alert" className="bg-lacquer text-ivory rounded-md p-3 font-bold">
              Warning: the dealer changes from {seatNames[preview.before.dealer]} to{' '}
              {seatNames[preview.after.dealer]}.
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="bg-lacquer text-ivory rounded-md p-3 font-medium">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="h-12 flex-1 text-base"
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant={mode === 'undo' ? 'destructive' : 'default'}
          disabled={submitting}
          onClick={() => void confirm()}
          className="h-12 flex-1 text-base"
        >
          {mode === 'undo' ? 'Confirm undo' : 'Apply edit'}
        </Button>
      </div>
    </section>
  );
}
