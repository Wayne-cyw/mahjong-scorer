import type { Seat } from '@/lib/tiles';

const SEATS: readonly Seat[] = [0, 1, 2, 3];

export interface PaymentsPreviewProps {
  payments: [number, number, number, number];
  seatLabel: (seat: Seat) => string;
}

/** Read-only preview of each seat's point change (PD-13): computed by `settle`, shown before Confirm. */
export function PaymentsPreview({ payments, seatLabel }: PaymentsPreviewProps) {
  return (
    <section aria-label="Payments preview" className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Payments</h2>
      <ul className="flex flex-col gap-1">
        {SEATS.map((seat) => {
          const amount = payments[seat];
          const sign = amount > 0 ? '+' : '';
          return (
            <li key={seat} className="flex items-center justify-between gap-2 text-base">
              <span>{seatLabel(seat)}</span>
              <span
                className={
                  amount >= 0
                    ? 'font-semibold text-green-700 tabular-nums'
                    : 'font-semibold text-red-700 tabular-nums'
                }
              >
                {sign}
                {amount}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
