// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameEvent, GameState, StoredEvent } from '@/lib/game';
import { deriveHistory, replay } from '@/lib/game';
import type { Seat } from '@/lib/tiles';
import { basePointsFor, getPreset, settle } from '@/lib/scoring';
import type { GameStoreState } from '@/stores/game-store';
import { useGameStore } from '@/stores/game-store';
import { exportBackup, importBackup } from '@/lib/db';
import { HandList } from './hand-list';
import { OverrideSheet } from '@/components/table/override-sheet';
import { BackupPanel } from '@/components/settings/backup-panel';
import { TableView } from '@/components/table/table-view';

vi.mock('@/stores/game-store', () => ({ useGameStore: vi.fn() }));
vi.mock('@/lib/db', () => ({ exportBackup: vi.fn(), importBackup: vi.fn() }));

const ruleset = getPreset('hk-discarder-pays');

let seq = 0;
function env(payload: GameEvent): StoredEvent {
  const n = seq++;
  return { id: `evt-${n}`, gameId: 'g1', seq: n, v: 1, at: 1_700_000_000_000 + n, payload };
}

function win(winner: Seat, discarder?: Seat, fan = ruleset.minFan): StoredEvent {
  return env({
    type: 'HandWon',
    winner,
    discarder,
    fan,
    breakdown: [],
    payments: settle({
      winner,
      discarder,
      basePoints: basePointsFor(fan, ruleset),
      model: ruleset.payment,
    }),
    engineVersion: 'manual',
    manual: true,
  });
}

function baseEvents(): StoredEvent[] {
  seq = 0;
  return [
    env({
      type: 'GameCreated',
      playerIds: ['p0', 'p1', 'p2', 'p3'],
      ruleset,
      startingPoints: 2000,
    }),
    env({ type: 'SeatsAssigned', seatOf: { p0: 0, p1: 1, p2: 2, p3: 3 } }),
    env({ type: 'FirstDealerChosen', seat: 0 }),
  ];
}

const voidHand = vi.fn().mockResolvedValue(undefined);
const correctHand = vi.fn().mockResolvedValue(undefined);
const overrideState = vi.fn().mockResolvedValue(undefined);
const endGame = vi.fn().mockResolvedValue(undefined);

function mockStore(events: StoredEvent[], stateOverride: Partial<GameState> = {}): void {
  const storeValue = {
    events,
    state: { ...replay(events), ...stateOverride },
    history: deriveHistory(events),
    voidHand,
    correctHand,
    overrideState,
    endGame,
    rollDice: vi.fn(),
  } as unknown as GameStoreState;
  vi.mocked(useGameStore).mockImplementation(
    (selector: (state: GameStoreState) => unknown) => selector(storeValue) as never,
  );
}

const names = { p0: 'Alice', p1: 'Bob', p2: 'Cara', p3: 'Dee' };

beforeEach(() => {
  voidHand.mockClear();
  correctHand.mockClear();
  overrideState.mockClear();
  endGame.mockClear();
  vi.mocked(exportBackup).mockReset();
  vi.mocked(importBackup).mockReset();
});
afterEach(cleanup);

