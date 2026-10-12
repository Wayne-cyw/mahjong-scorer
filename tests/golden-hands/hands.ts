import { hand, kong, pung } from '@/lib/scoring/hand-test-utils';
import type { Ruleset, SeatContext, WinningHand } from '@/lib/scoring';

/**
 * Golden hands: every expected value below was worked out by hand from the
 * default Hong Kong table in the engineering design, never copied from engine
 * output. Fan lines are [ruleId, fan] in rule-table order.
 */
export interface GoldenHand {
  name: string;
  hand: WinningHand;
  ctx: SeatContext;
  /** Preset id; defaults to the launch preset (3 fan minimum, 10 fan cap, discarder pays). */
  preset?: string;
  overrides?: Partial<Ruleset>;
  expect: {
    valid: boolean;
    reason?: string;
    fan?: number;
    scoredFan?: number;
    lines?: [string, number][];
    payments?: [number, number, number, number];
  };
}

const east: SeatContext = { seatWind: 'E', prevailing: 'E', winner: 0, discarder: 1, dealer: 0 };
const south: SeatContext = { ...east, seatWind: 'S' };
const casual = 'hk-casual';

// f2 belongs to the south seat, so an east winner scores nothing for it.
const h = (concealed: string, o: Parameters<typeof hand>[1] = {}): WinningHand =>
  hand(concealed, { bonus: ['f2'], ...o });

const CHICKEN = h('p4p5p6s7s8s9m3m4m5p9p9', { melds: [pung('m2m2m2', true)] });
const WIND_BASE = 'p4p5p6m3m4m5s7s8s9p9p9';
const PUNGS_ALL = h('s5s5s5p8p8p8m9m9', { melds: [pung('m2m2m2', true), pung('p3p3p3', true)] });
const RED_DRAGON_PUNGS = h('s5s5s5p8p8p8m9m9', {
  melds: [pung('m2m2m2', true), pung('z7z7z7', true)],
  selfDrawn: true,
});
const FOUR_PUNGS = 'm1m1m1p2p2p2s3s3s3z5z5z5p9p9';
const ORDINARY = 'm2m2m2p4p5p6s7s8s9m3m4m5p9p9';

