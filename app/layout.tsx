import type { Metadata, Viewport } from 'next';
import { MotionProvider } from '@/components/motion/motion-provider';
import { UpdatePrompt } from '@/components/pwa/update-prompt';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mahjong Score Tracker',
  description: 'Local-first Hong Kong mahjong score tracker',
  icons: { apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = { themeColor: '#0c3a2f' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <MotionProvider>
          {children}
          <UpdatePrompt />
        </MotionProvider>
      </body>
    </html>
  );
}
