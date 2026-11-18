// Pre-bundle every Astrato entry the app imports, so the dev server never re-optimises mid-session
// (a re-optimisation 502s the lazily loaded chart chunks behind the Astrato dev proxy).
// The smoke test writes screenshots and its Chrome profile under shots/: never reload for those.
export default {
  optimizeDeps: {
    include: ['@astrato-io/app-runtime', '@astrato-io/visualizations', '@astrato-io/visualizations/definitions',
      '@astrato-io/visualizations/operations', '@astrato-io/visualizations/metadata'],
  },
  server: { watch: { ignored: ['**/shots/**'] } },
  build: { chunkSizeWarningLimit: 3000 },
};
