export type Suit = 'm' | 'p' | 's';
export type Tile = `${Suit}${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}` | `z${1 | 2 | 3 | 4 | 5 | 6 | 7}`;
export type Bonus = `f${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;
export type Wind = 'E' | 'S' | 'W' | 'N';
export type Seat = 0 | 1 | 2 | 3; // 0 = the seat that started the game as East
