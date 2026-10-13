// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initialState, type GameState } from '@/lib/game';
import { RecognizeError, type RecognitionResult } from '@/lib/recognition';
import { recognize } from '@/lib/recognition/client/recognize-client';
import { resizeForUpload } from '@/lib/recognition/client/resize';
import { getPreset } from '@/lib/scoring';
import { tileName, type Tile } from '@/lib/tiles';
import type { GameStoreState } from '@/stores/game-store';
import { useGameStore } from '@/stores/game-store';
import { listPlayers } from '@/lib/db';
import { HandClient } from '@/app/game/[gameId]/hand/hand-client';

vi.mock('@/stores/game-store', () => ({ useGameStore: vi.fn() }));
vi.mock('@/lib/db', () => ({ listPlayers: vi.fn() }));
vi.mock('@/lib/recognition/client/recognize-client', () => ({ recognize: vi.fn() }));
vi.mock('@/lib/recognition/client/resize', () => ({ resizeForUpload: vi.fn() }));

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const ruleset = getPreset('hk-discarder-pays');
const recordWin = vi.fn();
const recordDraw = vi.fn();
const loadGame = vi.fn();

// An all-pungs hand: three concealed pungs + a red dragon pung + z1 pair, plus one flower.
const READ: RecognitionResult = {
  isMahjongHand: true,
  concealed: ['m1', 'm1', 'm1', 'p4', 'p4', 'p4', 's7', 's7', 's7', 'z7', 'z7', 'z7', 'z1', 'z1'],
  melds: [],
  bonus: ['f1'],
  uncertain: [{ row: 'concealed', index: 4 }],
  warnings: [],
};

const name = (code: string): string => {
  const n = tileName(code as Tile);
  return `${n.en} ${n.zh}`;
};

const photo = new File([new Uint8Array([9])], 'p.jpg', { type: 'image/jpeg' });

function mockStore(): void {
  const state: GameState = {
    ...initialState,
    status: 'playing',
    playerIds: ['p0', 'p1', 'p2', 'p3'],
    seatOf: { p0: 0, p1: 1, p2: 2, p3: 3 },
    scores: [2000, 2000, 2000, 2000],
    ruleset,
  };
  const storeValue = {
    state,
    error: null,
    events: [{ seq: 0 }],
    loadGame,
    recordWin,
    recordDraw,
  } as unknown as GameStoreState;
  vi.mocked(useGameStore).mockImplementation(
    (selector: (s: GameStoreState) => unknown) => selector(storeValue) as never,
  );
  Object.assign(vi.mocked(useGameStore), { getState: () => storeValue });
}

/** Opens the hand flow as Player 1 winning by self-draw, ready for the camera step. */
async function openCameraStep(): Promise<void> {
  render(<HandClient gameId="game-1" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Player 1' }));
  fireEvent.click(screen.getByRole('button', { name: /self-drawn/i }));
}

const takePhoto = async (): Promise<void> => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await act(async () => {
    fireEvent.change(input, { target: { files: [photo] } });
  });
};

const markWinning = (code: string): void => {
  fireEvent.click(
    screen.getAllByRole('button', { name: `Mark ${name(code)} as winning tile` })[0]!,
  );
};

