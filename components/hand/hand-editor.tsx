'use client';

import { useState } from 'react';
import type { Bonus, Tile as TileCode } from '@/lib/tiles';
import { tileName } from '@/lib/tiles';
import { addTile, removeTile, setWinningTile, type HandDraft } from '@/lib/game';
import { Button } from '@/components/ui/button';
import { Tile } from '@/components/tiles/tile';
import { TilePicker } from '@/components/tiles/tile-picker';

export interface HandEditorProps {
  draft: HandDraft;
  onChange: (draft: HandDraft) => void;
  /** Positions the photo reader was unsure of, shown with the uncertain highlight. */
  uncertain?: { concealed: ReadonlySet<number>; bonus: ReadonlySet<number> };
}

type TapMode = 'winning' | 'remove';

const label = (code: TileCode | Bonus): string => {
  const n = tileName(code);
  return `${n.en} ${n.zh}`;
};

/**
 * Edits the concealed tiles and bonus tiles of a draft: tap a tile in the picker to add it, then
 * tap a tile in the hand to mark it as the winning tile (or remove it, in remove mode).
 */
export function HandEditor({ draft, onChange, uncertain }: HandEditorProps) {
  const [mode, setMode] = useState<TapMode>('winning');

  const used: (TileCode | Bonus)[] = [
    ...draft.concealed,
    ...draft.melds.flatMap((m) => m.tiles),
    ...draft.bonus,
  ];

  return (
    <section aria-label="Hand" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Your tiles 手牌</h2>
          <div className="flex gap-2" role="group" aria-label="Tap a tile to">
            <Button
              type="button"
              variant={mode === 'winning' ? 'default' : 'outline'}
              aria-pressed={mode === 'winning'}
              onClick={() => setMode('winning')}
              className="h-12 px-3 text-sm"
            >
              Mark winning
            </Button>
            <Button
              type="button"
              variant={mode === 'remove' ? 'default' : 'outline'}
              aria-pressed={mode === 'remove'}
              onClick={() => setMode('remove')}
              className="h-12 px-3 text-sm"
            >
              Remove
            </Button>
          </div>
        </div>
        {draft.concealed.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No tiles yet. Tap tiles below to add them.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {draft.concealed.map((code, i) => {
              const isWinning = draft.winningTile === code;
              const action = mode === 'remove' ? 'Remove' : 'Mark';
              const name =
                mode === 'remove'
                  ? `Remove ${label(code)}`
                  : `${action} ${label(code)} as winning tile`;
              return (
                <li key={`${code}-${i}`}>
                  <button
                    type="button"
                    aria-label={name}
                    aria-pressed={mode === 'winning' ? isWinning : undefined}
                    onClick={() =>
                      onChange(
                        mode === 'remove'
                          ? removeTile(draft, code)
                          : setWinningTile(draft, isWinning ? null : code),
                      )
                    }
                    className="focus-visible:ring-ring/50 flex min-h-12 min-w-12 items-center justify-center rounded-md p-1 focus-visible:ring-[3px] focus-visible:outline-none"
                  >
                    <Tile
                      code={code}
                      size="md"
                      state={
                        isWinning
                          ? 'selected'
                          : uncertain?.concealed.has(i)
                            ? 'uncertain'
                            : 'normal'
                      }
                      decorative
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {draft.winningTile && <p className="text-sm">Winning tile: {label(draft.winningTile)}</p>}
      </div>

      {draft.bonus.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-muted-foreground text-sm font-medium">Flowers and seasons 花</h3>
          <ul className="flex flex-wrap gap-2">
            {draft.bonus.map((code, i) => (
              <li key={code}>
                <button
                  type="button"
                  aria-label={`Remove ${label(code)}`}
                  onClick={() => onChange(removeTile(draft, code))}
                  className="focus-visible:ring-ring/50 flex min-h-12 min-w-12 items-center justify-center rounded-md p-1 focus-visible:ring-[3px] focus-visible:outline-none"
                >
                  <Tile
                    code={code}
                    size="md"
                    state={uncertain?.bonus.has(i) ? 'uncertain' : 'normal'}
                    decorative
                  />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">Add a tile</h3>
        <TilePicker used={used} onPick={(code) => onChange(addTile(draft, code))} />
      </div>
    </section>
  );
}
