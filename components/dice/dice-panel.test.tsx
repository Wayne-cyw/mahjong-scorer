// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initialState } from '@/lib/game';
import type { GameState } from '@/lib/game';
import type { GameStoreState } from '@/stores/game-store';
import { useGameStore } from '@/stores/game-store';
import { DicePanel } from './dice-panel';

vi.mock('@/stores/game-store', () => ({ useGameStore: vi.fn() }));

const rollDice = vi.fn();

function mockStoreState(overrides: Partial<GameState> = {}): void {
  const state: GameState = { ...initialState, dealer: 0, ...overrides };
  const storeValue = { state, rollDice, error: null } as unknown as GameStoreState;
  vi.mocked(useGameStore).mockImplementation(
    (selector: (state: GameStoreState) => unknown) => selector(storeValue) as never,
  );
}

describe('DicePanel', () => {
  beforeEach(() => {
    rollDice.mockReset().mockResolvedValue(true);
    mockStoreState();
  });

  afterEach(() => {
    cleanup();
  });

  it('calls rollDice with no arguments for a virtual roll', () => {
    render(<DicePanel />);
    fireEvent.click(screen.getByRole('button', { name: /roll dice/i }));
    expect(rollDice).toHaveBeenCalledTimes(1);
    expect(rollDice).toHaveBeenCalledWith();
  });

  it('calls rollDice with the typed physical total', () => {
    render(<DicePanel />);
    fireEvent.change(screen.getByLabelText(/physical total/i), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /use physical total/i }));
    expect(rollDice).toHaveBeenCalledWith({ physicalTotal: 10 });
  });

  it('rejects a total below 3 without calling rollDice', () => {
    render(<DicePanel />);
    fireEvent.change(screen.getByLabelText(/physical total/i), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /use physical total/i }));
    expect(rollDice).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/between 3 and 18/i);
  });

  it('rejects a total above 18 without calling rollDice', () => {
    render(<DicePanel />);
    fireEvent.change(screen.getByLabelText(/physical total/i), { target: { value: '19' } });
    fireEvent.click(screen.getByRole('button', { name: /use physical total/i }));
    expect(rollDice).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/between 3 and 18/i);
  });

  it('shows the total, wall to break and stack count after a roll', () => {
    mockStoreState({ dealer: 0, lastRoll: { total: 7, source: 'virtual', dice: [3, 2, 2] } });
    render(<DicePanel />);
    // dealer 0, total 7 -> wallToBreak(0, 7) = (0 + 7 - 1) % 4 = 2 -> seatWind(2, 0) = 'W' (West)
    expect(screen.getByText(/Total 7/)).toBeInTheDocument();
    expect(screen.getByText(/West/)).toBeInTheDocument();
    expect(screen.getByText(/7 stacks in/)).toBeInTheDocument();
  });

  it('shows an error instead of an unhandled rejection when the roll fails to save', async () => {
    rollDice.mockRejectedValueOnce(new Error('disk full'));
    render(<DicePanel />);
    fireEvent.click(screen.getByRole('button', { name: /roll dice/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('disk full');
  });

  it('shows an error when a physical total fails to save', async () => {
    rollDice.mockRejectedValueOnce(new Error('disk full'));
    render(<DicePanel />);
    fireEvent.change(screen.getByLabelText(/physical total/i), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: /use physical total/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('disk full');
  });

  it('shows why when the roll is refused', async () => {
    rollDice.mockResolvedValueOnce(false);
    render(<DicePanel />);
    fireEvent.click(screen.getByRole('button', { name: /roll dice/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/not in progress/i);
  });
});
