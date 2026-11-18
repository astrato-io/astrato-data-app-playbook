// The Astrato packages are pre-bundled so the dev server serves one copy of each.
export default {
  optimizeDeps: {
    include: ['@astrato-io/app-runtime', '@astrato-io/visualizations', '@astrato-io/visualizations/operations',
      '@astrato-io/visualizations/definitions', '@astrato-io/visualizations/metadata'],
  },
};
