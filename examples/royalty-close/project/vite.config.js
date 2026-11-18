// Pre-bundle the Astrato entries so the dev server does not discover them one request at a time.
export default {
  optimizeDeps: {
    include: ['@astrato-io/app-runtime', '@astrato-io/visualizations', '@astrato-io/visualizations/operations',
      '@astrato-io/visualizations/definitions', '@astrato-io/visualizations/metadata'],
  },
  // The smoke test writes shots/ inside the project: watching it would reload the page mid-run.
  server: { watch: { ignored: ['**/shots/**'] } },
};
