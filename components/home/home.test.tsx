// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { importBackup, listGames } from '@/lib/db';
import HomePage from '@/app/page';

vi.mock('@/lib/db', () => ({
  listGames: vi.fn(),
  importBackup: vi.fn(),
  exportBackup: vi.fn(),
}));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

afterEach(cleanup);

describe('HomePage', () => {
  it('reloads the game list after a successful import', async () => {
    vi.mocked(listGames).mockResolvedValueOnce([]);
    render(<HomePage />);
    await screen.findByText(/no games yet/i);

    vi.mocked(importBackup).mockResolvedValue({ games: 1, events: 5 });
    vi.mocked(listGames).mockResolvedValue([
      { id: 'g9', createdAt: 1_700_000_000_000, status: 'playing', name: 'Imported game' },
    ]);
    const file = new File(['{}'], 'b.json', { type: 'application/json' });
    fireEvent.change(screen.getByLabelText(/import backup/i), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText('Imported game')).toBeInTheDocument());
  });
});
