// Two Android apps from one project: APP=main (default) → PoultryPro, APP=admin → PoultryPro Admin.
import type { CapacitorConfig } from '@capacitor/cli';

const admin = process.env.APP === 'admin';

const config: CapacitorConfig = {
  appId: admin ? 'com.poultrypro.admin' : 'com.poultrypro.app',
  appName: admin ? 'PoultryPro Admin' : 'PoultryPro',
  webDir: admin ? 'build/admin' : 'build/main',
  android: {
    path: admin ? 'android-admin' : 'android',
    backgroundColor: '#1f3d2b',
  },
  plugins: {
    SplashScreen: { launchShowDuration: 1800, launchAutoHide: true, backgroundColor: '#1f3d2b', androidScaleType: 'CENTER_CROP', showSpinner: false },
    StatusBar: { backgroundColor: '#1f3d2b', style: 'DARK' },
  },
};

export default config;
