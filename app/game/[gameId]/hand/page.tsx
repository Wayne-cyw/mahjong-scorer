import { HandClient } from './hand-client';

interface HandPageProps {
  params: Promise<{ gameId: string }>;
}

export default async function HandPage({ params }: HandPageProps) {
  const { gameId } = await params;
  return <HandClient gameId={gameId} />;
}
