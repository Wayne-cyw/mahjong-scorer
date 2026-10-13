'use client';

import { useState } from 'react';
import type { Meld } from '@/lib/scoring';
import type { Bonus, Tile as TileCode } from '@/lib/tiles';
import { isBonus, tileName } from '@/lib/tiles';
import { addMeld, removeMeld, toggleMeldExposed, type HandDraft } from '@/lib/game';
import { Button } from '@/components/ui/button';
import { Tile } from '@/components/tiles/tile';
import { TilePicker } from '@/components/tiles/tile-picker';

export interface MeldEditorProps {
  draft: HandDraft;
  onChange: (draft: HandDraft) => void;
  /** `"<meld index>:<tile index>"` positions the photo reader was unsure of. */
  uncertain?: ReadonlySet<string>;
}

type Kind = Meld['kind'];

const KIND_LABEL: Record<Kind, string> = {
  chow: 'Chow 上',
  pung: 'Pung 碰',
  kong: 'Kong 槓',
};

/** A chow starting at `tile` (lowest number), or null if one cannot start there. */
function chowFrom(tile: TileCode): TileCode[] | null {
  const suit = tile[0];
  const n = Number(tile[1]);
  if (suit === 'z' || n > 7) return null;
  return [tile, `${suit}${n + 1}` as TileCode, `${suit}${n + 2}` as TileCode];
}

function meldTiles(kind: Kind, tile: TileCode): TileCode[] | null {
  if (kind === 'chow') return chowFrom(tile);
  return Array.from({ length: kind === 'kong' ? 4 : 3 }, () => tile);
}

const meldName = (meld: Meld): string =>
  `${KIND_LABEL[meld.kind].split(' ')[0]} ${meld.tiles.map((t) => tileName(t).en).join(', ')}`;

/**
 * Declared melds and kongs: add one by choosing its kind and tapping its tile (for a chow, the
 * lowest tile), flip exposed/concealed (matters for kong scoring), or remove it.
 */
export function MeldEditor({ draft, onChange, uncertain }: MeldEditorProps) {
  const [adding, setAdding] = useState<Kind | null>(null);

  const pick = (code: TileCode | Bonus): void => {
    if (adding === null || isBonus(code)) return;
    const tiles = meldTiles(adding, code);
    if (!tiles) return;
    const next = addMeld(draft, { kind: adding, tiles, exposed: true });
    if (next !== draft) {
      onChange(next);
      setAdding(null);
    }
  };

  return (
    <section aria-label="Melds" className="flex flex-col gap-3">
      <h2 className="font-display text-xl font-black">Melds and kongs 碰槓</h2>
      {draft.melds.length > 0 && (
        <ul className="flex flex-col gap-2">
          {draft.melds.map((meld, i) => (
            <li
              key={`${meld.kind}-${meld.tiles.join('')}-${i}`}
              className="bg-felt-raised flex flex-wrap items-center gap-2 rounded-md p-2"
            >
              <span
                className="flex gap-1"
                role="img"
                aria-label={`${meldName(meld)}${
                  meld.tiles.some((_, j) => uncertain?.has(`${i}:${j}`)) ? ' (hard to read)' : ''
                }`}
              >
                {meld.tiles.map((t, j) => (
                  <Tile
                    key={j}
                    code={t}
                    size="sm"
                    state={uncertain?.has(`${i}:${j}`) ? 'uncertain' : 'normal'}
                    decorative
                  />
                ))}
              </span>
              <Button
                type="button"
                variant="outline"
                aria-pressed={meld.exposed}
                aria-label={`${meldName(meld)}: ${meld.exposed ? 'exposed' : 'concealed'}`}
                onClick={() => onChange(toggleMeldExposed(draft, i))}
                className="h-12 px-3 text-sm"
              >
                {meld.exposed ? 'Exposed' : 'Concealed'}
              </Button>
              <Button
                type="button"
                variant="outline"
                aria-label={`Remove ${meldName(meld)}`}
                onClick={() => onChange(removeMeld(draft, i))}
                className="h-12 px-3 text-sm"
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Add a meld">
        {(Object.keys(KIND_LABEL) as Kind[]).map((kind) => (
          <Button
            key={kind}
            type="button"
            variant={adding === kind ? 'default' : 'outline'}
            aria-pressed={adding === kind}
            onClick={() => setAdding(adding === kind ? null : kind)}
            className="h-12 px-3 text-sm"
          >
            Add {KIND_LABEL[kind]}
          </Button>
        ))}
      </div>

      {adding !== null && (
        <div className="flex flex-col gap-2">
          <p className="text-ivory-dim text-base">
            {adding === 'chow' ? 'Tap the lowest tile of the chow.' : 'Tap the tile to meld.'}
          </p>
          <TilePicker hideBonus onPick={pick} />
        </div>
      )}
    </section>
  );
}
