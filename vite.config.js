import { defineConfig } from 'vite';
import { cp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

function copyClassicScripts() {
  return {
    name: 'copy-classic-scripts',
    apply: 'build',
    async closeBundle() {
      await mkdir(resolve('dist'), { recursive: true });
      await cp(resolve('js'), resolve('dist/js'), { recursive: true });
    }
  };
}

export default defineConfig({
  appType: 'mpa',
  plugins: [copyClassicScripts()],
  build: {
    rollupOptions: {
      input: {
        index: 'index.html',
        app: 'app.html'
      }
    }
  }
});
