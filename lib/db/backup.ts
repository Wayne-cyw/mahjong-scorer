import { z } from 'zod';
import { storedEventSchema } from '@/lib/game';
import { getDb, type GameRow, type PlayerRow } from './db';

/** Backups over this size are rejected outright, before any JSON parsing (Review Focus 5). */
const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

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

/**
 * Restores a backup written by `exportBackup`. Validates the whole file with
 * Zod (oversize, malformed JSON, unknown event `v`, or any other schema
 * mismatch) before touching the database, then writes everything in one
 * transaction so a failure never leaves a partial import (ADR-53, Review Focus 5).
 */
export async function importBackup(json: string): Promise<{ games: number; events: number }> {
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
  await db.transaction('rw', [db.games, db.events, db.players], async () => {
    await db.games.bulkPut(payload.games);
    await db.events.bulkPut(payload.events);
    await db.players.bulkPut(payload.players);
  });

  return { games: payload.games.length, events: payload.events.length };
}
