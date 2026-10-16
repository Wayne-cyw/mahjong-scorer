import type { CSSProperties, ReactNode } from 'react';
import type { Seat } from '@/lib/tiles';
import { cn } from '@/lib/utils';

/** Table positions seen from the phone: the bottom edge is nearest whoever holds the phone. */
export type Slot = 'bottom' | 'right' | 'top' | 'left';

/** Counter-clockwise from the bottom, which is the direction play passes round a table. */
export const SLOTS: readonly Slot[] = ['bottom', 'right', 'top', 'left'];

/** How far each slot's content turns so its upright edge points at the player sitting there. */
type FacingDegrees = 0 | 90 | 180 | 270;

const UPRIGHT: FacingDegrees = 0;
const QUARTER_TURN: FacingDegrees = 90;
const HALF_TURN: FacingDegrees = 180;
const THREE_QUARTER_TURN: FacingDegrees = 270;

const FACING: Record<Slot, FacingDegrees> = {
  bottom: UPRIGHT,
  right: THREE_QUARTER_TURN,
  top: HALF_TURN,
  left: QUARTER_TURN,
};

/** The seat sitting at `slot` once the table has been turned `turns` quarter turns. */
export function seatAtSlot(slot: Slot, turns: number): Seat {
  return ((SLOTS.indexOf(slot) + turns) % 4) as Seat;
}

/**
 * Turns its children so they read upright from the edge of the table it sits on. Sideways edges
 * swap the box's axes with container units, so the content keeps a landscape shape of its own.
 */
export function Facing({ slot, children }: { slot: Slot; children: ReactNode }) {
  const turn = FACING[slot];
  if (turn === UPRIGHT || turn === HALF_TURN) {
    return (
      <div className="size-full" style={{ rotate: `${turn}deg` }}>
        {children}
      </div>
    );
  }
  const style: CSSProperties = {
    width: '100cqh',
    height: '100cqw',
    translate: '-50% -50%',
    rotate: `${turn}deg`,
  };
  return (
    <div className="relative size-full" style={{ containerType: 'size' }}>
      <div className="absolute top-1/2 left-1/2" style={style}>
        {children}
      </div>
    </div>
  );
}

export interface CompassProps {
  /** Content for each slot; it is turned to face the player sitting there. */
  slots: Record<Slot, ReactNode>;
  /** The marker in the middle of the table, always upright for the bottom edge. */
  center: ReactNode;
  className?: string;
}

/**
 * The table seen from above: four edges around a centre marker, set on a lacquered rail so the
 * baize reads as a table. Rows and columns are fixed so the sideways seats get a real box.
 */
export function Compass({ slots, center, className }: CompassProps) {
  return (
    <div className={cn('bg-green-deep rounded-xl p-2.5', className)}>
      <div className="bg-green grid w-full grid-cols-[5.75rem_minmax(0,1fr)_5.75rem] grid-rows-[6.25rem_11.5rem_6.25rem] gap-1.5 rounded-lg p-1.5 md:grid-cols-[7rem_minmax(0,1fr)_7rem] md:grid-rows-[7.5rem_14rem_7.5rem] md:gap-2 md:p-2">
        <div className="col-span-3 col-start-1 row-start-1">
          <Facing slot="top">{slots.top}</Facing>
        </div>
        <div className="col-start-1 row-start-2">
          <Facing slot="left">{slots.left}</Facing>
        </div>
        <div className="col-start-2 row-start-2">{center}</div>
        <div className="col-start-3 row-start-2">
          <Facing slot="right">{slots.right}</Facing>
        </div>
        <div className="col-span-3 col-start-1 row-start-3">
          <Facing slot="bottom">{slots.bottom}</Facing>
        </div>
      </div>
    </div>
  );
}
