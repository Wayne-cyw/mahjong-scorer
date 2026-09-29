// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getDb, loadEvents } from '@/lib/db';
import { initialState } from '@/lib/game';
import { DEFAULT_PRESET_ID } from '@/lib/scoring';
import { useGameStore } from '@/stores/game-store';
import { SetupClient } from '@/app/setup/setup-client';
import { shuffle } from './player-fields';
import { nextCandidates } from './first-dealer';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

function resetStore(): void {
  useGameStore.setState({
    gameId: null,
    events: [],
    state: initialState,
    history: [],
    loading: false,
    error: null,
  });
}

beforeEach(async () => {
  const db = getDb();
  await Promise.all([db.games.clear(), db.events.clear(), db.players.clear(), db.settings.clear()]);
  resetStore();
  push.mockClear();
});

afterEach(() => {
  cleanup();
});

function fillNames(names: readonly [string, string, string, string]): void {
  names.forEach((name, i) => {
    fireEvent.change(screen.getByLabelText(`Seat ${i + 1}`), { target: { value: name } });
  });
}

describe('shuffle', () => {
  it('keeps exactly the same set of players, only reordered', () => {
    const names = ['Alice', 'Bob', 'Cara', 'Dee'];
    const shuffled = shuffle(names, () => 0.999999);
    expect(shuffled).toHaveLength(4);
    expect([...shuffled].sort()).toEqual([...names].sort());
  });

  it('is a pure reorder — the source array is left untouched', () => {
    const names = ['Alice', 'Bob', 'Cara', 'Dee'];
    shuffle(names, () => 0.5);
    expect(names).toEqual(['Alice', 'Bob', 'Cara', 'Dee']);
  });
});

describe('nextCandidates (tie re-roll)', () => {
  it('returns only the seats tied for the highest roll', () => {
    expect(nextCandidates([0, 1, 2, 3], [3, 5, 5, 2])).toEqual([1, 2]);
  });

  it('returns the single winner when nobody is tied', () => {
    expect(nextCandidates([0, 1, 2, 3], [3, 6, 5, 2])).toEqual([1]);
  });

  it('resolves a re-roll round scoped to just the previously tied candidates', () => {
    // Second round rolls only seats 1 and 2, the pair tied in the first round.
    expect(nextCandidates([1, 2], [4, 6])).toEqual([2]);
  });
});

describe('SetupClient: player names', () => {
  it('blocks submitting until all four names are non-empty and distinct', async () => {
    render(<SetupClient />);

    fireEvent.click(screen.getByRole('button', { name: 'Next: rules' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/enter a name/i);

    fillNames(['Alice', 'Bob', 'Cara', 'Alice']);
    fireEvent.click(screen.getByRole('button', { name: 'Next: rules' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/different/i);

    // Still on the players step: the preset radios aren't rendered yet.
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();

    fillNames(['Alice', 'Bob', 'Cara', 'Dee']);
    fireEvent.click(screen.getByRole('button', { name: 'Next: rules' }));

    // Advanced to the preset step, with the default preset preselected.
    const defaultRadio = await screen.findByRole('radio', { name: /Hong Kong, discarder pays/i });
    expect(defaultRadio).toBeChecked();
    // Exactly three named presets, no free-form ruleset editing control.
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });
});

describe('SetupClient: submit flow', () => {
  it('maps names to seats in order and emits GameCreated, SeatsAssigned, FirstDealerChosen, then routes to /game/<id>', async () => {
    render(<SetupClient />);

    fillNames(['Alice', 'Bob', 'Cara', 'Dee']);
    fireEvent.click(screen.getByRole('button', { name: 'Next: rules' }));
    await screen.findByRole('radio', { name: /Hong Kong, discarder pays/i });

    fireEvent.click(screen.getByRole('button', { name: 'Next: first dealer' }));

    // Tap the dealer directly: choose Bob, who sits seat 1 (seat order == entry order).
    fireEvent.click(await screen.findByRole('button', { name: 'Bob' }));

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    const [url] = push.mock.calls[0] as [string];
    expect(url).toMatch(/^\/game\/.+/);
    const gameId = url.replace('/game/', '');

    const events = await loadEvents(gameId);
    expect(events.map((e) => e.payload.type)).toEqual([
      'GameCreated',
      'SeatsAssigned',
      'FirstDealerChosen',
    ]);

    const gameCreated = events[0]!.payload;
    if (gameCreated.type !== 'GameCreated') throw new Error('expected GameCreated');
    expect(gameCreated.ruleset.id).toBe(DEFAULT_PRESET_ID);

    const seatsAssigned = events[1]!.payload;
    if (seatsAssigned.type !== 'SeatsAssigned') throw new Error('expected SeatsAssigned');
    const bobId = gameCreated.playerIds[1]!;
    expect(seatsAssigned.seatOf[bobId]).toBe(1);
    // Every entered name maps to seats 0-3 in the order they were entered.
    expect(Object.values(seatsAssigned.seatOf).sort()).toEqual([0, 1, 2, 3]);

    const firstDealerChosen = events[2]!.payload;
    if (firstDealerChosen.type !== 'FirstDealerChosen')
      throw new Error('expected FirstDealerChosen');
    expect(firstDealerChosen.seat).toBe(1);
  });

  it('ignores a second tap while the first submission is still in flight (no double game creation)', async () => {
    render(<SetupClient />);

    fillNames(['Alice', 'Bob', 'Cara', 'Dee']);
    fireEvent.click(screen.getByRole('button', { name: 'Next: rules' }));
    await screen.findByRole('radio', { name: /Hong Kong, discarder pays/i });

    fireEvent.click(screen.getByRole('button', { name: 'Next: first dealer' }));

    const bobButton = await screen.findByRole('button', { name: 'Bob' });
    // Fire two rapid taps before the first submission settles.
    fireEvent.click(bobButton);
    fireEvent.click(bobButton);

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    // Give any second, erroneous submission a chance to land before asserting it didn't.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(push).toHaveBeenCalledTimes(1);

    const [url] = push.mock.calls[0] as [string];
    const gameId = url.replace('/game/', '');
    const events = await loadEvents(gameId);
    expect(events.map((e) => e.payload.type)).toEqual([
      'GameCreated',
      'SeatsAssigned',
      'FirstDealerChosen',
    ]);

    const db = getDb();
    expect(await db.games.count()).toBe(1);
  });
});
