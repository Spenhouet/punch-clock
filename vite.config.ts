import { paraglideVitePlugin } from '@inlang/paraglide-js';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };

const base = process.env.NODE_ENV === 'production' ? (process.env.BASE_PATH ?? '') : '';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION ?? pkg.version)
  },
  plugins: [
    tailwindcss(),
    sveltekit(),
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/lib/paraglide',
      strategy: ['localStorage', 'preferredLanguage', 'baseLocale']
    }),
    SvelteKitPWA({
      registerType: 'autoUpdate',
      // The Android build loads files from the APK, a service worker only gets in the way there
      disable: !!process.env.CAPACITOR,
      manifest: {
        name: 'PunchClock',
        short_name: 'PunchClock',
        description: 'Simple offline time tracker',
        theme_color: '#0f766e',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: `${base}/`,
        scope: `${base}/`,
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        navigateFallback: `${base}/`
      }
    })
  ],
  test: {
    include: ['src/**/*.{test,spec}.ts'],
    environment: 'node',
    setupFiles: ['./vitest-setup.ts'],
    env: { TZ: 'Europe/Berlin' }
  }
});
