'use client';

import { m } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Seal } from '@/components/hk/seal';
import { ScoreFlip } from '@/components/hk/score-flip';
import { TitleBar } from '@/components/hk/title-bar';
import { EASE_OUT_EXPO } from '@/components/motion/tokens';
import type { StandingRow } from '@/lib/game';
import { cn } from '@/lib/utils';

export interface StandingsProps {
  /** Rows in rank order, each with the display name already resolved. */
  rows: (StandingRow & { name: string })[];
  /** "Final standings" once the game has ended, "Standings so far" while it is still on. */
  final: boolean;
  onRematch: () => void;
  onHome: () => void;
  rematching?: boolean;
  error?: string | null;
}

const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));

/** Ranked scores with net result against the starting points, points only (PD-19, PD-24). */
export function Standings({ rows, final, onRematch, onHome, rematching, error }: StandingsProps) {
  const top = Math.max(1, ...rows.map((r) => r.score));
  return (
    <section className="flex flex-col">
      <TitleBar
        title={final ? 'Final standings' : 'Standings so far'}
        glyph={final ? '終' : '局'}
      />
      <div className="flex flex-col gap-5 px-4 pt-5 pb-10">
        <ol className="flex flex-col gap-3">
          {rows.map((row, i) => {
            const tied = rows.filter((r) => r.rank === row.rank).length > 1;
            const leader = row.rank === 1;
            const share = Math.max(0.04, Math.min(1, row.score / top));
            return (
              <m.li
                key={row.seat}
                data-testid={`standing-${row.seat}`}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay: 0.1 + i * 0.09 }}
                className={cn(
                  'relative flex min-h-24 items-center gap-3 overflow-hidden rounded-md p-4',
                  leader ? 'bg-felt-high' : 'bg-felt-raised',
                )}
              >
                <m.span
                  aria-hidden="true"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: share }}
                  transition={{ duration: 0.9, ease: EASE_OUT_EXPO, delay: 0.3 + i * 0.09 }}
                  style={{ transformOrigin: 'left' }}
                  className={cn('absolute inset-x-0 bottom-0 h-2', leader ? 'bg-sign' : 'bg-jade')}
                />
                <span
                  className={cn(
                    'numerals w-14 shrink-0 text-4xl leading-none',
                    leader ? 'text-sign' : 'text-ivory-dim',
                  )}
                >
                  {tied ? `T${row.rank}` : row.rank}
                </span>
                <span
                  className="font-display min-w-0 flex-1 truncate text-xl font-black"
                  title={row.name}
                >
                  {row.name}
                </span>
                {leader && <Seal glyph="勝" label="" className="size-8 text-lg" />}
                <span className="flex flex-col items-end">
                  <ScoreFlip value={row.score} className="text-3xl leading-none" />
                  <span
                    className={cn('text-sm', row.net < 0 ? 'text-[#ff9b92]' : 'text-ivory-dim')}
                    aria-label={`${row.name} net result`}
                  >
                    {signed(row.net)} pts
                  </span>
                </span>
              </m.li>
            );
          })}
        </ol>
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onHome} className="h-14 flex-1 text-lg">
            Home
          </Button>
          <Button
            type="button"
            onClick={onRematch}
            disabled={rematching}
            className="h-14 flex-1 text-lg"
          >
            Rematch
          </Button>
        </div>
        {error && (
          <p role="alert" className="bg-lacquer text-ivory rounded-md p-3 font-medium">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
