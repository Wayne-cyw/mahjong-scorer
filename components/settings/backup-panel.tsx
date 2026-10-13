'use client';

import { useState } from 'react';
import { MAX_BACKUP_BYTES, exportBackup, importBackup } from '@/lib/db';
import { Button } from '@/components/ui/button';

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Could not read the selected file'));
    reader.readAsText(file);
  });
}

export interface BackupPanelProps {
  /** Called after a successful import so the caller can refresh what it shows. */
  onImported?: () => void;
}

/** Export all games as a JSON file, or import one back (ADR-53). Import is all-or-nothing. */
export function BackupPanel({ onImported }: BackupPanelProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async (): Promise<void> => {
    setMessage(null);
    setError(null);
    try {
      const json = await exportBackup();
      const fileName = `mahjong-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const file = new File([json], fileName, { type: 'application/json' });
      if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Mahjong backup' });
      } else {
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setMessage('Backup exported.');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleImport = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    setMessage(null);
    setError(null);
    // Check the size before reading, so an oversize file is never loaded into memory.
    if (file.size > MAX_BACKUP_BYTES) {
      setError(`Backup file is too large (${file.size} bytes, max ${MAX_BACKUP_BYTES})`);
      return;
    }
    try {
      const counts = await importBackup(await readFileText(file));
      const skipped =
        counts.skippedGames > 0 || counts.skippedEvents > 0
          ? ` (skipped ${counts.skippedGames} games and ${counts.skippedEvents} events already here)`
          : '';
      setMessage(`Imported ${counts.games} games and ${counts.events} events${skipped}.`);
      onImported?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <section aria-label="Backup" className="flex flex-col gap-3">
      <h2 className="font-display text-xl font-black">Backup</h2>
      <Button
        type="button"
        variant="outline"
        onClick={() => void handleExport()}
        className="h-12 text-base"
      >
        Export backup
      </Button>
      <label className="text-ivory-dim flex min-h-12 flex-col gap-1 text-base">
        Import backup
        <input
          type="file"
          accept="application/json,.json"
          onChange={(e) => {
            void handleImport(e.target.files?.[0]);
            e.target.value = '';
          }}
          className="text-foreground file:bg-felt-raised min-h-12 text-base file:mr-3 file:h-12 file:rounded-md file:border-0 file:px-4 file:font-bold"
        />
      </label>
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="bg-lacquer text-ivory rounded-md p-3 font-medium">
          {error}
        </p>
      )}
    </section>
  );
}
