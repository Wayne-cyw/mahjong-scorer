// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Tile } from './tile';

afterEach(cleanup);

describe('Tile', () => {
  it('exposes the selected state in its accessible label', () => {
    render(<Tile code="m1" state="selected" />);
    expect(screen.getByRole('img', { name: /1 Character.*\(selected\)/ })).toBeTruthy();
  });

  it('keeps the plain label when normal and marks uncertain', () => {
    const { rerender } = render(<Tile code="m1" />);
    expect(screen.getByRole('img').getAttribute('aria-label')).not.toMatch(/\(/);
    rerender(<Tile code="m1" state="uncertain" />);
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/\(uncertain\)/);
  });

  it('references the sprite', () => {
    const { container } = render(<Tile code="m1" />);
    expect(container.querySelector('use')?.getAttribute('href')).toBe('/tiles.svg#m1');
  });
});
