/**
 * Application keep-alive utility (APK SAFE MODE)
 * 已关闭所有网络心跳与后台副作用，避免 WebView 闪退
 */

export function startKeepAlive() {
  console.log('[KeepAlive] disabled in APK safe mode');
}

/**
 * Backend heartbeat 已禁用
 * 原因：Android WebView + 无后端环境会触发异常链
 */
export function startBackendHeartbeat() {
  console.log('[Heartbeat] fully disabled (APK safe mode)');
  return;
}