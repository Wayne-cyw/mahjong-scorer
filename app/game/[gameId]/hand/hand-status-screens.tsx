import { StatusScreen } from '@/components/hk/status-screen';
import { Button } from '@/components/ui/button';

export function LoadingScreen() {
  return (
    <StatusScreen>
      <p>Loading game…</p>
    </StatusScreen>
  );
}

export interface BackToTableScreenProps {
  message: string;
  isAlert?: boolean;
  onBackToTable: () => void;
}

/** A full-screen message with a single way back to the table. */
export function BackToTableScreen({ message, isAlert, onBackToTable }: BackToTableScreenProps) {
  return (
    <StatusScreen>
      <p role={isAlert ? 'alert' : undefined}>{message}</p>
      <Button type="button" onClick={onBackToTable} className="h-12 px-6 text-base">
        Back to table
      </Button>
    </StatusScreen>
  );
}

export function MissingRulesetScreen() {
  return (
    <StatusScreen>
      <p role="alert">No ruleset for this game.</p>
    </StatusScreen>
  );
}
