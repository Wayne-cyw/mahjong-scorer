// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initialState, type GameState, type StoredEvent } from '@/lib/game';
import { getPreset } from '@/lib/scoring';
import { listPlayers } from '@/lib/db';
import { useGameStore } from '@/stores/game-store';
import { SummaryClient } from '@/app/game/[gameId]/summary/summary-client';
import { Standings } from './standings';

vi.mock('@/lib/db', () => ({ listPlayers: vi.fn() }));
vi.mock('@/stores/game-store', () => ({
  useGameStore: Object.assign(vi.fn(), { getState: vi.fn() }),
}));
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const rows = [
  { seat: 1 as const, name: 'Bo', score: 2300, net: 300, rank: 1 },
  { seat: 0 as const, name: 'Ann', score: 2000, net: 0, rank: 2 },
  { seat: 3 as const, name: 'Dee', score: 1850, net: -150, rank: 3 },
  { seat: 2 as const, name: 'Cy', score: 1850, net: -150, rank: 3 },
];

describe('Standings', () => {
  afterEach(cleanup);

  it('lists players by rank with score and signed net, in points', () => {
    render(<Standings rows={rows} final onRematch={vi.fn()} onHome={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Final standings' })).toBeInTheDocument();
    const first = within(screen.getByTestId('standing-1'));
    expect(first.getByText('Bo')).toBeInTheDocument();
    expect(first.getByText('2300')).toBeInTheDocument();
    expect(first.getByText('+300 pts')).toBeInTheDocument();
    expect(within(screen.getByTestId('standing-0')).getByText('0 pts')).toBeInTheDocument();
    expect(within(screen.getByTestId('standing-3')).getByText('-150 pts')).toBeInTheDocument();
  });

  it('marks tied players with the same rank', () => {
    render(<Standings rows={rows} final onRematch={vi.fn()} onHome={vi.fn()} />);
    expect(within(screen.getByTestId('standing-3')).getByText('T3')).toBeInTheDocument();
    expect(within(screen.getByTestId('standing-2')).getByText('T3')).toBeInTheDocument();
    expect(within(screen.getByTestId('standing-1')).getByText('1')).toBeInTheDocument();
  });

  it('uses points wording only, never money terms (PD-24)', () => {
    const { container } = render(
      <Standings rows={rows} final onRematch={vi.fn()} onHome={vi.fn()} />,
    );
    expect(container.textContent).not.toMatch(/\$|dollar|cash|money|win\s?\/?\s?loss|payout/i);
  });

  it('says "Standings so far" while the game is still on', () => {
    render(<Standings rows={rows} final={false} onRematch={vi.fn()} onHome={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Standings so far' })).toBeInTheDocument();
  });

  it('calls back for rematch and home, and disables rematch while starting', () => {
    const onRematch = vi.fn();
    const onHome = vi.fn();
    const { rerender } = render(
      <Standings rows={rows} final onRematch={onRematch} onHome={onHome} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Rematch' }));
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(onRematch).toHaveBeenCalledTimes(1);
    expect(onHome).toHaveBeenCalledTimes(1);
    rerender(<Standings rows={rows} final onRematch={onRematch} onHome={onHome} rematching />);
    expect(screen.getByRole('button', { name: 'Rematch' })).toBeDisabled();
  });
});

describe('SummaryClient', () => {
  const ended: GameState = {
    ...initialState,
    status: 'ended',
    playerIds: ['pa', 'pb', 'pc', 'pd'],
    seatOf: { pa: 0, pb: 1, pc: 2, pd: 3 },
    scores: [2100, 1900, 2200, 1800],
    firstDealer: 1,
    ruleset: getPreset('hk-discarder-pays'),
  };
  const created: StoredEvent = {
    id: 'e0',
    gameId: 'g1',
    seq: 0,
    v: 1,
    at: 0,
    payload: {
      type: 'GameCreated',
      playerIds: ended.playerIds,
      ruleset: ended.ruleset!,
      startingPoints: 2000,
    },
  };

  const calls: string[] = [];
  const createGame = vi.fn();
  const assignSeats = vi.fn();
  const chooseFirstDealer = vi.fn();
  const loadGame = vi.fn();

  const mockStore = (over: Record<string, unknown> = {}) => {
    const value = {
      state: ended,
      events: [created],
      error: null,
      loadGame,
      createGame,
      assignSeats,
      chooseFirstDealer,
      ...over,
    };
    vi.mocked(useGameStore).mockImplementation(((selector: (s: unknown) => unknown) =>
      selector(value)) as never);
    vi.mocked(useGameStore.getState).mockReturnValue({
      state: { ...initialState, playerIds: ['n1', 'n2', 'n3', 'n4'] },
    } as never);
  };

  beforeEach(() => {
    calls.length = 0;
    push.mockClear();
    loadGame.mockReset().mockResolvedValue(undefined);
    createGame.mockReset().mockImplementation(async () => {
      calls.push('createGame');
      return 'new-game';
    });
    assignSeats.mockReset().mockImplementation(async () => {
      calls.push('assignSeats');
      return true;
    });
    chooseFirstDealer.mockReset().mockImplementation(async () => {
      calls.push('chooseFirstDealer');
      return true;
    });
    vi.mocked(listPlayers).mockResolvedValue([
      { id: 'pa', name: 'Ann' },
      { id: 'pb', name: 'Bo' },
      { id: 'pc', name: 'Cy' },
      { id: 'pd', name: 'Dee' },
    ]);
    mockStore();
  });

  afterEach(cleanup);

  it('shows ranked standings with net against the starting points', async () => {
    render(<SummaryClient gameId="g1" />);
    const top = await screen.findByTestId('standing-2');
    expect(within(top).getByText('Cy')).toBeInTheDocument();
    expect(within(top).getByText('+200 pts')).toBeInTheDocument();
    expect(within(screen.getByTestId('standing-3')).getByText('-200 pts')).toBeInTheDocument();
  });

  it('starts a rematch with the same players in the same seats, next dealer first', async () => {
    render(<SummaryClient gameId="g1" />);
    await screen.findByTestId('standing-0');
    await waitFor(() => expect(vi.mocked(listPlayers)).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole('button', { name: 'Rematch' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/game/new-game'));
    expect(calls).toEqual(['createGame', 'assignSeats', 'chooseFirstDealer']);
    expect(createGame).toHaveBeenCalledWith({
      playerNames: ['Ann', 'Bo', 'Cy', 'Dee'],
      presetId: 'hk-discarder-pays',
      startingPoints: 2000,
    });
    expect(assignSeats).toHaveBeenCalledWith({ n1: 0, n2: 1, n3: 2, n4: 3 });
    expect(chooseFirstDealer).toHaveBeenCalledWith(2);
  });

  it('shows the failure and stays on the page when the rematch cannot be created', async () => {
    createGame.mockRejectedValue(new Error('IndexedDB is broken'));
    render(<SummaryClient gameId="g1" />);
    await screen.findByTestId('standing-0');
    await waitFor(() => expect(vi.mocked(listPlayers)).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Rematch' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('IndexedDB is broken');
    expect(push).not.toHaveBeenCalled();
  });

  it('reports a refused seat assignment instead of opening a half-made game', async () => {
    assignSeats.mockResolvedValue(false);
    render(<SummaryClient gameId="g1" />);
    await screen.findByTestId('standing-0');
    await waitFor(() => expect(vi.mocked(listPlayers)).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Rematch' }));

    await waitFor(() => expect(chooseFirstDealer).not.toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
  });

  it('shows a way home when the game does not exist', async () => {
    mockStore({ events: [], state: initialState });
    render(<SummaryClient gameId="missing" />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/not found/i);
  });
});
