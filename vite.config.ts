/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mdx from '@mdx-js/rollup';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';

export default defineConfig(({ command, isPreview }) => ({
  // GitHub Pages serves the site under /pipeline-dojo/. `vite preview` serves
  // the build, so it needs the same base. Dev keeps the root.
  base: command === 'build' || isPreview ? '/pipeline-dojo/' : '/',
  plugins: [
    {
      enforce: 'pre',
      ...mdx({
        remarkPlugins: [remarkGfm, remarkFrontmatter, [remarkMdxFrontmatter, { name: 'frontmatter' }]],
        providerImportSource: undefined,
      }),
    },
    react({ include: /\.(mdx|tsx?)$/ }),
  ],
  optimizeDeps: {
    // The engine ships its own workers and WASM; let Vite serve them as files.
    exclude: ['@duckdb/duckdb-wasm'],
  },
  test: {
    include: ['tests/**/*.test.ts'],
    // Booting DuckDB-WASM takes a few seconds on a cold CI runner.
    testTimeout: 30_000,
  },
}));
