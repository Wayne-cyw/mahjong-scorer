import type { Bonus, Tile as TileCode } from '@/lib/tiles';
import { BONUSES, TILES, tileName } from '@/lib/tiles';
import { Tile } from './tile';

export const MAX_COPIES = 4;

type Code = TileCode | Bonus;

interface Group {
  id: string;
  title: string;
  codes: readonly Code[];
}

const GROUPS: readonly Group[] = [
  { id: 'm', title: 'Characters 萬', codes: TILES.filter((t) => t.startsWith('m')) },
  { id: 'p', title: 'Dots 筒', codes: TILES.filter((t) => t.startsWith('p')) },
  { id: 's', title: 'Bamboo 索', codes: TILES.filter((t) => t.startsWith('s')) },
  { id: 'z', title: 'Honours 字', codes: TILES.filter((t) => t.startsWith('z')) },
  { id: 'f', title: 'Bonus 花', codes: BONUSES },
];

export interface TilePickerProps {
  onPick: (code: Code) => void;
  /** Tiles already placed in the hand; a tile with 4 copies (a bonus with 1) is disabled. */
  used?: readonly Code[];
  /** Hides the bonus group (e.g. when picking a winning tile). */
  hideBonus?: boolean;
}

/** Tap grid of all tiles grouped by suit; exhausted tiles are disabled (max 4 copies). */
export function TilePicker({ onPick, used = [], hideBonus }: TilePickerProps) {
  const counts = new Map<string, number>();
  for (const c of used) counts.set(c, (counts.get(c) ?? 0) + 1);

  return (
    <div className="flex flex-col gap-4">
      {GROUPS.filter((g) => !(hideBonus && g.id === 'f')).map((group) => (
        <section key={group.id} aria-label={group.title} className="flex flex-col gap-2">
          <h3 className="font-display text-ivory-dim text-base font-black">{group.title}</h3>
          <div className="flex flex-wrap gap-2">
            {group.codes.map((code) => {
              const max = group.id === 'f' ? 1 : MAX_COPIES;
              const exhausted = (counts.get(code) ?? 0) >= max;
              const name = tileName(code);
              return (
                <button
                  key={code}
                  type="button"
                  disabled={exhausted}
                  aria-label={`${name.en} ${name.zh}`}
                  onClick={() => onPick(code)}
                  className="bg-felt-raised focus-visible:ring-ring/60 flex min-h-12 min-w-12 items-center justify-center rounded-md p-1 transition-[transform,opacity,background-color] duration-100 focus-visible:ring-[3px] focus-visible:outline-none active:scale-90 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Tile code={code} size="md" decorative />
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
