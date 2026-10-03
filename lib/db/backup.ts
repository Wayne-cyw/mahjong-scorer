import { z } from 'zod';
import { storedEventSchema } from '@/lib/game';
import { getDb, type GameRow, type PlayerRow } from './db';

/** Backups over this size are rejected outright, before any JSON parsing (Review Focus 5). */
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

const gameRowSchema: z.ZodType<GameRow> = z.object({
  id: z.string().min(1),
  createdAt: z.number(),
  status: z.enum(['setup', 'playing', 'complete', 'ended']),
  name: z.string().optional(),
});

const playerRowSchema: z.ZodType<PlayerRow> = z.object({
  id: z.string().min(1),
  name: z.string(),
});

/** The full shape of one exported backup file: every game, event and player. */
const backupPayloadSchema = z.object({
  version: z.literal(1),
  exportedAt: z.number(),
  games: z.array(gameRowSchema),
  events: z.array(storedEventSchema),
  players: z.array(playerRowSchema),
});

type BackupPayload = z.infer<typeof backupPayloadSchema>;

/** Writes every game, event and player to one JSON string (ADR-53). */
export async function exportBackup(): Promise<string> {
  const db = getDb();
  const [games, events, players] = await Promise.all([
    db.games.toArray(),
    db.events.toArray(),
    db.players.toArray(),
  ]);
  const payload: BackupPayload = {
    version: 1,
    exportedAt: Date.now(),
    games,
    // Re-parse so a corrupt row already on disk can never be exported as if valid.
    events: events.map((event) => storedEventSchema.parse(event)),
    players,
  };
  return JSON.stringify(payload);
}

/** What an import wrote, and what it left alone because the key already existed locally. */
export interface ImportResult {
  games: number;
  events: number;
  skippedGames: number;
  skippedEvents: number;
}

/**
 * Restores a backup written by `exportBackup`. Validates the whole file with
 * Zod (oversize, malformed JSON, unknown event `v`, or any other schema
 * mismatch) before touching the database, then writes in one transaction so
 * a failure never leaves a partial import (ADR-53, Review Focus 5).
 *
 * The import only ever adds: a game row or `[gameId+seq]` event that already
 * exists locally is skipped, never overwritten, so restoring an older backup
 * cannot roll a game's status back or rewrite its append-only log.
 */
export async function importBackup(json: string): Promise<ImportResult> {
  const byteLength = new TextEncoder().encode(json).length;
  if (byteLength > MAX_BACKUP_BYTES) {
    throw new Error(`Backup file is too large (${byteLength} bytes, max ${MAX_BACKUP_BYTES})`);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (error) {
    throw new Error('Backup file is not valid JSON', { cause: error });
  }

  const parsed = backupPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error('Backup file failed validation', { cause: parsed.error });
  }
  const payload = parsed.data;

  const db = getDb();
  return db.transaction('rw', [db.games, db.events, db.players], async () => {
    const existingGames = await db.games.bulkGet(payload.games.map((game) => game.id));
    const newGames = payload.games.filter((_, i) => existingGames[i] === undefined);

    const existingEvents = await db.events.bulkGet(
      payload.events.map((event): [string, number] => [event.gameId, event.seq]),
    );
    const newEvents = payload.events.filter((_, i) => existingEvents[i] === undefined);

    // bulkAdd (not bulkPut): a key clash, including one inside the backup itself,
    // rejects and aborts the whole transaction rather than overwriting a row.
    await db.games.bulkAdd(newGames);
    await db.events.bulkAdd(newEvents);
    await db.players.bulkPut(payload.players);

    return {
      games: newGames.length,
      events: newEvents.length,
      skippedGames: payload.games.length - newGames.length,
      skippedEvents: payload.events.length - newEvents.length,
    };
  });
}
