// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_BACKUP_BYTES, importBackup } from '@/lib/db';
import { BackupPanel } from './backup-panel';

vi.mock('@/lib/db', () => ({
  MAX_BACKUP_BYTES: 5 * 1024 * 1024,
  importBackup: vi.fn(),
  exportBackup: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function chooseFile(file: File): void {
  fireEvent.change(screen.getByLabelText(/import backup/i), { target: { files: [file] } });
}

describe('BackupPanel import', () => {
  it('rejects an oversize file by its size, without reading it', async () => {
    const readAsText = vi.spyOn(FileReader.prototype, 'readAsText');
    const file = new File(['{}'], 'huge.json', { type: 'application/json' });
    Object.defineProperty(file, 'size', { value: MAX_BACKUP_BYTES + 1 });
    render(<BackupPanel />);

    chooseFile(file);

    expect(await screen.findByRole('alert')).toHaveTextContent(/too large/i);
    expect(readAsText).not.toHaveBeenCalled();
    expect(importBackup).not.toHaveBeenCalled();
  });

  it('reports imported and skipped counts', async () => {
    vi.mocked(importBackup).mockResolvedValue({
      games: 1,
      events: 4,
      skippedGames: 2,
      skippedEvents: 9,
    });
    render(<BackupPanel />);

    chooseFile(new File(['{}'], 'b.json', { type: 'application/json' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Imported 1 games and 4 events (skipped 2 games and 9 events already here).',
    );
  });
});
