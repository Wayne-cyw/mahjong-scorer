import Link from 'next/link';
import type { GameRow } from '@/lib/db';
import { cn } from '@/lib/utils';

export interface GameListProps {
  games: readonly GameRow[];
}

/**
 * Lists saved games as score slips, offering "Continue" for a game still in progress or one
 * that is complete but not yet ended (so it can be ended or its last hand undone).
 */
export function GameList({ games }: GameListProps) {
  if (games.length === 0) {
    return <p className="text-ink-dim">No games yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {games.map((game, index) => {
        const live = game.status === 'playing' || game.status === 'complete';
        return (
          <li
            key={game.id}
            style={{ ['--i' as string]: index }}
            className="anim-rise bg-cream-raised flex min-h-16 items-center justify-between gap-3 rounded-md py-2 pr-2 pl-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden="true"
                className={cn(
                  'size-3 shrink-0 rounded-full',
                  live ? 'bg-green anim-lamp' : 'bg-cream-edge',
                )}
              />
              <div className="min-w-0">
                <p className="font-display truncate text-lg leading-tight font-black">
                  {game.name ?? new Date(game.createdAt).toLocaleString()}
                </p>
                <p className="text-ink-dim text-sm capitalize">{game.status}</p>
              </div>
            </div>
            {live && (
              <Link
                href={`/game/${game.id}`}
                className="bg-primary text-primary-foreground border-green-deep flex h-12 shrink-0 items-center rounded-md border-b-4 px-5 text-base font-bold transition-transform duration-150 active:translate-y-[3px] active:border-b-2"
              >
                Continue
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
