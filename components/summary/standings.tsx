import { Button } from '@/components/ui/button';
import type { StandingRow } from '@/lib/game';

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
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{final ? 'Final standings' : 'Standings so far'}</h1>
      <ol className="flex flex-col gap-3">
        {rows.map((row) => {
          const tied = rows.filter((r) => r.rank === row.rank).length > 1;
          return (
            <li
              key={row.seat}
              data-testid={`standing-${row.seat}`}
              className="border-border bg-card flex items-center gap-3 rounded-lg border-2 p-4"
            >
              <span className="w-14 shrink-0 text-xl font-bold tabular-nums">
                {tied ? `T${row.rank}` : row.rank}
              </span>
              <span className="min-w-0 flex-1 truncate text-lg font-semibold" title={row.name}>
                {row.name}
              </span>
              <span className="flex flex-col items-end tabular-nums">
                <span className="text-2xl leading-none font-bold">{row.score}</span>
                <span className="text-sm" aria-label={`${row.name} net result`}>
                  {signed(row.net)} pts
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onHome} className="h-12 flex-1 text-base">
          Home
        </Button>
        <Button
          type="button"
          onClick={onRematch}
          disabled={rematching}
          className="h-12 flex-1 text-base"
        >
          Rematch
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
