/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import mdx from '@mdx-js/rollup';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';

// The built site's Content Security Policy. GitHub Pages can't send response
// headers, so it goes in a <meta> tag, which can't set frame-ancestors.
// Only the build gets it: the dev server injects inline scripts for HMR.
const contentSecurityPolicy = [
  "default-src 'self'",
  // DuckDB compiles WebAssembly, which needs wasm-unsafe-eval (not unsafe-eval).
  "script-src 'self' 'wasm-unsafe-eval'",
  // The DuckDB worker starts from a blob: URL so it inherits this policy
  // (see src/engines/sql/browser.ts).
  "worker-src 'self' blob:",
  // Learner SQL runs in that worker. This stops queries like
  // read_text('https://…') and DuckDB extension downloads from leaving the site.
  "connect-src 'self'",
  // CodeMirror injects <style> elements, and React sets style attributes.
  "style-src 'self' 'unsafe-inline'",
  // The favicon is a data: URI.
  "img-src 'self' data:",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

function contentSecurityPolicyMeta(): Plugin {
  return {
    name: 'content-security-policy-meta',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: contentSecurityPolicy },
        injectTo: 'head-prepend',
      },
    ],
  };
}

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
    contentSecurityPolicyMeta(),
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
