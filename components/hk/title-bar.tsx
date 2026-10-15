import type { ReactNode } from 'react';
import { GlyphTile } from './glyph-tile';

export interface TitleBarProps {
  title: string;
  /** One decorative character shown on the yellow plate beside the title. */
  glyph: string;
  /** A control for the right-hand end, e.g. Cancel or Back. */
  action?: ReactNode;
}

/** The page's signboard strip: canvas trim over a lacquer band, glyph plate, title, action. */
export function TitleBar({ title, glyph, action }: TitleBarProps) {
  return (
    <header>
      <span className="trim-canvas block h-2.5" aria-hidden="true" />
      <div className="bg-green-deep text-ivory flex items-center gap-3 px-4 py-3">
        <GlyphTile glyph={glyph} tone="ivory" size="md" />
        <h1 className="font-display min-w-0 flex-1 text-2xl leading-tight font-black">{title}</h1>
        {action}
      </div>
    </header>
  );
}
