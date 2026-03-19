import { APP_VERSION } from '../config/version';

declare const __APP_BUILD__: string;

export function getAppVersion() {
  const build = typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : 'dev';
  return `${APP_VERSION} (${build})`;
}

export function isVersionSupported(current: string, min: string) {
  const c = current.split('.').map(Number);
  const m = min.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    if ((c[i] || 0) > (m[i] || 0)) return true;
    if ((c[i] || 0) < (m[i] || 0)) return false;
  }
  return true;
}
