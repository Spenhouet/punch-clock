import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      // Capacitor needs an index.html entry point, GitHub Pages serves 404.html for unknown paths
      fallback: process.env.CAPACITOR ? 'index.html' : '404.html'
    }),
    paths: {
      base: process.env.NODE_ENV === 'production' ? (process.env.BASE_PATH ?? '') : ''
    },
    serviceWorker: { register: false }
  }
};

export default config;
