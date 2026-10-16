'use client';

import { useEffect, useRef, useState } from 'react';
import { RecognizeError, type RecognitionResult, type RecognizeErrorCode } from '@/lib/recognition';
import { recognize } from '@/lib/recognition/client/recognize-client';
import { resizeForUpload } from '@/lib/recognition/client/resize';
import { Button } from '@/components/ui/button';
import { LayoutGuide } from '@/components/hand/layout-guide';

export interface CameraCaptureProps {
  /**
   * A hand was read. The caller owns `photoUrl` from here on and must revoke it when done.
   */
  onRecognized: (result: RecognitionResult, photoUrl: string) => void;
  /**
   * Anything went wrong (offline, timeout, bad output): fall back to the manual picker with
   * the photo beside it. The caller owns `photoUrl` and must revoke it when done.
   */
  onFailure: (code: RecognizeErrorCode, photoUrl: string) => void;
  /** The player chose to enter the hand manually. Always available. */
  onSkip: () => void;
}

type Phase = 'idle' | 'working' | 'no-hand';

/**
 * Camera step (ADR-41): shows the layout guide, then opens the native camera through a file
 * input. The photo is resized on the phone and sent for recognition. It lives only as an object
 * URL in memory (PD-27): this component revokes it unless it was handed to a callback.
 */
export function CameraCapture({ onRecognized, onFailure, onSkip }: CameraCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingUrl = useRef<string | null>(null);
  const alive = useRef(true);
  const inFlight = useRef<AbortController | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');

  const discardPending = (): void => {
    if (pendingUrl.current) {
      URL.revokeObjectURL(pendingUrl.current);
      pendingUrl.current = null;
    }
  };

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      // Leaving the step cancels the upload instead of sending and billing a photo nobody uses.
      inFlight.current?.abort();
      discardPending();
    };
  }, []);

  const openCamera = (): void => {
    inputRef.current?.click();
  };

  const handleFile = async (file: File): Promise<void> => {
    discardPending();
    const url = URL.createObjectURL(file);
    pendingUrl.current = url;
    setPhase('working');

    const fail = (code: RecognizeErrorCode): void => {
      if (!alive.current) return;
      pendingUrl.current = null;
      onFailure(code, url);
    };

    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    let resized: Blob;
    try {
      resized = await resizeForUpload(file);
    } catch {
      // The file could not be decoded or re-encoded; this is not a connectivity problem.
      fail('not-a-photo');
      return;
    }

    let result: RecognitionResult;
    try {
      result = await recognize(resized, controller.signal);
    } catch (error) {
      fail(error instanceof RecognizeError ? error.code : 'unavailable');
      return;
    }
    if (!alive.current) return;

    if (!result.isMahjongHand) {
      discardPending();
      setPhase('no-hand');
      return;
    }
    pendingUrl.current = null;
    onRecognized(result, url);
  };

  return (
    <section aria-label="Photo of the hand" className="flex flex-col gap-4">
      <LayoutGuide />

      {phase === 'no-hand' && (
        <p role="alert" className="bg-lacquer text-ivory rounded-md p-3 text-base font-medium">
          We couldn&apos;t see a mahjong hand in that photo. Lay the tiles out as shown and try
          again, or enter the hand manually.
        </p>
      )}
      {phase === 'working' && (
        <p role="status" className="anim-lamp bg-cream-raised rounded-md p-3 text-base font-bold">
          Reading your tiles…
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void handleFile(file);
        }}
      />

      <Button
        type="button"
        onClick={openCamera}
        disabled={phase === 'working'}
        className="h-16 px-4 text-xl"
      >
        {phase === 'no-hand' ? 'Try again' : 'Take photo'}
      </Button>
      <Button type="button" variant="outline" onClick={onSkip} className="h-12 px-4 text-base">
        Skip, enter manually
      </Button>
    </section>
  );
}
