'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Seat } from '@/lib/tiles';
import { DEFAULT_PRESET_ID, PRESETS } from '@/lib/scoring';
import { listPlayers } from '@/lib/db';
import { useGameStore } from '@/stores/game-store';
import { Screen } from '@/components/hk/screen';
import { Button } from '@/components/ui/button';
import { PlayerFields, shuffle } from '@/components/setup/player-fields';
import { StepTrail } from '@/components/setup/step-trail';
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

  const alert = (message: string) => (
    <p role="alert" className="bg-lacquer text-ivory rounded-md p-3 font-medium">
      {message}
    </p>
  );

  return (
    <Screen title="New game" glyph="開">
      <StepTrail current={step} />

      {step === 'players' && (
        <>
          <PlayerFields
            names={names}
            onNameChange={handleNameChange}
            onShuffle={handleShuffle}
            suggestions={suggestions}
          />
          {validationError && alert(validationError)}
          <Button type="button" onClick={handlePlayersNext} className="h-14 px-4 text-lg">
            Next: rules
          </Button>
        </>
      )}

      {step === 'preset' && (
        <>
          <PresetPicker presets={PRESETS} selectedId={presetId} onSelect={setPresetId} />
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep('players')}
              className="h-14 px-5 text-lg"
            >
              Back
            </Button>
            <Button
              type="button"
              onClick={() => setStep('dealer')}
              className="h-14 flex-1 px-4 text-lg"
            >
              Next: first dealer
            </Button>
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
          {submitError && alert(submitError)}
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep('preset')}
            disabled={submitting}
            className="h-14 px-5 text-lg"
          >
            Back
          </Button>
        </>
      )}
    </Screen>
  );
}
