import Dexie, { type Table } from 'dexie';
import type { GameState, StoredEvent } from '@/lib/game';

/** One row in the `games` table: the game's identity and lifecycle status. */
export interface GameRow {
  id: string;
  createdAt: number;
  status: GameState['status'];
  name?: string;
}

/** One row in the `players` table: a saved player for quick re-entry across games. */
export interface PlayerRow {
  id: string;
  name: string;
}

/** One row in the `settings` table: a single arbitrary keyed value. */
export interface SettingRow {
  key: string;
  value: unknown;
}

/** Thrown when an `appendEvent` loses the race for a `[gameId+seq]` slot (ADR-55). */
export class DuplicateSeqError extends Error {
  constructor(gameId: string, seq: number) {
    super(`Duplicate seq ${seq} for game ${gameId}`);
    this.name = 'DuplicateSeqError';
  }
}

/**
 * The Dexie database: the event log is the only source of truth (see CLAUDE.md).
 * Schema matches the spec's Dexie block exactly (Domain model and data schema).
 */
export class MahjongDb extends Dexie {
  games!: Table<GameRow, string>;
  // Primary key is the compound [gameId+seq]; StoredEvent carries both fields.
  events!: Table<StoredEvent, [string, number]>;
  players!: Table<PlayerRow, string>;
  settings!: Table<SettingRow, string>;

  constructor() {
    super('mahjong-db');
    this.version(1).stores({
      games: 'id, createdAt, status',
      events: '[gameId+seq], gameId, type',
      players: 'id, name',
      settings: 'key',
    });
  }
}

let dbInstance: MahjongDb | undefined;

/**
 * Lazily constructs the Dexie database on first use. Never opens IndexedDB at
 * import time, so this module is safe to import in a server (SSR) context
 * that has no `indexedDB` global.
 */
export function getDb(): MahjongDb {
  dbInstance ??= new MahjongDb();
  return dbInstance;
}
