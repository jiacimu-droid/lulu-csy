import React, { useCallback, useEffect, useState } from 'react';
import { VirtualTimeProvider } from './context/VirtualTimeContext';
import { OSProvider } from './context/OSContext';
import PhoneShell from './components/PhoneShell';
import FeaturePreviewPage from './components/FeaturePreviewPage';
import { startKeepAlive, startBackendHeartbeat } from './utils/keepAlive';
import { installGlobalAutofillSuppression } from './utils/autofillSuppression';
import { isFullscreenEnabled, requestSystemFullscreenForMobileRestore } from './utils/systemFullscreen';
import { isIOSStandaloneWebApp } from './utils/iosStandalone';

const EDITABLE_SELECTION_SELECTOR = 'input:not([readonly]), textarea:not([readonly]), select, [contenteditable="true"], [data-allow-text-selection="true"]';

function getSelectionTargetElement(target: EventTarget | null): HTMLElement | null {
  if (target instanceof HTMLElement) return target;
  if (target instanceof Node) return target.parentElement;
  return null;
}

function canSelectText(target: EventTarget | null): boolean {
  const element = getSelectionTargetElement(target);
  return Boolean(element?.closest(EDITABLE_SELECTION_SELECTOR));
}

/**
 * 检测是否运行在 PWA (已安装到桌面) 模式
 */
function isPwaMode(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (navigator as any).standalone === true
  );
}

function isFeaturePreviewRoute(): boolean {
  const hash = window.location.hash.toLowerCase();
  return hash === '#/preview' || hash === '#preview' || new URLSearchParams(window.location.search).has('preview');
}

const SullyOSApp: React.FC = () => {
  useEffect(() => {
    // 1. 启动保活和后端心跳
    startKeepAlive();
    startBackendHeartbeat();

    // 2. 安装全局自动填充抑制
    const uninstallAutofillSuppression = installGlobalAutofillSuppression();

    // 3. 禁止非编辑区域的文本选择
    const preventNonEditableSelection = (event: Event) => {
      if (!canSelectText(event.target)) {
        event.preventDefault();
      }
    };
    document.addEventListener('selectstart', preventNonEditableSelection);

    // 4. 全屏逻辑（仅 PWA 模式且启用全屏时生效）
    let ensureFullscreen: (() => void) | null = null;
    if (isPwaMode() && isFullscreenEnabled()) {
      ensureFullscreen = () => {
        requestSystemFullscreenForMobileRestore();
      };
      document.addEventListener('click', ensureFullscreen, { capture: true, passive: true });
      document.addEventListener('touchstart', ensureFullscreen, { capture: true, passive: true });
    }

    // 统一清理函数
    return () => {
      uninstallAutofillSuppression();
      document.removeEventListener('selectstart', preventNonEditableSelection);
      
      if (ensureFullscreen) {
        document.removeEventListener('click', ensureFullscreen, { capture: true } as any);
        document.removeEventListener('touchstart', ensureFullscreen, { capture: true } as any);
      }
    };
  }, []);

  // iOS 独立模式适配
  const useIOSStandaloneShell =
    typeof window !== 'undefined' && isIOSStandaloneWebApp();

  const shellClassName = 'fixed inset-0 sully-app-root w-full bg-transparent overflow-hidden';
  const shellStyle: React.CSSProperties | undefined = useIOSStandaloneShell
    ? { height: 'var(--app-height, 100lvh)', minHeight: 'var(--app-height, 100lvh)' }
    : undefined;

  return (
    <div className={shellClassName} style={shellStyle}>
      <div
        className="absolute inset-0 w-full h-full z-0 bg-transparent"
        style={{ transform: 'translateZ(0)' }}
      >
        <VirtualTimeProvider>
          <OSProvider>
            <PhoneShell />
          </OSProvider>
        </VirtualTimeProvider>
      </div>
    </div>
  );
};

export default SullyOSApp;
