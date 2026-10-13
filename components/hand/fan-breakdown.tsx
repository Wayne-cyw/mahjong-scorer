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
    <section
      aria-label="Fan breakdown"
      className="bg-felt-raised flex flex-col gap-4 rounded-md p-4"
    >
      {!result.valid && (
        <p role="alert" className="bg-lacquer text-ivory rounded-md p-3 font-medium">
          {reason}
        </p>
      )}
      {result.breakdown.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {result.breakdown.map((line, i) => (
            <li
              key={`${line.ruleId}-${i}`}
              style={{ ['--i' as string]: i }}
              className="anim-rise bg-felt-deep flex items-center justify-between gap-2 rounded-md px-3 py-2.5"
            >
              <span>
                {line.nameEn} <span lang="zh-Hant">{line.nameZh}</span>
              </span>
              <span className="numerals text-sign text-lg">{line.fan} fan</span>
            </li>
          ))}
        </ul>
      )}
      <p className="font-display text-2xl leading-tight font-black">
        Total {result.fan} fan
        {result.scoredFan !== result.fan ? ` (capped at ${result.scoredFan})` : ''}
        <span className="text-ivory-dim ml-2 font-sans text-sm font-normal">
          minimum {minimumFan}, cap {capFan}
        </span>
      </p>
      {result.valid && (
        <ul aria-label="Payments" className="flex flex-col gap-2">
          {SEATS.map((seat) => {
            const amount = result.payments[seat];
            return (
              <li key={seat} className="flex items-center justify-between gap-2 text-lg">
                <span>{seatLabel(seat)}</span>
                <span
                  className={
                    amount >= 0 ? 'numerals text-sign text-xl' : 'numerals text-xl text-[#ff9b92]'
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
