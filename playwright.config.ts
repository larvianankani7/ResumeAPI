import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 1200000,
  fullyParallel: true,
  workers: 10,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000'
  }
});