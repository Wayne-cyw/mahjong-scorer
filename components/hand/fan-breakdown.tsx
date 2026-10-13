import type { ScoreResult } from '@/lib/scoring';
import type { Seat } from '@/lib/tiles';

const SEATS: readonly Seat[] = [0, 1, 2, 3];

const REASONS: Record<NonNullable<ScoreResult['reason']>, string> = {
  'too-many-copies': 'This hand uses more than 4 copies of a tile.',
  'wrong-tile-count': 'The hand does not have the right number of tiles.',
  'not-a-winning-hand': 'This is not a winning hand.',
  'below-minimum': 'The hand is below the minimum fan required to win.',
};

export interface FanBreakdownProps {
  result: ScoreResult;
  minimumFan: number;
  capFan: number;
  seatLabel: (seat: Seat) => string;
}

/** Fan lines (English + 中文), total versus minimum and cap, and per-seat payments. */
export function FanBreakdown({ result, minimumFan, capFan, seatLabel }: FanBreakdownProps) {
  const reason = result.reason ? REASONS[result.reason] : 'This hand cannot be scored.';
  return (
    <section aria-label="Fan breakdown" className="flex flex-col gap-3">
      {!result.valid && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-red-800">
          {reason}
        </p>
      )}
      {result.breakdown.length > 0 && (
        <ul className="flex flex-col gap-1">
          {result.breakdown.map((line, i) => (
            <li key={`${line.ruleId}-${i}`} className="flex items-center justify-between gap-2">
              <span>
                {line.nameEn} <span lang="zh-Hant">{line.nameZh}</span>
              </span>
              <span className="font-semibold tabular-nums">{line.fan} fan</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-base font-semibold">
        Total {result.fan} fan
        {result.scoredFan !== result.fan ? ` (capped at ${result.scoredFan})` : ''}
        <span className="text-muted-foreground ml-2 text-sm font-normal">
          minimum {minimumFan}, cap {capFan}
        </span>
      </p>
      {result.valid && (
        <ul aria-label="Payments" className="flex flex-col gap-1">
          {SEATS.map((seat) => {
            const amount = result.payments[seat];
            return (
              <li key={seat} className="flex items-center justify-between gap-2">
                <span>{seatLabel(seat)}</span>
                <span
                  className={
                    amount >= 0
                      ? 'font-semibold text-green-700 tabular-nums'
                      : 'font-semibold text-red-700 tabular-nums'
                  }
                >
                  {amount > 0 ? '+' : ''}
                  {amount}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
