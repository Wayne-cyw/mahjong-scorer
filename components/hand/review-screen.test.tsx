// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPreset } from '@/lib/scoring';
import { tileName, type Seat, type Tile } from '@/lib/tiles';
import { ReviewScreen } from '@/components/hand/review-screen';

const ruleset = getPreset('hk-discarder-pays');

const nameOf = (code: string): string => {
  const n = tileName(code as Tile);
  return `${n.en} ${n.zh}`;
};

const seatLabel = (seat: Seat): string => `Player ${seat + 1}`;

function renderReview(overrides: Partial<Parameters<typeof ReviewScreen>[0]> = {}) {
  const onConfirm = vi.fn();
  const onEnterFanDirectly = vi.fn();
  const onBack = vi.fn();
  render(
    <ReviewScreen
      winner={0}
      dealer={0}
      prevailing="E"
      ruleset={ruleset}
      seatLabel={seatLabel}
      onConfirm={onConfirm}
      onEnterFanDirectly={onEnterFanDirectly}
      onBack={onBack}
      {...overrides}
    />,
  );
  return { onConfirm, onEnterFanDirectly, onBack };
}

/** Taps a tile in the "Add a tile" picker (its label is exactly "<English> <Chinese>"). */
function add(code: string): void {
  const hand = screen.getByRole('region', { name: 'Hand' });
  fireEvent.click(within(hand).getByRole('button', { name: nameOf(code) }));
}

function addAll(codes: string[]): void {
  for (const code of codes) add(code);
}

// Four sets and a pair of dragons: 14 tiles, a complete concealed hand.
const COMPLETE = [
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

function markWinning(name: string): void {
  // A tile held twice appears twice; either copy marks the same winning tile.
  const [first] = screen.getAllByRole('button', { name: `Mark ${name} as winning tile` });
  if (first) fireEvent.click(first);
}

describe('ReviewScreen', () => {
  afterEach(cleanup);

  it('disables Confirm and prompts for tiles before there is a winning tile', () => {
    renderReview();
    expect(screen.getByRole('button', { name: /^confirm$/i })).toBeDisabled();
    expect(screen.getByText(/mark the winning tile/i)).toBeInTheDocument();
  });

  it('explains an invalid hand and keeps Confirm disabled', () => {
    renderReview();
    addAll(['m1', 'm2', 'm3']);
    markWinning(nameOf('m3'));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^confirm$/i })).toBeDisabled();
  });

  it('re-scores live and confirms with the scored fan, hand and engine version', () => {
    const { onConfirm } = renderReview();
    addAll(COMPLETE);
    markWinning(nameOf('z7'));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Payments' })).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: /^confirm$/i });
    expect(confirm).toBeEnabled();

    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const arg = onConfirm.mock.calls[0]?.[0];
    expect(arg.hand.winningTile).toBe('z7');
    expect(arg.hand.selfDrawn).toBe(true);
    expect(arg.hand.concealed).toHaveLength(14);
    expect(arg.fan).toBeGreaterThanOrEqual(ruleset.minFan);
    expect(arg.breakdown.length).toBeGreaterThan(0);
    expect(arg.engineVersion).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('scores a discard win as not self-drawn', () => {
    const { onConfirm } = renderReview({ discarder: 2 as Seat });
    addAll(COMPLETE);
    markWinning(nameOf('z7'));
    fireEvent.click(screen.getByRole('button', { name: /^confirm$/i }));
    expect(onConfirm.mock.calls[0]?.[0].hand.selfDrawn).toBe(false);
  });

  it('changes the score when a situation flag is toggled', () => {
    renderReview();
    addAll(COMPLETE);
    markWinning(nameOf('z7'));
    const total = () => screen.getByText(/^Total/).textContent;
    const before = total();
    fireEvent.click(screen.getByRole('checkbox', { name: /last tile/i }));
    expect(total()).not.toBe(before);
  });

  it('hides rare flags behind More', () => {
    renderReview();
    expect(screen.queryByRole('checkbox', { name: /heavenly/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /robbing/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^more$/i }));
    expect(screen.getByRole('checkbox', { name: /heavenly/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /earthly/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /robbing/i })).toBeInTheDocument();
  });

  it('disables a tile once all four copies are placed', () => {
    renderReview();
    addAll(['m1', 'm1', 'm1', 'm1']);
    expect(screen.getByRole('button', { name: nameOf('m1') })).toBeDisabled();
  });

  it('removes a tile in remove mode and clears the winning tile with it', () => {
    renderReview();
    addAll(['m1', 'm2']);
    markWinning(nameOf('m2'));
    fireEvent.click(screen.getByRole('button', { name: /^remove$/i }));
    fireEvent.click(screen.getByRole('button', { name: `Remove ${nameOf('m2')}` }));
    expect(screen.queryByText(/winning tile:/i)).not.toBeInTheDocument();
    expect(screen.getByText(/mark the winning tile/i)).toBeInTheDocument();
  });

  it('adds a declared pung and lets it be toggled concealed', () => {
    renderReview();
    fireEvent.click(screen.getByRole('button', { name: /add pung/i }));
    const melds = screen.getByRole('region', { name: 'Melds' });
    const picker = within(melds).getByRole('button', { name: nameOf('z5') });
    fireEvent.click(picker);
    const toggle = screen.getByRole('button', { name: /pung white dragon.*: exposed/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: /pung white dragon.*: concealed/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('exposes Back and Enter fan directly without confirming anything', () => {
    const { onBack, onEnterFanDirectly, onConfirm } = renderReview();
    fireEvent.click(screen.getByRole('button', { name: /enter fan directly/i }));
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }));
    expect(onEnterFanDirectly).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
