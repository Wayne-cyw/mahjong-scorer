import type { Seat } from '@/lib/tiles';
import type { WinnerPickerResult } from '@/components/hand/winner-picker';
import { Seal } from '@/components/hk/seal';

export interface WinnerSummaryProps {
  selection: WinnerPickerResult;
  seatLabel: (seat: Seat) => string;
}

/** One line restating who won and how, shown above every scoring step. */
export function WinnerSummary({ selection, seatLabel }: WinnerSummaryProps) {
  const { winner, discarder } = selection;
  return (
    <p className="font-display flex items-center gap-3 text-xl leading-snug font-black">
      <Seal glyph="胡" label="" className="h-12 w-9 text-2xl" />
      <span>
        {seatLabel(winner)} won
        {discarder === undefined ? ' by self-draw' : ` off ${seatLabel(discarder)}'s discard`}.
      </span>
    </p>
  );
}
