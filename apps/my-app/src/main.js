// Entry: fonts (Roboto is what charts draw in), the library's styles, then the app's, then the app.
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@astrato-io/visualizations/styles.css';
import './styles.css';

// Charts draw text on canvas: wait for the faces before the app mounts anything.
Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 3000))]).then(() => import('./app.js'));
