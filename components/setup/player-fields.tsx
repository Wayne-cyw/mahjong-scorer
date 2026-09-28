import type { Seat } from '@/lib/tiles';

const SEATS: readonly Seat[] = [0, 1, 2, 3];

export interface PlayerFieldsProps {
  /** Names in seat order: `names[seat]` is the player sitting seat `seat`. */
  names: readonly string[];
  onNameChange: (seat: Seat, value: string) => void;
  onShuffle: () => void;
  /** Saved-player names offered as autocomplete suggestions (PD-03). */
  suggestions?: readonly string[];
}

/** Four name fields in seat order, with saved-player suggestions and a shuffle control (PD-03/04). */
export function PlayerFields({
  names,
  onNameChange,
  onShuffle,
  suggestions = [],
}: PlayerFieldsProps) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="text-lg font-semibold">Players</legend>
      {SEATS.map((seat) => (
        <div key={seat} className="flex flex-col gap-1">
          <label htmlFor={`player-${seat}`} className="text-sm font-medium">
            Seat {seat + 1}
          </label>
          <input
            id={`player-${seat}`}
            name={`player-${seat}`}
            type="text"
            list="saved-players"
            autoComplete="off"
            value={names[seat] ?? ''}
            onChange={(event) => onNameChange(seat, event.target.value)}
            placeholder={`Player ${seat + 1}`}
            className="min-h-12 rounded border border-neutral-400 px-3 text-base"
          />
        </div>
      ))}
      <datalist id="saved-players">
        {suggestions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <button
        type="button"
        onClick={onShuffle}
        className="min-h-12 rounded border border-neutral-500 px-4 font-medium"
      >
        Shuffle seats
      </button>
    </fieldset>
  );
}

/**
 * Fisher-Yates shuffle of `items`, keeping the same elements and only reordering them.
 * `random` is a parameter (ADR-62 style) so tests can supply a deterministic source.
 */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = result[i]!;
    const b = result[j]!;
    result[i] = b;
    result[j] = a;
  }
  return result;
}
