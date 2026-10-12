import type { Bonus, Seat, Tile, Wind } from '@/lib/tiles';

export interface Meld {
  kind: 'chow' | 'pung' | 'kong';
  tiles: Tile[];
  exposed: boolean; // a kong with exposed=false is a concealed kong
}

export interface WinningHand {
  concealed: Tile[]; // includes the winning tile
  melds: Meld[]; // declared melds and kongs
  bonus: Bonus[];
  winningTile: Tile;
  selfDrawn: boolean;
  flags: {
    lastTile?: boolean;
    kongReplacement?: boolean;
    robbingKong?: boolean;
    heavenly?: boolean;
    earthly?: boolean;
  };
}

export interface FanLine {
  ruleId: string;
  nameEn: string;
  nameZh: string;
  fan: number;
}

export interface SeatContext {
  seatWind: Wind;
  prevailing: Wind;
  winner: Seat;
  discarder?: Seat;
  dealer: Seat;
}

export type Reading =
  { sets: Meld[]; pair: Tile } | { special: 'seven-pairs' | 'thirteen-orphans' };

export interface ScoreResult {
  valid: boolean;
  reason?: 'too-many-copies' | 'wrong-tile-count' | 'not-a-winning-hand' | 'below-minimum';
  fan: number; // before the cap
  scoredFan: number; // after the cap
  breakdown: FanLine[];
  basePoints: number;
  payments: [number, number, number, number]; // sums to 0
  reading: Reading;
}
