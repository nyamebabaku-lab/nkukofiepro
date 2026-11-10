// Three Android apps from one project, picked with APP:
//   APP=main  → Nkukɔ Fie Pro        (customers)                   com.nkukofie.app
//   APP=farm  → Nkukɔ Fie Pro Farm   (owners, managers, workers)   com.nkukofie.farm
//   APP=admin → Nkukɔ Fie Pro Admin  (super admin)                 com.nkukofie.admin
import type { CapacitorConfig } from '@capacitor/cli';

const APP = (process.env.APP || 'main') as 'main' | 'farm' | 'admin';
const APPS = {
  main: { appId: 'com.nkukofie.app', appName: 'Nkukɔ Fie Pro', path: 'android' },
  farm: { appId: 'com.nkukofie.farm', appName: 'Nkukɔ Fie Pro Farm', path: 'android-farm' },
  admin: { appId: 'com.nkukofie.admin', appName: 'Nkukɔ Fie Pro Admin', path: 'android-admin' },
};

const config: CapacitorConfig = {
  appId: APPS[APP].appId,
  appName: APPS[APP].appName,
  webDir: `build/${APP}`,
  android: {
    path: APPS[APP].path,
    backgroundColor: '#1f3d2b',
  },
  plugins: {
    SplashScreen: { launchShowDuration: 1800, launchAutoHide: true, backgroundColor: '#1f3d2b', androidScaleType: 'CENTER_CROP', showSpinner: false },
    StatusBar: { backgroundColor: '#1f3d2b', style: 'DARK' },
  },
};

export default config;
