// Android app (Capacitor) glue: hardware back button, status bar colour, splash timing.
import { Capacitor } from '@capacitor/core';
import { RELEASES } from '../config';

export const isNative = () => Capacitor.isNativePlatform();

export async function startNative() {
  if (!isNative()) return;
  const [{ App }, { StatusBar, Style }, { SplashScreen }] = await Promise.all([import('@capacitor/app'), import('@capacitor/status-bar'), import('@capacitor/splash-screen')]);
  App.addListener('backButton', ({ canGoBack }) => {
    // Close an open dialog first (dialogs listen for Escape), otherwise go back or leave the app.
    if (document.querySelector('.fixed.inset-0.z-50')) return window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    if (canGoBack && window.location.hash && !['#/', '#/app', '#/login'].includes(window.location.hash)) return window.history.back();
    return App.exitApp();
  });
  StatusBar.setBackgroundColor({ color: '#1f3d2b' }).catch(() => {});
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  setTimeout(() => SplashScreen.hide().catch(() => {}), 600);
}

/** Latest signed Android builds (attached to each GitHub release by .github/workflows/android.yml). */
export const APK_URL = `${RELEASES}NkukoFiePro.apk`;
export const FARM_APK_URL = `${RELEASES}NkukoFiePro-Farm.apk`;
export const ADMIN_APK_URL = `${RELEASES}NkukoFiePro-Admin.apk`;
