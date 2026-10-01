import { defineConfig } from 'vite';

export default defineConfig(({ command, isPreview }) => ({
  // GitHub project Pages lives below /Rebel500/; local development stays at /.
  base: command === 'build' || isPreview ? '/Rebel500/' : '/',
}));
