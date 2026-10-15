import { cn } from '@/lib/utils';

export type GlyphTone = 'ivory' | 'green' | 'sign' | 'lacquer';
export type GlyphSize = 'sm' | 'md' | 'lg';

const SIZE: Record<GlyphSize, string> = {
  sm: 'h-9 w-7 text-xl',
  md: 'h-12 w-9 text-2xl',
  lg: 'h-16 w-12 text-4xl',
};

const TONE: Record<GlyphTone, string> = {
  ivory: 'bg-ivory text-lacquer border-green',
  green: 'bg-green text-ivory border-green-deep',
  sign: 'bg-sign text-green-deep border-sign-deep',
  lacquer: 'bg-lacquer text-ivory border-lacquer-deep',
};

export interface GlyphTileProps {
  glyph: string;
  tone?: GlyphTone;
  size?: GlyphSize;
  className?: string;
}

/**
 * A mahjong tile seen from the front: always a portrait rectangle, with the thick back edge
 * showing underneath. Purely decorative; whatever it names is spoken by nearby text.
 */
export function GlyphTile({ glyph, tone = 'ivory', size = 'md', className }: GlyphTileProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'font-display inline-grid shrink-0 place-items-center rounded-[7px] border-b-[5px] leading-none font-black',
        SIZE[size],
        TONE[tone],
        className,
      )}
    >
      {glyph}
    </span>
  );
}
