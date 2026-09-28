import Link from 'next/link';
import type { GameRow } from '@/lib/db';

export interface GameListProps {
  games: readonly GameRow[];
}

/** Lists saved games, offering "Continue" only for a game still in progress. */
export function GameList({ games }: GameListProps) {
  if (games.length === 0) {
    return <p className="text-neutral-600">No games yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {games.map((game) => (
        <li
          key={game.id}
          className="flex min-h-12 items-center justify-between gap-3 rounded border border-neutral-300 p-3"
        >
          <div>
            <p className="font-medium">{game.name ?? new Date(game.createdAt).toLocaleString()}</p>
            <p className="text-sm text-neutral-600 capitalize">{game.status}</p>
          </div>
          {game.status === 'playing' && (
            <Link
              href={`/game/${game.id}`}
              className="flex min-h-12 items-center rounded bg-neutral-900 px-4 font-medium text-white"
            >
              Continue
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
