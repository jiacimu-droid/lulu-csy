import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

import { initSystemInterceptor } from './utils/systemInterceptor';
import { initAppLifecycle } from './utils/appLifecycle';
import { preloadLocalAssets, scheduleIdlePreload } from './utils/preloadResources';
import { installIOSStandaloneWorkaround } from './utils/iosStandalone';
import { installViewportRepair } from './utils/viewportRepair';
import { startRuntimeHealthProbe } from './utils/runtimeHealthProbe';
import {
  captureCollectionWallDebugConsoleArgs,
  installCollectionWallDebugConsoleCapture,
} from './utils/collectionWallDebugLog';

installCollectionWallDebugConsoleCapture();

// =====================
// 🧪 DEBUG（你只看这个就行）
// =====================
const step = (n: string) => console.log("🚧 STEP:", n);

window.addEventListener("error", (e) => {
  console.error("💥 ERROR:", e.message);
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("💥 PROMISE ERROR:", e.reason);
});

console.log("🚀 APP START");

// =====================
// 🔇 log系统（原样保留）
// =====================
if (!import.meta.env.DEV) {
  const keep = (level: string) => (...args: unknown[]) => {
    captureCollectionWallDebugConsoleArgs(level as any, args);
  };

  console.log = keep('log');
  console.warn = keep('warn');
  console.debug = keep('debug');
  console.info = keep('info');
}

// =====================
// 🧠 INIT（关键：我帮你加了保护，不会卡死）
// =====================

// step("1 interceptor");
// try { initSystemInterceptor(); } catch (e) { console.error("interceptor fail", e); }

// step("2 lifecycle");
// try { initAppLifecycle(); } catch (e) { console.error("lifecycle fail", e); }

// step("3 ios fix");
// try { installIOSStandaloneWorkaround(); } catch (e) { console.error(e); }

// step("4 viewport fix");
// try { installViewportRepair(); } catch (e) { console.error(e); }

// step("5 health probe");
// try { startRuntimeHealthProbe(); } catch (e) { console.error(e); }

// step("6 preload");
// try { preloadLocalAssets(); scheduleIdlePreload(); } catch (e) { console.error(e); }


console.log("🚧 INIT DONE");

// =====================
// ⚛️ RENDER
// =====================
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("no root element");
}

const root = ReactDOM.createRoot(rootElement);

console.log("🚀 BEFORE MOUNT");

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

console.log("🚀 AFTER MOUNT");