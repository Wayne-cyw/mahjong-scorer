import { GameClient } from './game-client';

interface GamePageProps {
  params: Promise<{ gameId: string }>;
}

export default async function GamePage({ params }: GamePageProps) {
  const { gameId } = await params;
  return <GameClient gameId={gameId} />;
}
