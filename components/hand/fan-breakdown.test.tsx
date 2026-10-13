// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ScoreResult } from '@/lib/scoring';
import { FanBreakdown } from './fan-breakdown';

afterEach(cleanup);

const seatLabel = (s: number) => `Seat ${s}`;

describe('FanBreakdown', () => {
  it('lists fan lines in both languages with totals and payments', () => {
    const result: ScoreResult = {
      valid: true,
      fan: 4,
      scoredFan: 4,
      breakdown: [{ ruleId: 'all-pungs', nameEn: 'All Pungs', nameZh: '對對糊', fan: 3 }],
      basePoints: 8,
      payments: [16, -8, -4, -4],
    };
    render(<FanBreakdown result={result} minimumFan={3} capFan={10} seatLabel={seatLabel} />);
    expect(screen.getByText('All Pungs')).toBeTruthy();
    expect(screen.getByText('對對糊')).toBeTruthy();
    expect(screen.getByText(/Total 4 fan/)).toBeTruthy();
    expect(screen.getByText(/minimum 3, cap 10/)).toBeTruthy();
    expect(screen.getByText('+16')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a clear invalid reason and no payments', () => {
    const result: ScoreResult = {
      valid: false,
      reason: 'below-minimum',
      fan: 1,
      scoredFan: 1,
      breakdown: [],
      basePoints: 0,
      payments: [0, 0, 0, 0],
    };
    render(<FanBreakdown result={result} minimumFan={3} capFan={10} seatLabel={seatLabel} />);
    expect(screen.getByRole('alert').textContent).toMatch(/below the minimum/i);
    expect(screen.queryByLabelText('Payments')).toBeNull();
  });
});
