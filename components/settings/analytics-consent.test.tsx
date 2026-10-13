// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAnalyticsConsent, setAnalyticsConsent } from '@/lib/analytics/consent';
import { AnalyticsConsent } from './analytics-consent';

vi.mock('@/lib/analytics/consent', () => ({
  getAnalyticsConsent: vi.fn(),
  setAnalyticsConsent: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(getAnalyticsConsent).mockResolvedValue(false);
  vi.mocked(setAnalyticsConsent).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AnalyticsConsent', () => {
  it('is off by default and does not save anything on mount', async () => {
    render(<AnalyticsConsent />);
    const toggle = await screen.findByRole('checkbox', { name: /share anonymous usage/i });
    expect(toggle).not.toBeChecked();
    expect(setAnalyticsConsent).not.toHaveBeenCalled();
  });

  it('reflects a stored opt-in', async () => {
    vi.mocked(getAnalyticsConsent).mockResolvedValue(true);
    render(<AnalyticsConsent />);
    expect(await screen.findByRole('checkbox')).toBeChecked();
  });

  it('saves the choice when toggled', async () => {
    render(<AnalyticsConsent />);
    fireEvent.click(await screen.findByRole('checkbox'));
    expect(setAnalyticsConsent).toHaveBeenCalledWith(true);
    expect(await screen.findByRole('checkbox')).toBeChecked();
  });

  it('states that names and photos are never sent', async () => {
    render(<AnalyticsConsent />);
    expect(await screen.findByText(/never.*names.*photos/i)).toBeInTheDocument();
  });
});
