import type { Bonus, Tile as TileCode } from '@/lib/tiles';
import { tileName } from '@/lib/tiles';
import { cn } from '@/lib/utils';

export type TileState = 'normal' | 'uncertain' | 'selected';
export type TileSize = 'sm' | 'md' | 'lg';

const SIZE_PX: Record<TileSize, { w: number; h: number }> = {
  sm: { w: 30, h: 40 },
  md: { w: 48, h: 64 },
  lg: { w: 60, h: 80 },
};

export interface TileProps {
  code: TileCode | Bonus;
  size?: TileSize;
  state?: TileState;
  /** Hide from assistive tech when a parent control already carries the label. */
  decorative?: boolean;
  className?: string;
}

const STATE_CLASS: Record<TileState, string> = {
  normal: '',
  uncertain: 'ring-2 ring-amber-400 ring-offset-1 ring-offset-felt',
  selected: '-translate-y-2 ring-2 ring-ivory ring-offset-1 ring-offset-felt',
};

/** One tile drawn from the generated sprite (`public/tiles.svg`). */
export function Tile({ code, size = 'md', state = 'normal', decorative, className }: TileProps) {
  const { w, h } = SIZE_PX[size];
  const name = tileName(code);
  const label =
    state === 'uncertain' ? `${name.en} ${name.zh} (uncertain)` : `${name.en} ${name.zh}`;
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 60 80"
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
      data-state={state}
      className={cn(
        'border-jade shrink-0 rounded-[9px] border-b-[5px] transition-transform duration-200',
        STATE_CLASS[state],
        className,
      )}
    >
      <use href={`/tiles.svg#${code}`} />
    </svg>
  );
}
