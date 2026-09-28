import { beforeEach, describe, expect, it } from 'vitest';
import type { GameEvent } from '@/lib/game';
import { getDb } from './db';
import {
  appendEvent,
  createGame,
  listGames,
  listPlayers,
  loadEvents,
  savePlayer,
} from './repository';
import { exportBackup, importBackup } from './backup';

beforeEach(async () => {
  const db = getDb();
  await Promise.all([db.games.clear(), db.events.clear(), db.players.clear(), db.settings.clear()]);
});

const handDrawn: GameEvent = { type: 'HandDrawn' };
const gameEnded: GameEvent = { type: 'GameEnded', reason: 'manual' };

async function seedData() {
  const gameId = await createGame();
  await appendEvent(gameId, handDrawn);
  await appendEvent(gameId, gameEnded);
  await savePlayer('Alice');
  await savePlayer('Bob');
  return gameId;
}

async function clearAllTables() {
  const db = getDb();
  await Promise.all([db.games.clear(), db.events.clear(), db.players.clear(), db.settings.clear()]);
}

describe('exportBackup / importBackup', () => {
  it('round-trips games, events and players through export then import into an empty DB', async () => {
    const gameId = await seedData();
    const json = await exportBackup();

    await clearAllTables();
    expect(await listGames()).toHaveLength(0);

    const result = await importBackup(json);
    expect(result).toEqual({ games: 1, events: 2 });

    const games = await listGames();
    const events = await loadEvents(gameId);
    const players = await listPlayers();
    expect(games).toHaveLength(1);
    expect(games[0]?.id).toBe(gameId);
    expect(events.map((e) => e.payload.type)).toEqual(['HandDrawn', 'GameEnded']);
    expect(players.map((p) => p.name).sort()).toEqual(['Alice', 'Bob']);
  });

  it('produces valid JSON containing a version tag', async () => {
    await seedData();
    const json = await exportBackup();
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(Array.isArray(parsed.games)).toBe(true);
    expect(Array.isArray(parsed.events)).toBe(true);
    expect(Array.isArray(parsed.players)).toBe(true);
  });

  it('rejects an oversize backup and writes nothing', async () => {
    const huge = JSON.stringify({
      version: 1,
      exportedAt: Date.now(),
      games: [],
      events: [],
      players: [{ id: '1', name: 'x'.repeat(6 * 1024 * 1024) }],
    });
    await expect(importBackup(huge)).rejects.toThrow(/too large/i);
    expect(await listPlayers()).toHaveLength(0);
  });

  it('rejects malformed JSON and writes nothing', async () => {
    await expect(importBackup('{not valid json')).rejects.toThrow();
    expect(await listGames()).toHaveLength(0);
  });

  it('rejects an unknown event schema version and writes nothing', async () => {
    const gameId = await createGame();
    const bad = JSON.stringify({
      version: 1,
      exportedAt: Date.now(),
      games: await listGames(),
      events: [{ id: 'e1', gameId, seq: 0, v: 2, at: Date.now(), payload: { type: 'HandDrawn' } }],
      players: [],
    });
    await clearAllTables();

    await expect(importBackup(bad)).rejects.toThrow();
    expect(await listGames()).toHaveLength(0);
    expect(await loadEvents(gameId)).toHaveLength(0);
  });

  it('rejects a structurally invalid backup (missing required field) and writes nothing', async () => {
    const bad = JSON.stringify({ version: 1, exportedAt: Date.now(), games: [], players: [] });
    await expect(importBackup(bad)).rejects.toThrow();
    expect(await listGames()).toHaveLength(0);
  });

  it('is all-or-nothing: one bad event rejects the whole import, including its valid games', async () => {
    const gameId = await createGame();
    const good = await appendEvent(gameId, handDrawn);
    await clearAllTables();

    const mixed = JSON.stringify({
      version: 1,
      exportedAt: Date.now(),
      games: [{ id: gameId, createdAt: Date.now(), status: 'setup' }],
      events: [good, { ...good, id: 'bad', seq: 1, v: 99 }],
      players: [],
    });

    await expect(importBackup(mixed)).rejects.toThrow();
    expect(await listGames()).toHaveLength(0);
    expect(await loadEvents(gameId)).toHaveLength(0);
  });
});