describe('HandList undo', () => {
  it('warns when voiding the hand changes the dealer, and confirming calls voidHand', () => {
    const events = [...baseEvents(), win(1, 0)]; // dealer 0 loses -> dealer becomes 1
    mockStore(events);
    render(<HandList playerNames={names} />);

    fireEvent.click(screen.getByRole('button', { name: /undo/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/dealer/i);

    fireEvent.click(screen.getByRole('button', { name: /confirm undo/i }));
    expect(voidHand).toHaveBeenCalledWith('evt-3');
  });

  it('shows no dealer warning when the dealer does not change', () => {
    const events = [...baseEvents(), win(0, 1)]; // dealer wins and stays
    mockStore(events);
    render(<HandList playerNames={names} />);

    fireEvent.click(screen.getByRole('button', { name: /undo/i }));
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /confirm undo/i }));
    expect(voidHand).toHaveBeenCalledWith('evt-3');
  });

  it('does not call voidHand when cancelled', () => {
    mockStore([...baseEvents(), win(0, 1)]);
    render(<HandList playerNames={names} />);
    fireEvent.click(screen.getByRole('button', { name: /undo/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(voidHand).not.toHaveBeenCalled();
  });
});

describe('HandList edit', () => {
  it('corrects fan and discarder with recomputed payments', () => {
    mockStore([...baseEvents(), win(0, 1, 3)]);
    render(<HandList playerNames={names} />);

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.change(screen.getByLabelText(/fan/i), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/discarder/i), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /apply edit/i }));

    expect(correctHand).toHaveBeenCalledTimes(1);
    const [targetId, replacement] = correctHand.mock.calls[0] as [string, Record<string, unknown>];
    expect(targetId).toBe('evt-3');
    expect(replacement).toMatchObject({ winner: 0, discarder: 2, fan: 5 });
    const payments = replacement.payments as number[];
    expect(payments.reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('rejects a fan below the ruleset minimum', () => {
    mockStore([...baseEvents(), win(0, 1, 3)]);
    render(<HandList playerNames={names} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.change(screen.getByLabelText(/fan/i), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /apply edit/i }));
    expect(correctHand).not.toHaveBeenCalled();
    expect(screen.getByText(/fan must be/i)).toBeInTheDocument();
  });
});

describe('OverrideSheet', () => {
  const seatNames = ['Alice', 'Bob', 'Cara', 'Dee'];
  const initial = { dealer: 0 as Seat, prevailing: 'E' as const, dealerRepeat: 0 };

  it('rejects an out-of-range dealer repeat', () => {
    const onSubmit = vi.fn();
    render(
      <OverrideSheet
        seatNames={seatNames}
        initial={initial}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText(/dealer repeat/i), { target: { value: '-1' } });
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('submits valid values', () => {
    const onSubmit = vi.fn();
    render(
      <OverrideSheet
        seatNames={seatNames}
        initial={initial}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText(/dealer$/i), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/prevailing/i), { target: { value: 'S' } });
    fireEvent.change(screen.getByLabelText(/dealer repeat/i), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(onSubmit).toHaveBeenCalledWith({ dealer: 2, prevailing: 'S', dealerRepeat: 3 });
  });
});

describe('BackupPanel', () => {
  it('shows a readable error and no counts when import fails', async () => {
    vi.mocked(importBackup).mockRejectedValue(new Error('Backup file is not valid JSON'));
    render(<BackupPanel />);
    const input = screen.getByLabelText(/import backup/i);
    const file = new File(['not json'], 'backup.json', { type: 'application/json' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Backup file is not valid JSON');
    expect(screen.queryByText(/imported/i)).toBeNull();
  });

  it('reports counts after a successful import', async () => {
    vi.mocked(importBackup).mockResolvedValue({ games: 2, events: 40 });
    render(<BackupPanel />);
    const file = new File(['{}'], 'backup.json', { type: 'application/json' });
    fireEvent.change(screen.getByLabelText(/import backup/i), { target: { files: [file] } });
    expect(await screen.findByText(/imported 2 games and 40 events/i)).toBeInTheDocument();
  });
});

describe('TableView end of game', () => {
  it('asks for confirmation before ending manually', () => {
    mockStore(baseEvents());
    render(<TableView />);
    fireEvent.click(screen.getByRole('button', { name: /end now/i }));
    expect(endGame).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /confirm end/i }));
    expect(endGame).toHaveBeenCalledWith('manual');
  });

  it('prompts to end a completed game', async () => {
    mockStore(baseEvents(), { status: 'complete' });
    render(<TableView />);
    expect(screen.getByText(/game complete/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /end game/i }));
    await waitFor(() => expect(endGame).toHaveBeenCalledWith('completed'));
  });

  it('applies a dealer override through the store', async () => {
    mockStore(baseEvents());
    render(<TableView />);
    fireEvent.click(screen.getByRole('button', { name: /override/i }));
    fireEvent.change(screen.getByLabelText(/dealer repeat/i), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    await waitFor(() =>
      expect(overrideState).toHaveBeenCalledWith({ dealer: 0, prevailing: 'E', dealerRepeat: 2 }),
    );
  });
});
