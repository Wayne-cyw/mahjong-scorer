import type { ReactNode } from 'react';

/** A centred message (loading, not found) with a tile that lights and dims while the app waits. */
export function StatusScreen({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 p-6 text-center">
      <span
        aria-hidden="true"
        className="anim-lamp bg-ivory font-display text-lacquer border-jade grid h-20 w-16 place-items-center rounded-md border-b-[6px] text-4xl leading-none font-black"
      >
        中
      </span>
      {children}
    </main>
  );
}
