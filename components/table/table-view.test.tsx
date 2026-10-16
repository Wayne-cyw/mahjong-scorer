// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initialState } from '@/lib/game';
import type { GameState } from '@/lib/game';
import type { GameStoreState } from '@/stores/game-store';
import { useGameStore } from '@/stores/game-store';
import { TableView } from './table-view';

vi.mock('@/stores/game-store', () => ({ useGameStore: vi.fn() }));

const baseState: GameState = {
  ...initialState,
  status: 'playing',
  playerIds: ['p0', 'p1', 'p2', 'p3'],
  seatOf: { p0: 0, p1: 1, p2: 2, p3: 3 },
  scores: [2500, 1800, 1700, 2000],
  firstDealer: 0,
  dealer: 2,
  prevailing: 'E',
  dealerRepeat: 1,
};

function mockStoreState(state: GameState, extra: Partial<GameStoreState> = {}): void {
  const storeValue = {
    state,
    error: null,
    rollDice: vi.fn(),
    ...extra,
  } as unknown as GameStoreState;
  vi.mocked(useGameStore).mockImplementation(
    (selector: (state: GameStoreState) => unknown) => selector(storeValue) as never,
  );
}

describe('TableView', () => {
  beforeEach(() => {
    mockStoreState(baseState);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders each seat with its score and bilingual wind, East on the dealer (seat 2)', () => {
    render(<TableView playerNames={{ p0: 'Alice', p1: 'Bob', p2: 'Cara', p3: 'Dee' }} />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Cara')).toBeInTheDocument();
    expect(screen.getByText('2500')).toBeInTheDocument();
    expect(screen.getByText('1700')).toBeInTheDocument();

    const dealerCard = screen.getByTestId('seat-card-2');
    expect(dealerCard).toHaveAttribute('data-dealer', 'true');
    expect(dealerCard).toHaveTextContent('East');
    expect(dealerCard).toHaveTextContent('東');
    expect(dealerCard).toHaveTextContent('Dealer');
    expect(dealerCard).toHaveTextContent('repeat 1');

    const westCard = screen.getByTestId('seat-card-0');
    expect(westCard).toHaveAttribute('data-dealer', 'false');
    expect(westCard).toHaveTextContent('West');
    expect(westCard).toHaveTextContent('西');
  });

  it('shows the prevailing wind and hand label', () => {
    render(<TableView playerNames={{}} />);
    expect(screen.getByText(/East round/)).toBeInTheDocument();
    expect(screen.getByText(/dealer repeat 1/)).toBeInTheDocument();
  });

  it('falls back to a generic name when no player name is supplied', () => {
    render(<TableView />);
    expect(screen.getByText('Player 1')).toBeInTheDocument();
  });

  it('rotates the table 90 degrees per click, wrapping after 270', () => {
    render(<TableView playerNames={{}} />);
    const root = screen.getByTestId('table-view-root');
    const rotateButton = screen.getByRole('button', { name: /rotate/i });

    expect(root).toHaveAttribute('data-orientation', '0');
    fireEvent.click(rotateButton);
    expect(root).toHaveAttribute('data-orientation', '90');
    fireEvent.click(rotateButton);
    expect(root).toHaveAttribute('data-orientation', '180');
    fireEvent.click(rotateButton);
    expect(root).toHaveAttribute('data-orientation', '270');
    fireEvent.click(rotateButton);
    expect(root).toHaveAttribute('data-orientation', '0');
  });

  it('does not show a score change when the table is rotated', () => {
    render(<TableView playerNames={{}} />);
    fireEvent.click(screen.getByRole('button', { name: /rotate/i }));
    expect(screen.queryByText(/^[+−]\d+$/)).not.toBeInTheDocument();
  });

  it('renders Hand over and End now controls', () => {
    render(<TableView playerNames={{}} />);
    expect(screen.getByRole('button', { name: /hand over/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /end now/i })).toBeInTheDocument();
  });

  it('hides Hand over and the dice panel once the game is no longer in progress', () => {
    mockStoreState({ ...baseState, status: 'complete' });
    render(<TableView playerNames={{}} />);
    expect(screen.queryByRole('button', { name: /hand over/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /roll dice/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /end game/i })).toBeInTheDocument();
  });

  it('shows Hand over and the dice panel while the game is in progress', () => {
    render(<TableView playerNames={{}} />);
    expect(screen.getByRole('button', { name: /hand over/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /roll dice/i })).toBeInTheDocument();
  });

  it('shows a refused action inline and does not call onGameEnded', async () => {
    const onGameEnded = vi.fn();
    const endGame = vi.fn().mockResolvedValue(false);
    mockStoreState({ ...baseState, status: 'complete' }, { endGame, error: 'No game loaded' });
    render(<TableView playerNames={{}} onGameEnded={onGameEnded} />);

    fireEvent.click(screen.getByRole('button', { name: /end game/i }));

    await vi.waitFor(() => expect(endGame).toHaveBeenCalledWith('completed'));
    expect(onGameEnded).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('No game loaded');
  });
});
