import type { Seat } from '@/lib/tiles';

const SEATS: readonly Seat[] = [0, 1, 2, 3];

export interface PaymentsPreviewProps {
  payments: [number, number, number, number];
  seatLabel: (seat: Seat) => string;
}

/** Read-only preview of each seat's point change (PD-13): computed by `settle`, shown before Confirm. */
export function PaymentsPreview({ payments, seatLabel }: PaymentsPreviewProps) {
  return (
    <section
      aria-label="Payments preview"
      className="bg-felt-raised flex flex-col gap-3 rounded-md p-4"
    >
      <h2 className="font-display text-xl font-black">Payments</h2>
      <ul className="flex flex-col gap-2">
        {SEATS.map((seat) => {
          const amount = payments[seat];
          const sign = amount > 0 ? '+' : '';
          return (
            <li
              key={seat}
              style={{ ['--i' as string]: seat }}
              className="anim-rise flex items-center justify-between gap-2 text-lg"
            >
              <span>{seatLabel(seat)}</span>
              <span
                className={
                  amount >= 0 ? 'numerals text-sign text-xl' : 'numerals text-xl text-[#ff9b92]'
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
