'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Seat } from '@/lib/tiles';
import { DEFAULT_PRESET_ID, PRESETS } from '@/lib/scoring';
import { listPlayers } from '@/lib/db';
import { useGameStore } from '@/stores/game-store';
import { PlayerFields, shuffle } from '@/components/setup/player-fields';
import { PresetPicker } from '@/components/setup/preset-picker';
import { FirstDealer } from '@/components/setup/first-dealer';

type Step = 'players' | 'preset' | 'dealer';

/** Trims every name and reports the first problem, or `null` when all four are usable. */
function validateNames(names: readonly string[]): string | null {
  const trimmed = names.map((n) => n.trim());
  if (trimmed.some((n) => n.length === 0)) return 'Enter a name for every seat.';
  if (new Set(trimmed).size !== trimmed.length) return 'Names must be different.';
  return null;
}

/** The `/setup` flow: players (seat order + shuffle), preset, then first dealer (PD-01–05). */
export function SetupClient() {
  const router = useRouter();
  const createGame = useGameStore((s) => s.createGame);
  const assignSeats = useGameStore((s) => s.assignSeats);
  const chooseFirstDealer = useGameStore((s) => s.chooseFirstDealer);

  const [step, setStep] = useState<Step>('players');
  const [names, setNames] = useState<string[]>(['', '', '', '']);
  const [presetId, setPresetId] = useState<string>(DEFAULT_PRESET_ID);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listPlayers()
      .then((players) => {
        if (!cancelled) setSuggestions(players.map((p) => p.name));
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleNameChange(seat: Seat, value: string): void {
    setNames((prev) => {
      const next = [...prev];
      next[seat] = value;
      return next;
    });
  }

  function handleShuffle(): void {
    setNames((prev) => shuffle(prev));
  }

  function handlePlayersNext(): void {
    const error = validateNames(names);
    setValidationError(error);
    if (error) return;
    setNames((prev) => prev.map((n) => n.trim()));
    setStep('preset');
  }

  async function handleFirstDealerChosen(seat: Seat): Promise<void> {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const gameId = await createGame({ playerNames: names, presetId });
      const playerIds = useGameStore.getState().state.playerIds;
      const seatOf: Record<string, Seat> = {};
      playerIds.forEach((id, i) => {
        seatOf[id] = i as Seat;
      });
      await assignSeats(seatOf);
      await chooseFirstDealer(seat);
      router.push(`/game/${gameId}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : String(error));
      setSubmitting(false);
    }
  }

  const dealerPlayers = names.map((name, seat) => ({ seat: seat as Seat, name }));

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">New game</h1>

      {step === 'players' && (
        <>
          <PlayerFields
            names={names}
            onNameChange={handleNameChange}
            onShuffle={handleShuffle}
            suggestions={suggestions}
          />
          {validationError && (
            <p role="alert" className="text-red-600">
              {validationError}
            </p>
          )}
          <button
            type="button"
            onClick={handlePlayersNext}
            className="min-h-12 rounded bg-neutral-900 px-4 font-medium text-white"
          >
            Next: rules
          </button>
        </>
      )}

      {step === 'preset' && (
        <>
          <PresetPicker presets={PRESETS} selectedId={presetId} onSelect={setPresetId} />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep('players')}
              className="min-h-12 rounded border border-neutral-500 px-4 font-medium"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep('dealer')}
              className="min-h-12 rounded bg-neutral-900 px-4 font-medium text-white"
            >
              Next: first dealer
            </button>
          </div>
        </>
      )}

      {step === 'dealer' && (
        <>
          <FirstDealer
            players={dealerPlayers}
            onChosen={handleFirstDealerChosen}
            disabled={submitting}
          />
          {submitError && (
            <p role="alert" className="text-red-600">
              {submitError}
            </p>
          )}
          <button
            type="button"
            onClick={() => setStep('preset')}
            disabled={submitting}
            className="min-h-12 rounded border border-neutral-500 px-4 font-medium disabled:opacity-50"
          >
            Back
          </button>
        </>
      )}
    </main>
  );
}
