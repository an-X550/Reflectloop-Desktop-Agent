import { defineConfig } from 'vite';

// DSH packages read their own package.json through createRequire(import.meta.url).
// Keeping them external preserves that package-relative lookup after Forge moves
// the main and Utility Process bundles into `.vite/build`.
export default defineConfig({
  build: {
    rollupOptions: {
      // Forge merges this value into its external array, so use Rollup's
      // supported RegExp entries rather than a function nested in that array.
      external: [
        /^@deepseek-ai(?:\/|$)/,
        /(?:^|[/\\])node_modules[/\\]@deepseek-ai[/\\]/,
      ],
    },
  },
});
