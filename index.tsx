import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initSystemInterceptor } from './utils/systemInterceptor';
import { initAppLifecycle } from './utils/appLifecycle';
import { preloadLocalAssets,scheduleIdlePreload } from './utils/preloadResources';
import { installIOSStandaloneWorkaround } from './utils/iosStandalone';
import { installViewportRepair } from './utils/viewportRepair';
import { startRuntimeHealthProbe } from './utils/runtimeHealthProbe';
import {
  captureCollectionWallDebugConsoleArgs,
  installCollectionWallDebugConsoleCapture,
} from './utils/collectionWallDebugLog';

installCollectionWallDebugConsoleCapture();

// ── Production Log Suppression ──────────────────────────────────
if (!import.meta.env.DEV) {
  const keepCollectionWallDebug = (level: 'log' | 'info' | 'warn' | 'debug') => (...args: unknown[]) => {
    captureCollectionWallDebugConsoleArgs(level, args);
  };
  console.log = keepCollectionWallDebug('log');
  console.warn = keepCollectionWallDebug('warn');
  console.debug = keepCollectionWallDebug('debug');
  console.info = keepCollectionWallDebug('info');
}

initSystemInterceptor();
initAppLifecycle();
installIOSStandaloneWorkaround();
installViewportRepair();
startRuntimeHealthProbe();

preloadLocalAssets();
scheduleIdlePreload();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// ── Mount Success Signal ──────────────────────────────────
(window as any).__REACT_MOUNTED = true;
if (typeof (window as any).__CLEAR_SCRIPT_TIMEOUT === 'function') {
  (window as any).__CLEAR_SCRIPT_TIMEOUT();
}
