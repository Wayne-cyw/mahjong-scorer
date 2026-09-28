import type { Ruleset } from '@/lib/scoring';

export interface PresetPickerProps {
  /** Exactly the three named presets (PD-01/02) — no free-form ruleset editing. */
  presets: readonly Ruleset[];
  selectedId: string;
  onSelect: (id: string) => void;
}

/** A picker over named ruleset presets; no field lets the player edit a ruleset directly. */
export function PresetPicker({ presets, selectedId, onSelect }: PresetPickerProps) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-lg font-semibold">Rules</legend>
      {presets.map((preset) => (
        <label
          key={preset.id}
          className="flex min-h-12 items-center gap-3 rounded border border-neutral-400 px-3"
        >
          <input
            type="radio"
            name="preset"
            value={preset.id}
            checked={selectedId === preset.id}
            onChange={() => onSelect(preset.id)}
            className="h-5 w-5"
          />
          <span className="font-medium">{preset.name}</span>
        </label>
      ))}
    </fieldset>
  );
}
