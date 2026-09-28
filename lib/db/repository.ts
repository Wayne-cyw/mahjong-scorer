import Dexie from 'dexie';
import { parseStoredEvent } from '@/lib/game';
import type { GameEvent, StoredEvent } from '@/lib/game';
import { DuplicateSeqError, getDb, type GameRow, type PlayerRow } from './db';

/** Creates a new game row (status `setup`) and returns its id. */
export async function createGame(id?: string): Promise<string> {
  const db = getDb();
  const gameId = id ?? crypto.randomUUID();
  const row: GameRow = { id: gameId, createdAt: Date.now(), status: 'setup' };
  await db.games.add(row);
  return gameId;
}

/**
 * Appends one event to a game's log in a single IndexedDB transaction: reads
 * the highest existing `seq` for the game and writes `seq + 1`. If another
 * writer (e.g. a second tab) wins the race for the same `[gameId+seq]` slot,
 * this throws `DuplicateSeqError` instead of corrupting the log (ADR-54, ADR-55).
 */
export async function appendEvent(gameId: string, payload: GameEvent): Promise<StoredEvent> {
  const db = getDb();
  return db.transaction('rw', db.events, async () => {
    const lastEvent = await db.events.where('gameId').equals(gameId).last();
    const seq = lastEvent ? lastEvent.seq + 1 : 0;
    const event: StoredEvent = {
      id: crypto.randomUUID(),
      gameId,
      seq,
      v: 1,
      at: Date.now(),
      payload,
    };
    try {
      await db.events.add(event);
    } catch (error) {
      if (error instanceof Dexie.ConstraintError) {
        throw new DuplicateSeqError(gameId, seq);
      }
      throw error;
    }
    return event;
  });
}

/** Loads a game's full event log in `seq` order, parsing every row with Zod. */
export async function loadEvents(gameId: string): Promise<StoredEvent[]> {
  const db = getDb();
  const rows = await db.events.where('gameId').equals(gameId).sortBy('seq');
  return rows.map((row) => parseStoredEvent(row));
}

/** Lists every game, newest first. */
export async function listGames(): Promise<GameRow[]> {
  const db = getDb();
  const rows = await db.games.toArray();
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

/** Updates a game's lifecycle status. */
export async function setGameStatus(gameId: string, status: GameRow['status']): Promise<void> {
  const db = getDb();
  await db.games.update(gameId, { status });
}

/** Saves a player by name, reusing an existing row with the same (trimmed) name. */
export async function savePlayer(name: string): Promise<PlayerRow> {
  const db = getDb();
  const trimmed = name.trim();
  const existing = await db.players.where('name').equals(trimmed).first();
  if (existing) return existing;
  const row: PlayerRow = { id: crypto.randomUUID(), name: trimmed };
  await db.players.add(row);
  return row;
}

/** Lists saved players, alphabetically by name. */
export async function listPlayers(): Promise<PlayerRow[]> {
  const db = getDb();
  return db.players.orderBy('name').toArray();
}

/** Reads one setting value, or `undefined` when unset. */
export async function getSetting<T>(key: string): Promise<T | undefined> {
  const db = getDb();
  const row = await db.settings.get(key);
  return row?.value as T | undefined;
}

/** Writes one setting value. */
export async function setSetting<T>(key: string, value: T): Promise<void> {
  const db = getDb();
  await db.settings.put({ key, value });
}

/**
 * Requests persistent storage so the browser is less likely to evict game
 * history (ADR-52). Resolves `false`, never throws, when the API is missing
 * or the request fails for any reason.
 */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
