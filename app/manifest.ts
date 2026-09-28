import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mahjong Score Tracker',
    short_name: 'Mahjong',
    start_url: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#ffffff',
    theme_color: '#0f5132',
    // TODO: add 192px, 512px and maskable icons (ADR, manifest section).
    icons: [],
  };
}
