'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { setFlag, type HandDraft, type HandFlag } from '@/lib/game';
import { Button } from '@/components/ui/button';

export interface FlagsPanelProps {
  draft: HandDraft;
  onChange: (draft: HandDraft) => void;
}

interface FlagInfo {
  flag: HandFlag;
  en: string;
  zh: string;
}

const COMMON: readonly FlagInfo[] = [
  { flag: 'lastTile', en: 'Last tile', zh: '海底' },
  { flag: 'kongReplacement', en: 'Kong replacement', zh: '槓上開花' },
];

const RARE: readonly FlagInfo[] = [
  { flag: 'heavenly', en: 'Heavenly hand', zh: '天胡' },
  { flag: 'earthly', en: 'Earthly hand', zh: '地胡' },
  { flag: 'robbingKong', en: 'Robbing a kong', zh: '搶槓' },
];

/** Situational flags; the rare ones sit behind a "More" button (PD-12). */
export function FlagsPanel({ draft, onChange }: FlagsPanelProps) {
  const [showMore, setShowMore] = useState(false);

  const row = ({ flag, en, zh }: FlagInfo) => (
    <li key={flag}>
      <label className="has-[:checked]:bg-green-soft bg-cream-raised has-[:focus-visible]:ring-ring/60 flex min-h-14 cursor-pointer items-center gap-3 rounded-md px-3 text-base transition-colors duration-150 has-[:focus-visible]:ring-[3px]">
        <span className="relative grid size-7 shrink-0 place-items-center">
          <input
            type="checkbox"
            checked={draft.flags[flag] === true}
            onChange={(e) => onChange(setFlag(draft, flag, e.target.checked))}
            className="bg-cream-deep checked:bg-green peer size-7 appearance-none rounded-sm transition-colors duration-150"
          />
          <Check
            aria-hidden="true"
            strokeWidth={4}
            className="text-ivory pointer-events-none absolute size-5 scale-50 opacity-0 transition-[opacity,transform] duration-150 peer-checked:scale-100 peer-checked:opacity-100"
          />
        </span>
        <span>
          {en} <span lang="zh-Hant">{zh}</span>
        </span>
      </label>
    </li>
  );

  return (
    <section aria-label="Situations" className="flex flex-col gap-3">
      <h2 className="font-display text-xl font-black">Situation 情況</h2>
      <ul className="flex flex-col gap-2">{COMMON.map(row)}</ul>
      {showMore ? (
        <ul className="flex flex-col gap-2">{RARE.map(row)}</ul>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowMore(true)}
          className="h-12 self-start px-4 text-base"
        >
          More
        </Button>
      )}
    </section>
  );
}