describe('hand flow with the camera', () => {
  beforeEach(() => {
    recordWin.mockReset().mockResolvedValue(true);
    recordDraw.mockReset().mockResolvedValue(true);
    loadGame.mockReset().mockResolvedValue(undefined);
    push.mockClear();
    vi.mocked(listPlayers).mockResolvedValue([]);
    vi.mocked(resizeForUpload).mockResolvedValue(new Blob([new Uint8Array([1])]));
    URL.createObjectURL = vi.fn(() => 'blob:photo');
    URL.revokeObjectURL = vi.fn();
    mockStore();
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows the camera step before the review screen', async () => {
    await openCameraStep();
    expect(screen.getByRole('button', { name: /take photo/i })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Hand' })).not.toBeInTheDocument();
  });

  it('pre-fills the review screen from the photo and outlines uncertain tiles', async () => {
    vi.mocked(recognize).mockResolvedValue(READ);
    await openCameraStep();
    await takePhoto();

    const hand = await screen.findByRole('region', { name: 'Hand' });
    const tiles = within(hand).getAllByRole('button', { name: /as winning tile$/ });
    expect(tiles).toHaveLength(14);
    // Index 4 was flagged: the tile image carries the uncertain state.
    const flagged = hand.querySelectorAll('[data-state="uncertain"]');
    expect(flagged).toHaveLength(1);
    expect(screen.getByRole('img', { name: /photo of your hand/i })).toHaveAttribute(
      'src',
      'blob:photo',
    );
    // The model never picks the winning tile, so Confirm is not available yet (ADR-46).
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
  });

  it('records a photo win with zero corrections once the player marks the winning tile', async () => {
    vi.mocked(recognize).mockResolvedValue(READ);
    await openCameraStep();
    await takePhoto();
    await screen.findByRole('region', { name: 'Hand' });

    markWinning('z1');
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);

    await waitFor(() => expect(recordWin).toHaveBeenCalledTimes(1));
    const args = recordWin.mock.calls[0]![0];
    expect(args).toMatchObject({ winner: 0, method: 'photo', corrections: 0 });
    expect(args.startedAt).toEqual(expect.any(Number));
    expect(args.hand.bonus).toEqual(['f1']);
    expect(args.hand.winningTile).toBe('z1');
  });

  it('counts a corrected misread as one correction and drops the highlight when tiles shift', async () => {
    // The photo read one s7 as an s8, and flagged it as uncertain.
    const misread: RecognitionResult = {
      ...READ,
      concealed: [
        'm1',
        'm1',
        'm1',
        'p4',
        'p4',
        'p4',
        's7',
        's7',
        's8',
        'z7',
        'z7',
        'z7',
        'z1',
        'z1',
      ],
      uncertain: [{ row: 'concealed', index: 8 }],
    };
    vi.mocked(recognize).mockResolvedValue(misread);
    await openCameraStep();
    await takePhoto();
    const hand = await screen.findByRole('region', { name: 'Hand' });
    expect(hand.querySelectorAll('[data-state="uncertain"]')).toHaveLength(1);

    fireEvent.click(within(hand).getByRole('button', { name: 'Remove' }));
    // The outlined tile is announced as hard to read, not just ringed in amber.
    fireEvent.click(
      within(hand).getByRole('button', { name: `Remove ${name('s8')} (hard to read)` }),
    );
    fireEvent.click(within(hand).getByRole('button', { name: name('s7') }));
    // Positions are no longer reliable once a tile was removed, so the outline goes.
    expect(hand.querySelectorAll('[data-state="uncertain"]')).toHaveLength(0);

    fireEvent.click(within(hand).getByRole('button', { name: 'Mark winning' }));
    markWinning('z1');
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);

    await waitFor(() => expect(recordWin).toHaveBeenCalled());
    expect(recordWin.mock.calls[0]![0]).toMatchObject({ method: 'photo', corrections: 1 });
  });

  it('stays on the camera step with a friendly message when no hand is in the photo', async () => {
    vi.mocked(recognize).mockResolvedValue({ ...READ, isMahjongHand: false, concealed: [] });
    await openCameraStep();
    await takePhoto();

    expect(await screen.findByText(/couldn.t see a mahjong hand/i)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Hand' })).not.toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo');
  });

  it('falls back to manual entry with the photo beside it when recognition fails', async () => {
    vi.mocked(recognize).mockRejectedValue(new RecognizeError('timeout'));
    await openCameraStep();
    await takePhoto();

    const hand = await screen.findByRole('region', { name: 'Hand' });
    expect(screen.getByText(/took too long/i)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /photo of your hand/i })).toBeInTheDocument();
    expect(within(hand).queryAllByRole('button', { name: /as winning tile$/ })).toHaveLength(0);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it('records a manual win when the player skips the camera', async () => {
    await openCameraStep();
    fireEvent.click(screen.getByRole('button', { name: /skip, enter manually/i }));
    expect(recognize).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /enter fan directly/i }));
    for (let i = 0; i < ruleset.minFan; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Increase fan' }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(recordWin).toHaveBeenCalledTimes(1));
    expect(recordWin.mock.calls[0]![0]).toMatchObject({ method: 'manual', fan: ruleset.minFan });
    expect(recordWin.mock.calls[0]![0].corrections).toBeUndefined();
  });

  it('releases the photo when the player leaves the flow', async () => {
    vi.mocked(recognize).mockResolvedValue(READ);
    await openCameraStep();
    await takePhoto();
    await screen.findByRole('region', { name: 'Hand' });
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    cleanup();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:photo');
  });
});