export const GOLDEN_HANDS: GoldenHand[] = [
  // --- single fan rules (casual preset: 1 fan minimum, so each shows alone) ---
  {
    name: 'chicken hand is below a 1 fan minimum',
    hand: CHICKEN,
    ctx: east,
    preset: casual,
    expect: { valid: false, reason: 'below-minimum', fan: 0, lines: [['chicken-hand', 0]] },
  },
  {
    name: 'self-drawn',
    hand: { ...CHICKEN, selfDrawn: true },
    ctx: east,
    preset: casual,
    expect: { valid: true, fan: 1, lines: [['self-drawn', 1]], payments: [3, -1, -1, -1] },
  },
  {
    name: 'concealed hand won on a discard',
    hand: h(ORDINARY),
    ctx: east,
    preset: casual,
    expect: { valid: true, fan: 1, lines: [['concealed-hand', 1]], payments: [2, -2, 0, 0] },
  },
  {
    name: 'no flowers',
    hand: { ...CHICKEN, bonus: [] },
    ctx: east,
    preset: casual,
    expect: { valid: true, fan: 1, lines: [['no-flowers', 1]] },
  },
  {
    name: 'own seat flower and season',
    hand: { ...CHICKEN, bonus: ['f1', 'f5'] },
    ctx: east,
    preset: casual,
    expect: { valid: true, fan: 2, lines: [['own-flower', 2]], payments: [4, -4, 0, 0] },
  },
  {
    name: 'complete set of seasons',
    hand: { ...CHICKEN, bonus: ['f5', 'f6', 'f7', 'f8'] },
    ctx: east,
    preset: casual,
    expect: {
      valid: true,
      fan: 3,
      lines: [
        ['own-flower', 1],
        ['complete-flowers', 2],
      ],
      payments: [8, -8, 0, 0],
    },
  },
  {
    name: 'flowers are ignored when the ruleset does not count them',
    hand: { ...CHICKEN, bonus: [] },
    ctx: east,
    preset: casual,
    overrides: { flowersCount: false },
    expect: { valid: false, reason: 'below-minimum', fan: 0, lines: [['chicken-hand', 0]] },
  },
  {
    name: 'two dragon pungs',
    hand: h('p4p5p6m3m4m5p9p9', { melds: [pung('z5z5z5', true), pung('z7z7z7', true)] }),
    ctx: east,
    preset: casual,
    expect: { valid: true, fan: 2, lines: [['dragon-pung', 2]], payments: [4, -4, 0, 0] },
  },
  {
    name: 'seat wind pung',
    hand: h(WIND_BASE, { melds: [pung('z2z2z2', true)], bonus: ['f3'] }),
    ctx: south,
    preset: casual,
    expect: { valid: true, fan: 1, lines: [['seat-wind', 1]] },
  },
  {
    name: 'prevailing wind pung',
    hand: h(WIND_BASE, { melds: [pung('z1z1z1', true)], bonus: ['f3'] }),
    ctx: south,
    preset: casual,
    expect: { valid: true, fan: 1, lines: [['prevailing-wind', 1]] },
  },
  {
    name: 'east seat in the east round scores both wind fan',
    hand: h(WIND_BASE, { melds: [pung('z1z1z1', true)], bonus: ['f3'] }),
    ctx: east,
    preset: casual,
    expect: {
      valid: true,
      fan: 2,
      lines: [
        ['seat-wind', 1],
        ['prevailing-wind', 1],
      ],
    },
  },
  {
    name: 'all chows',
    hand: h('m1m2m3p4p5p6s7s8s9m4m5m6p2p2'),
    ctx: east,
    preset: casual,
    expect: {
      valid: true,
      fan: 2,
      lines: [
        ['concealed-hand', 1],
        ['all-chows', 1],
      ],
      payments: [4, -4, 0, 0],
    },
  },
  {
    name: 'win on the last tile',
    hand: { ...CHICKEN, flags: { lastTile: true } },
    ctx: east,
    preset: casual,
    expect: { valid: true, fan: 1, lines: [['last-tile', 1]] },
  },
  {
    name: 'win on a kong replacement tile after a kong',
    hand: h('p4p5p6s7s8s9m3m4m5p9p9', {
      melds: [kong('m2m2m2m2', true)],
      selfDrawn: true,
      flags: { kongReplacement: true },
    }),
    ctx: east,
    preset: casual,
    expect: {
      valid: true,
      fan: 2,
      lines: [
        ['self-drawn', 1],
        ['kong-replacement', 1],
      ],
    },
  },
  {
    name: 'robbing a kong',
    hand: { ...CHICKEN, flags: { robbingKong: true } },
    ctx: east,
    preset: casual,
    expect: { valid: true, fan: 1, lines: [['robbing-kong', 1]] },
  },

  // --- pattern fan (launch preset: 3 fan minimum, 10 fan cap) ---
  {
    name: 'all pungs on a discard',
    hand: PUNGS_ALL,
    ctx: east,
    expect: { valid: true, fan: 3, lines: [['all-pungs', 3]], payments: [8, -8, 0, 0] },
  },
  {
    name: 'all pungs self-drawn',
    hand: { ...PUNGS_ALL, selfDrawn: true },
    ctx: east,
    expect: {
      valid: true,
      fan: 4,
      lines: [
        ['self-drawn', 1],
        ['all-pungs', 3],
      ],
      payments: [24, -8, -8, -8],
    },
  },
  {
    name: 'design example: all pungs with red dragon pung, self-drawn (discarder pays)',
    hand: RED_DRAGON_PUNGS,
    ctx: east,
    expect: {
      valid: true,
      fan: 5,
      lines: [
        ['self-drawn', 1],
        ['dragon-pung', 1],
        ['all-pungs', 3],
      ],
      payments: [36, -12, -12, -12],
    },
  },
  {
    name: 'design example under the all-pay model',
    hand: RED_DRAGON_PUNGS,
    ctx: east,
    preset: 'hk-all-pay',
    expect: { valid: true, fan: 5, payments: [72, -24, -24, -24] },
  },
  {
    name: 'mixed one suit with seat and prevailing wind pungs',
    hand: h('m1m2m3m4m5m6m7m8m9z1z1z1z5z5'),
    ctx: east,
    expect: {
      valid: true,
      fan: 6,
      lines: [
        ['concealed-hand', 1],
        ['seat-wind', 1],
        ['prevailing-wind', 1],
        ['mixed-one-suit', 3],
      ],
      payments: [32, -32, 0, 0],
    },
  },
  {
    name: 'mixed one suit for a south seat only gets the prevailing wind',
    hand: h('m1m2m3m4m5m6m7m8m9z1z1z1z5z5', { bonus: ['f3'] }),
    ctx: south,
    expect: {
      valid: true,
      fan: 5,
      lines: [
        ['concealed-hand', 1],
        ['prevailing-wind', 1],
        ['mixed-one-suit', 3],
      ],
      payments: [24, -24, 0, 0],
    },
  },
  {
    name: 'all one suit with all chows, self-drawn',
    hand: h('s1s2s3s4s5s6s7s8s9s2s3s4s6s6', { selfDrawn: true }),
    ctx: east,
    expect: {
      valid: true,
      fan: 9,
      lines: [
        ['self-drawn', 1],
        ['all-chows', 1],
        ['all-one-suit', 7],
      ],
      payments: [144, -48, -48, -48],
    },
  },
  {
    name: 'three pungs or three chows: the pung reading wins and the cap applies',
    hand: h('s1s1s1s2s2s2s3s3s3s4s4s4s5s5', { winningTile: 's1' }),
    ctx: east,
    expect: {
      valid: true,
      fan: 11,
      scoredFan: 10,
      lines: [
        ['concealed-hand', 1],
        ['all-pungs', 3],
        ['all-one-suit', 7],
      ],
      payments: [128, -128, 0, 0],
    },
  },
  {
    name: 'seven pairs when the ruleset allows it',
    hand: h('m1m1m2m2p3p3p4p4s5s5z1z1z5z5'),
    ctx: east,
    overrides: { sevenPairsAllowed: true },
    expect: {
      valid: true,
      fan: 5,
      lines: [
        ['concealed-hand', 1],
        ['seven-pairs', 4],
      ],
      payments: [24, -24, 0, 0],
    },
  },
  {
    name: 'seven pairs is not a winning hand when the ruleset forbids it',
    hand: h('m1m1m2m2p3p3p4p4s5s5z1z1z5z5'),
    ctx: east,
    expect: { valid: false, reason: 'not-a-winning-hand' },
  },
  {
    name: 'small three dragons replaces the dragon pung fan',
    hand: h('z5z5z5z6z6z6z7z7m1m2m3p4p5p6'),
    ctx: east,
    expect: {
      valid: true,
      fan: 6,
      lines: [
        ['concealed-hand', 1],
        ['small-three-dragons', 5],
      ],
      payments: [32, -32, 0, 0],
    },
  },
  {
    name: 'great three dragons replaces the dragon pung fan',
    hand: h('z5z5z5z6z6z6z7z7z7m1m2m3p4p4'),
    ctx: east,
    expect: {
      valid: true,
      fan: 9,
      lines: [
        ['concealed-hand', 1],
        ['great-three-dragons', 8],
      ],
      payments: [96, -96, 0, 0],
    },
  },
  {
    name: 'four concealed pungs won on the pair',
    hand: h(FOUR_PUNGS, { winningTile: 'p9' }),
    ctx: east,
    expect: {
      valid: true,
      fan: 10,
      lines: [
        ['concealed-hand', 1],
        ['dragon-pung', 1],
        ['four-concealed-pungs', 8],
      ],
      payments: [128, -128, 0, 0],
    },
  },
  {
    name: 'a pung completed by a discard is not concealed',
    hand: h(FOUR_PUNGS, { winningTile: 'm1' }),
    ctx: east,
    expect: {
      valid: true,
      fan: 5,
      lines: [
        ['concealed-hand', 1],
        ['dragon-pung', 1],
        ['all-pungs', 3],
      ],
      payments: [24, -24, 0, 0],
    },
  },
  {
    name: 'four concealed pungs self-drawn',
    hand: h(FOUR_PUNGS, { winningTile: 'm1', selfDrawn: true }),
    ctx: east,
    expect: {
      valid: true,
      fan: 10,
      lines: [
        ['self-drawn', 1],
        ['dragon-pung', 1],
        ['four-concealed-pungs', 8],
      ],
      payments: [192, -64, -64, -64],
    },
  },

  // --- limit hands: score the cap and skip every other fan ---
  {
    name: 'small four winds',
    hand: h('z1z1z1z2z2z2z3z3z3z4z4m1m2m3'),
    ctx: east,
    expect: {
      valid: true,
      fan: 10,
      lines: [['small-four-winds', 10]],
      payments: [128, -128, 0, 0],
    },
  },
  {
    name: 'great four winds',
    hand: h('z1z1z1z2z2z2z3z3z3z4z4z4m1m1'),
    ctx: east,
    expect: { valid: true, fan: 10, lines: [['great-four-winds', 10]] },
  },
  {
    name: 'two limit patterns at once list only one limit line',
    hand: h('z1z1z1z2z2z2z3z3z3z4z4z4z5z5'),
    ctx: east,
    expect: {
      valid: true,
      fan: 10,
      lines: [['great-four-winds', 10]],
      payments: [128, -128, 0, 0],
    },
  },
  {
    name: 'all honours',
    hand: h('z1z1z1z2z2z2z3z3z3z5z5z5z6z6'),
    ctx: east,
    expect: { valid: true, fan: 10, lines: [['all-honours', 10]] },
  },
  {
    name: 'all terminals',
    hand: h('m1m1m1m9m9m9p1p1p1p9p9p9s1s1'),
    ctx: east,
    expect: { valid: true, fan: 10, lines: [['all-terminals', 10]] },
  },
  {
    name: 'nine gates',
    hand: h('m1m1m1m2m3m4m5m5m6m7m8m9m9m9'),
    ctx: east,
    expect: { valid: true, fan: 10, lines: [['nine-gates', 10]] },
  },
  {
    name: 'thirteen orphans',
    hand: h('m1m9p1p9s1s9z1z2z3z4z5z6z7z7'),
    ctx: east,
    expect: { valid: true, fan: 10, lines: [['thirteen-orphans', 10]] },
  },
  {
    name: 'thirteen orphans self-drawn under the all-pay model',
    hand: h('m1m9p1p9s1s9z1z2z3z4z5z6z7z7', { selfDrawn: true }),
    ctx: east,
    preset: 'hk-all-pay',
    expect: { valid: true, fan: 10, payments: [384, -128, -128, -128] },
  },
  {
    name: 'four kongs',
    hand: h('p9p9', {
      melds: [kong('m1m1m1m1'), kong('p2p2p2p2'), kong('s3s3s3s3'), kong('z5z5z5z5')],
    }),
    ctx: east,
    expect: { valid: true, fan: 10, lines: [['four-kongs', 10]] },
  },
  {
    name: 'heavenly hand skips every other fan',
    hand: h(ORDINARY, { selfDrawn: true, flags: { heavenly: true } }),
    ctx: east,
    expect: {
      valid: true,
      fan: 10,
      lines: [['heavenly', 10]],
      payments: [192, -64, -64, -64],
    },
  },
  {
    name: 'earthly hand for a non-dealer',
    hand: h(ORDINARY, { flags: { earthly: true } }),
    ctx: { seatWind: 'S', prevailing: 'E', winner: 1, discarder: 0, dealer: 0 },
    expect: { valid: true, fan: 10, lines: [['earthly', 10]], payments: [-128, 128, 0, 0] },
  },

  // --- minimum, cap, payments and invalid hands ---
  {
    name: 'two fan is below the launch preset minimum',
    hand: h('m1m2m3p4p5p6s7s8s9m4m5m6p2p2', { selfDrawn: true }),
    ctx: east,
    expect: {
      valid: false,
      reason: 'below-minimum',
      fan: 2,
      lines: [
        ['self-drawn', 1],
        ['all-chows', 1],
      ],
      payments: [0, 0, 0, 0],
    },
  },
  {
    name: 'exactly the minimum of three fan is valid',
    hand: { ...CHICKEN, selfDrawn: true, bonus: ['f1', 'f5'] },
    ctx: east,
    expect: {
      valid: true,
      fan: 3,
      lines: [
        ['self-drawn', 1],
        ['own-flower', 2],
      ],
      payments: [12, -4, -4, -4],
    },
  },
  {
    name: 'ten fan is capped to eight under the casual preset',
    hand: h(FOUR_PUNGS, { winningTile: 'm1', selfDrawn: true }),
    ctx: east,
    preset: casual,
    expect: { valid: true, fan: 10, scoredFan: 8, payments: [96, -32, -32, -32] },
  },
  {
    name: 'all-pay: the discarder pays double the other two',
    hand: PUNGS_ALL,
    ctx: { ...east, discarder: 2 },
    preset: 'hk-all-pay',
    expect: { valid: true, fan: 3, payments: [16, -4, -8, -4] },
  },
  {
    name: 'a non-dealer winner collects from the discarder',
    hand: h(WIND_BASE, { melds: [pung('z3z3z3', true)] }),
    ctx: { seatWind: 'W', prevailing: 'E', winner: 2, discarder: 3, dealer: 0 },
    preset: casual,
    expect: { valid: true, fan: 1, lines: [['seat-wind', 1]], payments: [0, 0, 2, -2] },
  },
  {
    name: 'tiles that do not form sets',
    hand: h('m1m3m5p2p4p6s1s3s5z1z2z3z4z5'),
    ctx: east,
    expect: { valid: false, reason: 'not-a-winning-hand' },
  },
  {
    name: 'a fifth copy of a tile',
    hand: h('m1m1p4p5p6s7s8s9m3m4m5p9p9', { melds: [pung('m1m1m1', true)] }),
    ctx: east,
    expect: { valid: false, reason: 'too-many-copies' },
  },
  {
    name: 'thirteen tiles',
    hand: h('m1m2m3p4p5p6s7s8s9m4m5m6p2'),
    ctx: east,
    expect: { valid: false, reason: 'wrong-tile-count' },
  },
];
