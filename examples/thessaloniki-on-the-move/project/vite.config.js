// The Astrato packages are pre-bundled up front, so the first page load does not stall on
// dependency discovery while every chart chunk is requested at once.
export default {
  optimizeDeps: {
    include: [
      '@astrato-io/app-runtime',
      '@astrato-io/visualizations',
      '@astrato-io/visualizations/operations',
      '@astrato-io/visualizations/definitions',
      '@astrato-io/visualizations/metadata',
    ],
  },
  // The kit's smoke test writes screenshots and its Chrome profile under shots/: watching them
  // reloads the page in the middle of a run.
  server: { watch: { ignored: ['**/shots/**'] } },
};
