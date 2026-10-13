import { cn } from '@/lib/utils';

export type SetupStep = 'players' | 'preset' | 'dealer';

const STEPS: readonly { id: SetupStep; glyph: string; label: string }[] = [
  { id: 'players', glyph: '人', label: 'Players' },
  { id: 'preset', glyph: '規', label: 'Rules' },
  { id: 'dealer', glyph: '莊', label: 'Dealer' },
];

/** Where the table is in setup, shown as three tiles that light as each step is reached. */
export function StepTrail({ current }: { current: SetupStep }) {
  const at = STEPS.findIndex((s) => s.id === current);
  return (
    <ol aria-label="Setup progress" className="flex gap-2">
      {STEPS.map((step, i) => (
        <li
          key={step.id}
          aria-current={i === at ? 'step' : undefined}
          aria-label={`${step.label}${i < at ? ', done' : i === at ? ', current' : ''}`}
          className={cn(
            'font-display flex h-14 flex-1 items-center justify-center rounded-md border-b-4 text-3xl leading-none font-black transition-[background-color,color,transform] duration-300',
            i === at && 'bg-sign border-sign-deep text-primary-foreground -translate-y-0.5',
            i < at && 'bg-ivory text-lacquer border-[#b9b39a]',
            i > at && 'bg-felt-raised border-felt-deep text-ivory-dim',
          )}
        >
          <span aria-hidden="true">{step.glyph}</span>
        </li>
      ))}
    </ol>
  );
}
