// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { importBackup, listGames } from '@/lib/db';
import HomePage from '@/app/page';
import { GameList } from './game-list';

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

describe('GameList', () => {
  it('offers Continue for playing and complete games, but not ended or setup ones', () => {
    render(
      <GameList
        games={[
          { id: 'g-play', createdAt: 1, status: 'playing', name: 'Playing game' },
          { id: 'g-done', createdAt: 2, status: 'complete', name: 'Complete game' },
          { id: 'g-end', createdAt: 3, status: 'ended', name: 'Ended game' },
          { id: 'g-setup', createdAt: 4, status: 'setup', name: 'Setup game' },
        ]}
      />,
    );
    const hrefs = screen
      .getAllByRole('link', { name: /continue/i })
      .map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(['/game/g-play', '/game/g-done']);
  });
});
