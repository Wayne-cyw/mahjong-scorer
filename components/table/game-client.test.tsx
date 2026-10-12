// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initialState } from '@/lib/game';
import type { GameState } from '@/lib/game';
import type { GameStoreState } from '@/stores/game-store';
import { useGameStore } from '@/stores/game-store';
import { listPlayers } from '@/lib/db';
import { GameClient } from '@/app/game/[gameId]/game-client';

vi.mock('@/stores/game-store', () => ({ useGameStore: vi.fn() }));
vi.mock('@/lib/db', () => ({ listPlayers: vi.fn() }));
vi.mock('@/components/settings/install-nudge', () => ({ InstallNudge: () => null }));

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const loadGame = vi.fn();

const playingState: GameState = {
  ...initialState,
  status: 'playing',
  playerIds: ['p0', 'p1', 'p2', 'p3'],
  seatOf: { p0: 0, p1: 1, p2: 2, p3: 3 },
  scores: [2000, 2000, 2000, 2000],
};

function mockStore(state: GameState, extra: Partial<GameStoreState> = {}): void {
  const storeValue = {
    state,
    error: null,
    events: state.playerIds.length > 0 ? [{ seq: 0 }] : [],
    loadGame,
    rollDice: vi.fn().mockResolvedValue(true),
    endGame: vi.fn().mockResolvedValue(true),
    overrideState: vi.fn().mockResolvedValue(true),
    ...extra,
  } as unknown as GameStoreState;
  vi.mocked(useGameStore).mockImplementation(
    (selector: (state: GameStoreState) => unknown) => selector(storeValue) as never,
  );
}

describe('GameClient', () => {
  beforeEach(() => {
    push.mockClear();
    loadGame.mockReset().mockResolvedValue(undefined);
    vi.mocked(listPlayers).mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps the table (and End game) on screen when an action error is set, showing it inline', async () => {
    mockStore({ ...playingState, status: 'complete' }, { error: 'Game is not in progress' });
    render(<GameClient gameId="game-1" />);

    expect(await screen.findByRole('button', { name: /end game/i })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Game is not in progress');
  });

  it('shows a full-screen error with a way home when loading the game fails', async () => {
    loadGame.mockRejectedValue(new Error('IndexedDB is broken'));
    mockStore(initialState, { error: 'IndexedDB is broken' });
    render(<GameClient gameId="game-1" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('IndexedDB is broken');
    fireEvent.click(screen.getByRole('button', { name: /home/i }));
    expect(push).toHaveBeenCalledWith('/');
  });

  it('shows "game not found" with a way home when the game has no events', async () => {
    mockStore(initialState);
    render(<GameClient gameId="missing" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/not found/i);
    expect(screen.getByRole('button', { name: /home/i })).toBeInTheDocument();
  });
});
