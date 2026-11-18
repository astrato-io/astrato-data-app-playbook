// Entry: fonts (Roboto for text, Material Icons for the table's change arrows), the library's
// styles, the app's styles, then the app. Fonts are loaded before the app mounts any chart, because
// canvas labels and icon ligatures only use fonts that are already loaded.
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import '@fontsource/material-icons/400.css';
import '@astrato-io/visualizations/styles.css';
import './styles.css';

try {
  await Promise.all(['400 12px Roboto', '500 12px Roboto', '400 16px "Material Icons"'].map((f) => document.fonts.load(f)));
} catch { /* a font that fails to load falls back; the app still starts */ }
await import('./app.js');
