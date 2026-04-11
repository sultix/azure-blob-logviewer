/// <reference types="vitest" />
import { resolve } from 'node:path';
import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [angular()],
  resolve: {
    alias: {
      '@app': resolve(__dirname, 'src/app'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
  },
});
