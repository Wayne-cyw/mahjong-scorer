// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initialState } from '@/lib/game';
import { tileName, type Tile } from '@/lib/tiles';
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

function mockStoreState(
  overrides: Partial<GameState> = {},
  extra: Partial<GameStoreState> = {},
): void {
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
    events: [{ seq: 0 }],
    loadGame,
    recordWin,
    recordDraw,
    ...extra,
  } as unknown as GameStoreState;
  vi.mocked(useGameStore).mockImplementation(
    (selector: (state: GameStoreState) => unknown) => selector(storeValue) as never,
  );
  Object.assign(vi.mocked(useGameStore), { getState: () => storeValue });
}

/** The camera step sits between the winner/discarder steps and the review screen. */
function skipCamera(): void {
  fireEvent.click(screen.getByRole('button', { name: /skip, enter manually/i }));
}

async function pickSelfDrawWinner(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Player 1' }));
  fireEvent.click(screen.getByRole('button', { name: /self-drawn/i }));
  skipCamera();
  fireEvent.click(screen.getByRole('button', { name: /enter fan directly/i }));
}

async function pickDiscardWinner(discarderSeatLabel: string): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Player 1' }));
  fireEvent.click(screen.getByRole('button', { name: /discard/i }));
  fireEvent.click(screen.getByRole('button', { name: discarderSeatLabel }));
  skipCamera();
  fireEvent.click(screen.getByRole('button', { name: /enter fan directly/i }));
}

function clickIncrement(times: number): void {
  const increment = screen.getByRole('button', { name: /increase fan/i });
  for (let i = 0; i < times; i++) fireEvent.click(increment);
}

describe('HandClient', () => {
  beforeEach(() => {
    recordWin.mockReset().mockResolvedValue(true);
    recordDraw.mockReset().mockResolvedValue(true);
    loadGame.mockReset().mockResolvedValue(undefined);
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

    // Straight to the camera step: no discarder buttons, no "who discarded" prompt.
    expect(screen.getByRole('button', { name: /take photo/i })).toBeInTheDocument();
    expect(screen.queryByText(/who discarded/i)).not.toBeInTheDocument();
    skipCamera();
    expect(screen.getByRole('button', { name: /enter fan directly/i })).toBeInTheDocument();
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
    expect(recordWin).toHaveBeenCalledWith({
      winner: 0,
      discarder: 2,
      fan: ruleset.minFan + 1,
      method: 'manual',
      startedAt: expect.any(Number),
    });
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
      method: 'manual',
      startedAt: expect.any(Number),
    });
  });

  it('records a tile-reviewed win with its hand, scored fan and engine version', async () => {
    render(<HandClient gameId="game-1" />);
    await screen.findByRole('button', { name: 'Player 1' });
    fireEvent.click(screen.getByRole('button', { name: 'Player 1' }));
    fireEvent.click(screen.getByRole('button', { name: /self-drawn/i }));
    skipCamera();

    const hand = screen.getByRole('region', { name: 'Hand' });
    const codes = [
      'm1',
      'm2',
      'm3',
      'p4',
      'p5',
      'p6',
      's7',
      's8',
      's9',
      'z5',
      'z5',
      'z5',
      'z7',
      'z7',
    ];
    for (const code of codes) {
      const n = tileName(code as Tile);
      fireEvent.click(within(hand).getByRole('button', { name: `${n.en} ${n.zh}` }));
    }
    const [winning] = screen.getAllByRole('button', {
      name: /^Mark Red Dragon .* as winning tile$/,
    });
    if (winning) fireEvent.click(winning);
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));

    await vi.waitFor(() => expect(recordWin).toHaveBeenCalledTimes(1));
    const arg = recordWin.mock.calls[0]?.[0];
    expect(arg).toMatchObject({ winner: 0, discarder: undefined });
    expect(arg.hand.winningTile).toBe('z7');
    expect(arg.fan).toBeGreaterThanOrEqual(ruleset.minFan);
    expect(arg.breakdown.length).toBeGreaterThan(0);
    expect(arg.engineVersion).toMatch(/^\d+\.\d+\.\d+/);
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

  it('shows a "not in progress" view with a way back when the game is not playing', async () => {
    mockStoreState({ status: 'complete' });
    render(<HandClient gameId="game-1" />);

    expect(await screen.findByText(/not in progress/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Player 1' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /back to table/i }));
    expect(push).toHaveBeenCalledWith('/game/game-1');
  });

  it('stays on the page and shows why when recordWin is refused', async () => {
    recordWin.mockResolvedValueOnce(false);
    mockStoreState({}, { error: 'Game is not in progress' });
    render(<HandClient gameId="game-1" />);
    await screen.findByRole('button', { name: 'Player 1' });
    await pickSelfDrawWinner();
    clickIncrement(ruleset.minFan);
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));

    await vi.waitFor(() => expect(recordWin).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('alert')).toHaveTextContent('Game is not in progress');
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
  });

  it('stays on the page with Cancel available when recordWin fails to save', async () => {
    recordWin.mockRejectedValueOnce(new Error('disk full'));
    render(<HandClient gameId="game-1" />);
    await screen.findByRole('button', { name: 'Player 1' });
    await pickSelfDrawWinner();
    clickIncrement(ruleset.minFan);
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('disk full');
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
  });

  it('stays on the page when recordDraw is refused', async () => {
    recordDraw.mockResolvedValueOnce(false);
    mockStoreState({}, { error: 'Game is not in progress' });
    render(<HandClient gameId="game-1" />);
    await screen.findByRole('button', { name: 'Player 1' });
    fireEvent.click(screen.getByRole('button', { name: /^draw$/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm draw/i }));

    await vi.waitFor(() => expect(recordDraw).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('alert')).toHaveTextContent('Game is not in progress');
    expect(push).not.toHaveBeenCalled();
  });

  it('keeps the flow usable when the store holds an earlier action error', async () => {
    mockStoreState({}, { error: 'Some earlier refusal' });
    render(<HandClient gameId="game-1" />);
    expect(await screen.findByRole('button', { name: 'Player 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
  });

  it('shows a load failure with a way back to the table', async () => {
    loadGame.mockRejectedValueOnce(new Error('IndexedDB is broken'));
    mockStoreState({}, { error: 'IndexedDB is broken' });
    render(<HandClient gameId="game-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('IndexedDB is broken');
    fireEvent.click(screen.getByRole('button', { name: /back to table/i }));
    expect(push).toHaveBeenCalledWith('/game/game-1');
  });
});
