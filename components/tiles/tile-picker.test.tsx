// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TilePicker } from './tile-picker';

afterEach(cleanup);

describe('TilePicker', () => {
  it('renders all 42 tiles as labelled buttons', () => {
    render(<TilePicker onPick={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(42);
    expect(screen.getByRole('button', { name: /East Wind 東風/ })).toBeTruthy();
  });

  it('calls onPick with the tile code', () => {
    const onPick = vi.fn();
    render(<TilePicker onPick={onPick} />);
    fireEvent.click(screen.getByRole('button', { name: /5 Dot/ }));
    expect(onPick).toHaveBeenCalledWith('p5');
  });

  it('disables a tile with 4 copies used but not one with 3', () => {
    const onPick = vi.fn();
    render(<TilePicker onPick={onPick} used={['m1', 'm1', 'm1', 'm1', 'm2', 'm2', 'm2']} />);
    const m1 = screen.getByRole('button', { name: /1 Character/ }) as HTMLButtonElement;
    const m2 = screen.getByRole('button', { name: /2 Character/ }) as HTMLButtonElement;
    expect(m1.disabled).toBe(true);
    expect(m2.disabled).toBe(false);
    fireEvent.click(m1);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('disables a bonus tile once picked', () => {
    render(<TilePicker onPick={() => {}} used={['f1']} />);
    expect((screen.getByRole('button', { name: /Plum/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
