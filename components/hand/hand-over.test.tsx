// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initialState } from '@/lib/game';
import type { GameState } from '@/lib/game';
import { basePointsFor, getPreset, settle } from '@/lib/scoring';
import type { GameStoreState } from '@/stores/game-store';
import { useGameStore } from '@/stores/game-store';
import { listPlayers } from '@/lib/db';
import { HandClient } from '@/app/game/[gameId]/hand/hand-client';

vi.mock('@/stores/game-store', () => ({ useGameStore: vi.fn() }));
vi.mock('@/lib/db', () => ({ listPlayers: vi.fn() }));

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const ruleset = getPreset('hk-discarder-pays');

const recordWin = vi.fn().mockResolvedValue(undefined);
const recordDraw = vi.fn().mockResolvedValue(undefined);
const loadGame = vi.fn().mockResolvedValue(undefined);

function mockStoreState(overrides: Partial<GameState> = {}): void {
  const state: GameState = {
    ...initialState,
    status: 'playing',
    playerIds: ['p0', 'p1', 'p2', 'p3'],
    seatOf: { p0: 0, p1: 1, p2: 2, p3: 3 },
    scores: [2000, 2000, 2000, 2000],
    ruleset,
    ...overrides,
  };
  const storeValue = {
    state,
    error: null,
    loadGame,
    recordWin,
    recordDraw,
  } as unknown as GameStoreState;
  vi.mocked(useGameStore).mockImplementation(
    (selector: (state: GameStoreState) => unknown) => selector(storeValue) as never,
  );
}

async function pickSelfDrawWinner(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Player 1' }));
  fireEvent.click(screen.getByRole('button', { name: /self-drawn/i }));
}

async function pickDiscardWinner(discarderSeatLabel: string): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Player 1' }));
  fireEvent.click(screen.getByRole('button', { name: /discard/i }));
  fireEvent.click(screen.getByRole('button', { name: discarderSeatLabel }));
}

function clickIncrement(times: number): void {
  const increment = screen.getByRole('button', { name: /increase fan/i });
  for (let i = 0; i < times; i++) fireEvent.click(increment);
}

describe('HandClient', () => {
  beforeEach(() => {
    recordWin.mockClear();
    recordDraw.mockClear();
    loadGame.mockClear();
    push.mockClear();
    vi.mocked(listPlayers).mockResolvedValue([]);
    mockStoreState();
  });

  afterEach(() => {
    cleanup();
  });

  it('skips the discarder step for a self-drawn win', async () => {
    render(<HandClient gameId="game-1" />);
    await screen.findByRole('button', { name: 'Player 1' });

    fireEvent.click(screen.getByRole('button', { name: 'Player 1' }));
    fireEvent.click(screen.getByRole('button', { name: /self-drawn/i }));

    // Straight to the fan entry step: no discarder buttons, no "who discarded" prompt.
    expect(screen.getByTestId('fan-value')).toBeInTheDocument();
    expect(screen.queryByText(/who discarded/i)).not.toBeInTheDocument();
  });

  it('shows a discarder step for a discard win, excluding the winner', async () => {
    render(<HandClient gameId="game-1" />);
    await screen.findByRole('button', { name: 'Player 1' });

    fireEvent.click(screen.getByRole('button', { name: 'Player 1' }));
    fireEvent.click(screen.getByRole('button', { name: /discard/i }));

    expect(screen.queryByRole('button', { name: 'Player 1' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Player 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Player 3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Player 4' })).toBeInTheDocument();
  });

  it('disables Confirm below the ruleset minimum fan and enables it at the minimum', async () => {
    render(<HandClient gameId="game-1" />);
    await screen.findByRole('button', { name: 'Player 1' });
    await pickSelfDrawWinner();

    const confirm = screen.getByRole('button', { name: /^confirm$/i });
    expect(confirm).toBeDisabled();

    clickIncrement(ruleset.minFan - 1);
    expect(confirm).toBeDisabled();

    clickIncrement(1);
    expect(confirm).not.toBeDisabled();
  });

  it('shows a payments preview matching settle()', async () => {
    render(<HandClient gameId="game-1" />);
    await screen.findByRole('button', { name: 'Player 1' });
    await pickDiscardWinner('Player 3');

    clickIncrement(ruleset.minFan);

    const basePoints = basePointsFor(ruleset.minFan, ruleset);
    const expected = settle({ winner: 0, discarder: 2, basePoints, model: ruleset.payment });

    for (const [seat, amount] of expected.entries()) {
      const label = `Player ${seat + 1}`;
      const row = screen.getByText(label).closest('li');
      expect(row).not.toBeNull();
      const sign = amount > 0 ? '+' : '';
      expect(row).toHaveTextContent(`${sign}${amount}`);
    }
  });

  it('calls recordWin with exactly the chosen winner, discarder and fan', async () => {
    render(<HandClient gameId="game-1" />);
    await screen.findByRole('button', { name: 'Player 1' });
    await pickDiscardWinner('Player 3');

    clickIncrement(ruleset.minFan + 1);
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));

    await vi.waitFor(() => expect(recordWin).toHaveBeenCalledTimes(1));
    expect(recordWin).toHaveBeenCalledWith({ winner: 0, discarder: 2, fan: ruleset.minFan + 1 });
  });

  it('calls recordWin with no discarder for a self-drawn win', async () => {
    render(<HandClient gameId="game-1" />);
    await screen.findByRole('button', { name: 'Player 1' });
    await pickSelfDrawWinner();

    clickIncrement(ruleset.minFan);
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));

    await vi.waitFor(() => expect(recordWin).toHaveBeenCalledTimes(1));
    expect(recordWin).toHaveBeenCalledWith({
      winner: 0,
      discarder: undefined,
      fan: ruleset.minFan,
    });
  });

  it('appends nothing when the flow is cancelled', async () => {
    render(<HandClient gameId="game-1" />);
    await screen.findByRole('button', { name: 'Player 1' });
    await pickSelfDrawWinner();
    clickIncrement(ruleset.minFan);

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(recordWin).not.toHaveBeenCalled();
    expect(recordDraw).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/game/game-1');
  });

  it('records a draw only after confirming, and navigates back', async () => {
    render(<HandClient gameId="game-1" />);
    await screen.findByRole('button', { name: 'Player 1' });

    fireEvent.click(screen.getByRole('button', { name: /^draw$/i }));
    expect(recordDraw).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /confirm draw/i }));

    await vi.waitFor(() => expect(recordDraw).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith('/game/game-1');
  });
});
