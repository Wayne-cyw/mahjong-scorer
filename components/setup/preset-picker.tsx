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
      <legend className="font-display mb-3 text-xl font-black">Rules</legend>
      {presets.map((preset) => (
        <label
          key={preset.id}
          className="bg-felt-raised border-felt-deep has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:checked]:border-sign-deep has-[:focus-visible]:ring-ring/60 flex min-h-16 cursor-pointer items-center gap-4 rounded-md border-b-4 px-4 transition-[background-color,color,transform] duration-200 has-[:checked]:-translate-y-0.5 has-[:focus-visible]:ring-[3px]"
        >
          <input
            type="radio"
            name="preset"
            value={preset.id}
            checked={selectedId === preset.id}
            onChange={() => onSelect(preset.id)}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="border-ivory-dim grid size-7 shrink-0 place-items-center rounded-full border-4 peer-checked:border-[#1b1403] peer-checked:bg-[#1b1403]"
          />
          <span className="font-display text-lg leading-snug font-black">{preset.name}</span>
        </label>
      ))}
    </fieldset>
  );
}
