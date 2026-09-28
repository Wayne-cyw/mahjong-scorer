import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mahjong Score Tracker',
  description: 'Local-first Hong Kong mahjong score tracker',
};

export const viewport: Viewport = { themeColor: '#0f5132' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
