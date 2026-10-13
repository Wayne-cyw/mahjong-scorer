import { SummaryClient } from './summary-client';

interface SummaryPageProps {
  params: Promise<{ gameId: string }>;
}

export default async function SummaryPage({ params }: SummaryPageProps) {
  const { gameId } = await params;
  return <SummaryClient gameId={gameId} />;
}
