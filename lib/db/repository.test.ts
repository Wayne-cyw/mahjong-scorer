import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnknownEventError } from '@/lib/game';
import type { GameEvent } from '@/lib/game';
import { DuplicateSeqError, getDb } from './db';
import {
  appendEvent,
  createGame,
  getSetting,
  listGames,
  listPlayers,
  loadEvents,
  requestPersistence,
  savePlayer,
  setGameStatus,
  setSetting,
} from './repository';

beforeEach(async () => {
  const db = getDb();
  await Promise.all([db.games.clear(), db.events.clear(), db.players.clear(), db.settings.clear()]);
});

const handDrawn: GameEvent = { type: 'HandDrawn' };
const gameEnded: GameEvent = { type: 'GameEnded', reason: 'manual' };

describe('createGame', () => {
  it('creates a row with status "setup" and returns the id', async () => {
    const gameId = await createGame();
    const games = await listGames();
    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({ id: gameId, status: 'setup' });
    expect(typeof games[0]?.createdAt).toBe('number');
  });

  it('accepts an explicit id', async () => {
    const gameId = await createGame('fixed-id');
    expect(gameId).toBe('fixed-id');
  });
});

describe('appendEvent / loadEvents', () => {
  it('increments seq per game, starting at 0', async () => {
    const gameId = await createGame();
    const first = await appendEvent(gameId, handDrawn);
    const second = await appendEvent(gameId, gameEnded);
    expect(first.seq).toBe(0);
    expect(second.seq).toBe(1);
    expect(first.gameId).toBe(gameId);
    expect(typeof first.id).toBe('string');
    expect(first.id).not.toBe(second.id);
  });

  it('keeps separate seq counters per game', async () => {
    const gameA = await createGame();
    const gameB = await createGame();
    const a0 = await appendEvent(gameA, handDrawn);
    const b0 = await appendEvent(gameB, handDrawn);
    expect(a0.seq).toBe(0);
    expect(b0.seq).toBe(0);
  });

  it('loads events for a game ordered by seq', async () => {
    const gameId = await createGame();
    await appendEvent(gameId, handDrawn);
    await appendEvent(gameId, gameEnded);
    const events = await loadEvents(gameId);
    expect(events.map((e) => e.seq)).toEqual([0, 1]);
    expect(events.map((e) => e.payload.type)).toEqual(['HandDrawn', 'GameEnded']);
  });

  it('directly provokes the [gameId+seq] unique-key constraint', async () => {
    const db = getDb();
    const gameId = await createGame();
    const row = { id: 'evt-1', gameId, seq: 0, v: 1 as const, at: Date.now(), payload: handDrawn };
    await db.events.add(row);
    await expect(db.events.add({ ...row, id: 'evt-2' })).rejects.toThrow(Dexie.ConstraintError);
  });

  describe('expectedSeq (optimistic concurrency, ADR-55)', () => {
    it('appends when expectedSeq matches the next seq in the log', async () => {
      const gameId = await createGame();
      const first = await appendEvent(gameId, handDrawn, 0);
      const second = await appendEvent(gameId, gameEnded, 1);
      expect([first.seq, second.seq]).toEqual([0, 1]);
    });

    it('throws DuplicateSeqError and writes nothing when another writer already took that seq', async () => {
      const gameId = await createGame();
      // Writer A and writer B both saw an empty log; A appends first.
      await appendEvent(gameId, handDrawn, 0);
      // B still believes the next seq is 0: it must not append on top of A's unseen event.
      await expect(appendEvent(gameId, gameEnded, 0)).rejects.toThrow(DuplicateSeqError);
      const events = await loadEvents(gameId);
      expect(events.map((e) => e.payload.type)).toEqual(['HandDrawn']);
    });

    it('throws DuplicateSeqError when expectedSeq is ahead of the log', async () => {
      const gameId = await createGame();
      await expect(appendEvent(gameId, handDrawn, 3)).rejects.toThrow(DuplicateSeqError);
      expect(await loadEvents(gameId)).toHaveLength(0);
    });
  });

  describe('a lost race for the same seq', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('maps a ConstraintError from a losing write to DuplicateSeqError (ADR-55)', async () => {
      // A single IndexedDB transaction (ADR-54) serializes writers, so the
      // primary stale-writer detection is `expectedSeq` (tested above). This
      // covers the last-line-of-defence mapping: if the underlying add ever
      // rejects on the [gameId+seq] key, it surfaces as DuplicateSeqError.
      const db = getDb();
      const gameId = await createGame();
      vi.spyOn(db.events, 'add').mockRejectedValueOnce(
        new Dexie.ConstraintError('Key already exists in the object store.'),
      );

      await expect(appendEvent(gameId, handDrawn)).rejects.toThrow(DuplicateSeqError);
    });

    it('re-throws any other error from the write unchanged', async () => {
      const db = getDb();
      const gameId = await createGame();
      const boom = new Error('boom');
      vi.spyOn(db.events, 'add').mockRejectedValueOnce(boom);

      await expect(appendEvent(gameId, handDrawn)).rejects.toThrow(boom);
    });
  });

  it('reports a row that fails Zod parsing instead of silently dropping it', async () => {
    const db = getDb();
    const gameId = await createGame();
    await db.events.add({
      id: 'bad-1',
      gameId,
      seq: 0,
      // @ts-expect-error -- deliberately malformed for the test
      v: 2,
      at: Date.now(),
      payload: handDrawn,
    });
    await expect(loadEvents(gameId)).rejects.toThrow(UnknownEventError);
  });
});

describe('listGames', () => {
  it('lists newest first', async () => {
    const first = await createGame();
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = await createGame();
    const games = await listGames();
    expect(games.map((g) => g.id)).toEqual([second, first]);
  });
});

describe('setGameStatus', () => {
  it('updates the status field', async () => {
    const gameId = await createGame();
    await setGameStatus(gameId, 'playing');
    const games = await listGames();
    expect(games[0]?.status).toBe('playing');
  });
});

describe('savePlayer / listPlayers', () => {
  it('creates a new player and reuses an existing one by trimmed name', async () => {
    const created = await savePlayer('  Alice  ');
    const reused = await savePlayer('Alice');
    expect(reused.id).toBe(created.id);
    expect(created.name).toBe('Alice');
  });

  it('lists players alphabetically', async () => {
    await savePlayer('Bob');
    await savePlayer('Alice');
    const players = await listPlayers();
    expect(players.map((p) => p.name)).toEqual(['Alice', 'Bob']);
  });
});

describe('settings', () => {
  it('round-trips a value through setSetting/getSetting', async () => {
    await setSetting('drawDealerStays', true);
    expect(await getSetting<boolean>('drawDealerStays')).toBe(true);
  });

  it('returns undefined for an unset key', async () => {
    expect(await getSetting('missing')).toBeUndefined();
  });
});

describe('requestPersistence', () => {
  it('resolves false when navigator.storage is unavailable', async () => {
    expect(await requestPersistence()).toBe(false);
  });
});
