'use client';

import { useState } from 'react';
import { useGameStore } from '@/stores/game-store';
import type { HandRecord, HandWonPayload } from '@/lib/game';
import { seatNames as buildSeatNames } from '@/components/table/seat-names';
import { WIND_LABEL } from '@/components/table/seat-card';
import { Button } from '@/components/ui/button';
import { EditHandSheet, type EditMode } from './edit-hand-sheet';

export interface HandListProps {
  /** Display name for each player, keyed by player id. */
  playerNames?: Record<string, string>;
}

interface Pending {
  mode: EditMode;
  id: string;
}

/**
 * Effective hands in play order (voided hands are already dropped), each with
 * Undo and, for wins, Edit. Both go through `EditHandSheet`, which previews the
 * change and warns before the store appends a `HandVoided`/`HandCorrected` event.
 */
export function HandList({ playerNames = {} }: HandListProps) {
  const events = useGameStore((s) => s.events);
  const history = useGameStore((s) => s.history);
  const state = useGameStore((s) => s.state);
  const voidHand = useGameStore((s) => s.voidHand);
  const correctHand = useGameStore((s) => s.correctHand);
  const [pending, setPending] = useState<Pending | null>(null);

  const names = buildSeatNames(state.seatOf, playerNames);
  const ruleset = state.ruleset;

  if (history.length === 0) {
    return <p className="text-muted-foreground">No hands yet.</p>;
  }

  const describe = (record: HandRecord): string => {
    if (record.kind === 'draw') return 'Draw (流局)';
    const winner = names[record.winner ?? 0];
    const how = record.discarder === undefined ? 'self-drawn' : `off ${names[record.discarder]}`;
    return `${winner} won ${record.fan} fan, ${how}`;
  };

  const confirm = async (replacement: HandWonPayload | null): Promise<void> => {
    if (!pending) return;
    try {
      if (replacement === null) await voidHand(pending.id);
      else await correctHand(pending.id, replacement);
      setPending(null);
    } catch {
      // The store records the failure in `error`; keep the sheet open so the user can retry.
    }
  };

  return (
    <ol className="flex flex-col gap-3">
      {history.map((record, index) => {
        const wind = WIND_LABEL[record.prevailingBefore];
        const active = pending?.id === record.id ? pending : null;
        return (
          <li key={record.id} className="border-border flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-muted-foreground text-sm">
                  Hand {index + 1} · {wind.en} ({wind.zh}) · dealer {names[record.dealerBefore]}
                </p>
                <p className="text-lg font-semibold">{describe(record)}</p>
              </div>
              {!active && (
                <div className="flex gap-2">
                  {record.kind === 'win' && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPending({ mode: 'edit', id: record.id })}
                      className="h-12 px-4 text-base"
                    >
                      Edit
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPending({ mode: 'undo', id: record.id })}
                    className="h-12 px-4 text-base"
                  >
                    Undo
                  </Button>
                </div>
              )}
            </div>
            {active && ruleset && (
              <EditHandSheet
                mode={active.mode}
                record={record}
                events={events}
                ruleset={ruleset}
                seatNames={names}
                onCancel={() => setPending(null)}
                onConfirm={confirm}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
