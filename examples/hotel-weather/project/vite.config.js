// The Astrato packages are pre-bundled so the dev server serves one copy of each. DuckDB-WASM is
// left out: its worker and .wasm are imported as asset URLs (src/duck.js) and must stay files.
// Only src/, index.html and public/ are the app. Everything a check or a judge writes (screenshots,
// Chrome profiles, logs, reports) must never reload the page under test, so the watcher ignores it.
export default {
  optimizeDeps: {
    include: ['@astrato-io/app-runtime', '@astrato-io/visualizations', '@astrato-io/visualizations/operations',
      '@astrato-io/visualizations/definitions', '@astrato-io/visualizations/metadata'],
    exclude: ['@duckdb/duckdb-wasm'],
  },
  server: {
    watch: {
      ignored: ['**/shots/**', '**/judge/**', '**/tools/**', '**/*.log', '**/*.md', '**/.chrome-profile/**', '**/.smoke-profile/**', '**/dist/**'],
    },
  },
};
