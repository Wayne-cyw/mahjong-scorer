import type { Seat, Wind } from '@/lib/tiles';

/** Bilingual compass label for each wind, independent of the honor-tile names in `tileName`. */
export const WIND_LABEL: Record<Wind, { en: string; zh: string }> = {
  E: { en: 'East', zh: '東' },
  S: { en: 'South', zh: '南' },
  W: { en: 'West', zh: '西' },
  N: { en: 'North', zh: '北' },
};

export interface SeatCardProps {
  seat: Seat;
  name: string;
  score: number;
  wind: Wind;
  isDealer: boolean;
  dealerRepeat: number;
}

/** One seat: player name, score (large, legible at arm's length), seat wind and dealer marker (PD-06, PD-26). */
export function SeatCard({ seat, name, score, wind, isDealer, dealerRepeat }: SeatCardProps) {
  const label = WIND_LABEL[wind];
  return (
    <div
      data-testid={`seat-card-${seat}`}
      data-dealer={isDealer}
      className="border-border bg-card flex min-h-[7.5rem] flex-col justify-between gap-2 rounded-lg border-2 p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-lg font-semibold" title={name}>
          {name}
        </span>
        {isDealer && (
          <span className="bg-primary text-primary-foreground shrink-0 rounded px-2 py-0.5 text-xs font-bold">
            Dealer 莊
          </span>
        )}
      </div>
      <div className="text-4xl leading-none font-bold tabular-nums" aria-label={`${name} score`}>
        {score}
      </div>
      <div className="text-muted-foreground text-sm">
        {label.en} {label.zh}
        {isDealer && dealerRepeat > 0 ? ` · repeat ${dealerRepeat}` : null}
      </div>
    </div>
  );
}
