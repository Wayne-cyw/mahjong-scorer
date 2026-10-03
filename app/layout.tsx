import type { Metadata, Viewport } from 'next';
import { UpdatePrompt } from '@/components/pwa/update-prompt';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mahjong Score Tracker',
  description: 'Local-first Hong Kong mahjong score tracker',
  icons: { apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = { themeColor: '#0f5132' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <UpdatePrompt />
      </body>
    </html>
  );
}
