'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { GameRow } from '@/lib/db';
import { listGames } from '@/lib/db';
import { BackupPanel } from '@/components/settings/backup-panel';
import { GameList } from '@/components/home/game-list';
import { HangingSign } from '@/components/hk/hanging-sign';

export default function HomePage() {
  const [games, setGames] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [reloadKey, setReloadKey] = useState(0);

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
  }, [reloadKey]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <span className="trim-canvas anim-stripe-run block h-3.5" aria-hidden="true" />

      <section className="flex gap-5 px-5 pt-8 pb-7">
        <HangingSign text="麻雀計分" className="mt-3" />
        <div className="anim-rise flex min-w-0 flex-1 flex-col justify-between gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-[2.1rem] leading-[1.05] font-black">
              Mahjong Score Tracker
            </h1>
            <p className="text-ink-dim text-base">
              Old-style Hong Kong scoring for a table of four. Works without a signal.
            </p>
          </div>
          <Link
            href="/setup"
            style={{ ['--i' as string]: 2 }}
            className="anim-rise bg-primary text-primary-foreground border-green-deep font-display flex h-16 items-center justify-center gap-3 rounded-md border-b-4 text-2xl font-black transition-transform duration-150 active:translate-y-[3px] active:border-b-2"
          >
            <span aria-hidden="true">開</span>
            New game
          </Link>
        </div>
      </section>

      <div className="bg-cream-deep flex flex-1 flex-col gap-6 px-5 pt-6 pb-10">
        <section aria-label="Games" className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-black">Games</h2>
          {loading ? <p className="text-ink-dim">Loading games…</p> : <GameList games={games} />}
        </section>
        <BackupPanel onImported={() => setReloadKey((k) => k + 1)} />
      </div>
    </main>
  );
}
