import type { ReactNode } from 'react';
import { GlyphTile } from './glyph-tile';

/** A centred message (loading, not found) with a tile that lights and dims while the app waits. */
export function StatusScreen({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 p-6 text-center">
      <GlyphTile glyph="中" size="lg" className="anim-lamp h-24 w-[4.5rem] text-5xl" />
      {children}
    </main>
  );
}
