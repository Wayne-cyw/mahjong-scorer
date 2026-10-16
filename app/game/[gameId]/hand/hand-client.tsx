'use client';

import { useRouter } from 'next/navigation';
import type { Seat } from '@/lib/tiles';
import { seatWind } from '@/lib/game';
import { useGameStore } from '@/stores/game-store';
import { Screen } from '@/components/hk/screen';
import { Button } from '@/components/ui/button';
import { CameraCapture } from '@/components/hand/camera-capture';
import { WinnerPicker, type WinnerPickerResult } from '@/components/hand/winner-picker';
import { ReviewScreen, type ReviewConfirmation } from '@/components/hand/review-screen';
import { useGameLoader, usePlayerNames } from './use-game-loader';
import { useHandDraft } from './use-hand-draft';
import { useHandSubmission } from './use-hand-submission';
import { DrawSection } from './draw-section';
import { WinnerSummary } from './winner-summary';
import { FanEntryStep, isFanInRange } from './fan-entry-step';
import { BackToTableScreen, LoadingScreen, MissingRulesetScreen } from './hand-status-screens';

export interface HandClientProps {
  gameId: string;
}

/** Seats are 0-based; people count players from 1. */
const fallbackSeatLabel = (seat: Seat): string => `Player ${seat + 1}`;

/**
 * The `/game/[gameId]/hand` flow (PD-09, PD-13, PD-14): tap the winner, then
 * self-drawn/discard, then (for a discard) the discarder, then photograph the
 * hand (or skip), then build or check the hand on the tile review screen (or
 * enter fan directly) before an explicit Confirm, which is the only thing that
 * appends a `HandWon` event. A Draw button appends `HandDrawn` after its own
 * confirmation. Cancelling at any point before that appends nothing and returns
 * to the table. A refused or failed write keeps the user on this page with the
 * reason shown and Cancel available; only a failed load replaces the flow with
 * a full-screen error.
 */
export function HandClient({ gameId }: HandClientProps) {
  const router = useRouter();
  const state = useGameStore((s) => s.state);
  const recordWin = useGameStore((s) => s.recordWin);
  const recordDraw = useGameStore((s) => s.recordDraw);
  const storeError = useGameStore((s) => s.error);
  const eventCount = useGameStore((s) => s.events.length);

  const { initializing, loadFailed } = useGameLoader(gameId);
  const playerNames = usePlayerNames(state.playerIds);
  const draft = useHandDraft();
  const { submitting, submitError, clearError, submit } = useHandSubmission();
  const { selection, fan, entry, recognition } = draft;
  const ruleset = state.ruleset;

  const playerIdBySeat = new Map<Seat, string>();
  for (const [playerId, seat] of Object.entries(state.seatOf)) {
    playerIdBySeat.set(seat, playerId);
  }
  const seatLabel = (seat: Seat): string => {
    const playerId = playerIdBySeat.get(seat);
    return (playerId && playerNames[playerId]) || fallbackSeatLabel(seat);
  };

  const goToTable = (): void => {
    router.push(`/game/${gameId}`);
  };

  const handleWinnerComplete = (result: WinnerPickerResult): void => {
    draft.selectWinner(result);
    clearError();
  };

  const handleBackToWinner = (): void => {
    draft.backToWinner();
    clearError();
  };

  const submitWin = (win: { fan: number } & Partial<ReviewConfirmation>): Promise<void> => {
    if (!selection) return Promise.resolve();
    const write = () =>
      recordWin({
        winner: selection.winner,
        discarder: selection.discarder,
        method: recognition.draft ? 'photo' : 'manual',
        startedAt: draft.getStartedAt(),
        ...win,
      });
    return submit(write, goToTable);
  };

  const handleFanConfirm = (): void => {
    if (!ruleset || !isFanInRange(fan, ruleset)) return;
    void submitWin({ fan });
  };

  const handleReviewConfirm = (confirmation: ReviewConfirmation): void => {
    void submitWin(confirmation);
  };

  const handleDrawConfirmed = (): Promise<void> => submit(recordDraw, goToTable);

  if (initializing) return <LoadingScreen />;

  if (loadFailed || eventCount === 0) {
    return (
      <BackToTableScreen
        isAlert
        message={loadFailed ? (storeError ?? 'Could not load this game.') : 'Game not found.'}
        onBackToTable={goToTable}
      />
    );
  }

  if (state.status !== 'playing') {
    return (
      <BackToTableScreen
        message="This game is not in progress, so no hand can be recorded."
        onBackToTable={goToTable}
      />
    );
  }

  if (!ruleset) return <MissingRulesetScreen />;

  return (
    <Screen
      title="Hand over"
      glyph="胡"
      action={
        <Button
          type="button"
          variant="outline"
          onClick={goToTable}
          disabled={submitting}
          className="h-11 px-4 text-base"
        >
          Cancel
        </Button>
      }
    >
      {submitError && (
        <p role="alert" className="bg-lacquer text-ivory rounded-md p-3 font-medium">
          {submitError}
        </p>
      )}

      {selection === null ? (
        <>
          <WinnerPicker
            seatLabel={seatLabel}
            windOf={(seat) => seatWind(seat, state.dealer)}
            onComplete={handleWinnerComplete}
          />
          <DrawSection submitting={submitting} onConfirmDraw={handleDrawConfirmed} />
        </>
      ) : (
        <>
          <WinnerSummary selection={selection} seatLabel={seatLabel} />

          {entry === 'camera' && (
            <>
              <CameraCapture
                onRecognized={draft.handleRecognized}
                onFailure={draft.handleCameraFailure}
                onSkip={() => draft.openReview({ warnings: [] })}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleBackToWinner}
                className="h-12 px-4 text-base"
              >
                Back
              </Button>
            </>
          )}

          {entry !== 'camera' && (
            <div hidden={entry !== 'tiles'}>
              <ReviewScreen
                key={draft.reviewKey}
                winner={selection.winner}
                discarder={selection.discarder}
                dealer={state.dealer}
                prevailing={state.prevailing}
                ruleset={ruleset}
                seatLabel={seatLabel}
                onConfirm={handleReviewConfirm}
                onEnterFanDirectly={() => draft.setEntry('fan')}
                onBack={handleBackToWinner}
                submitting={submitting}
                initialDraft={recognition.draft}
                initialUncertain={recognition.uncertain}
                warnings={recognition.warnings}
                notice={recognition.notice}
                photoUrl={recognition.photoUrl}
              />
            </div>
          )}

          {entry === 'fan' && (
            <FanEntryStep
              selection={selection}
              ruleset={ruleset}
              fan={fan}
              submitting={submitting}
              seatLabel={seatLabel}
              onFanChange={draft.setFan}
              onBack={handleBackToWinner}
              onConfirm={handleFanConfirm}
              onScoreFromTiles={() => draft.setEntry('tiles')}
            />
          )}
        </>
      )}
    </Screen>
  );
}
