'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { GameRow } from '@/lib/db';
import { listGames } from '@/lib/db';
import { GameList } from '@/components/home/game-list';

export default function HomePage() {
  const [games, setGames] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listGames()
      .then((rows) => {
        if (!cancelled) setGames(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Mahjong Score Tracker</h1>
      <Link
        href="/setup"
        className="flex min-h-12 items-center justify-center rounded bg-neutral-900 px-4 font-medium text-white"
      >
        New game
      </Link>
      {loading ? <p className="text-neutral-600">Loading games…</p> : <GameList games={games} />}
    </main>
  );
}
