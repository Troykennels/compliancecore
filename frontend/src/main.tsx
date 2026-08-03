import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

/**
 * Recover from stale lazy-loaded chunks after a deploy.
 *
 * Pages are code-split, so each route is a separate file whose name contains a
 * content hash. A deploy publishes new hashes and removes the old files — but
 * anyone with the app already open is still running the previous index, which
 * asks for filenames that no longer exist. Navigating then fails with
 * "Failed to fetch dynamically imported module" and the screen goes blank until
 * the user works out to hard-refresh. That is the classic "I had to refresh to
 * get to a page" report, and it happens most right after shipping.
 *
 * Reloading once puts them on the current build. The sessionStorage guard means
 * a genuinely broken chunk shows the error boundary instead of reload-looping.
 */
const RELOAD_GUARD = 'cc:chunk-reloaded';

function recoverFromStaleChunk(reason: unknown): void {
  const message = String((reason as Error)?.message ?? reason ?? '');
  const isChunkError =
    /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk \d+ failed/i
      .test(message);
  if (!isChunkError) return;

  if (sessionStorage.getItem(RELOAD_GUARD)) return; // already tried — let it surface
  sessionStorage.setItem(RELOAD_GUARD, '1');
  window.location.reload();
}

// Vite's own signal when a preloaded chunk 404s. It carries the underlying
// error on `payload`, which Vite types for us.
window.addEventListener('vite:preloadError', (e) => recoverFromStaleChunk(e.payload));
// Fallback for a failed import that surfaces as an unhandled rejection.
window.addEventListener('unhandledrejection', (e) => recoverFromStaleChunk(e.reason));

// A clean load means the current build is intact; clear the guard so a future
// deploy can recover the same way.
window.addEventListener('load', () => sessionStorage.removeItem(RELOAD_GUARD));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
