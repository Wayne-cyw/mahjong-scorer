import { HistoryClient } from './history-client';

interface HistoryPageProps {
  params: Promise<{ gameId: string }>;
}

export default async function HistoryPage({ params }: HistoryPageProps) {
  const { gameId } = await params;
  return <HistoryClient gameId={gameId} />;
}
